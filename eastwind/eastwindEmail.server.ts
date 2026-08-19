import { table } from "@altea/altea/server/table";
import { EmailConfigurationEmbedded } from "@altea/altea-email/data/Email";
import { EmailLogic } from "@altea/altea-email/server/EmailLogic.server";
import { EmailSenderConfigurationEntity } from "@altea/altea-email/data/EmailSenderConfiguration";
import { EmailMasterTemplateEntity, EmailMasterTemplateEntity_Message } from "@altea/altea-email/data/EmailTemplate";
import { EmailMasterTemplateLogic } from "@altea/altea-email/server/EmailMasterTemplateLogic.server";
import { UserEntity } from "@altea/altea-auth/data/User";
import type { EmailTemplateEntity } from "@altea/altea-email/data/EmailTemplate";
import type { EmailMessageEntity } from "@altea/altea-email/data/EmailMessage";
import type { Lite } from "@altea/altea/data/lite";
import type { Entity } from "@altea/altea/data/entity";

// eastwind's side of the email module — Southwind keeps exactly these three things in its own code
// (Starter.cs's `EmailLogic.Start(sb, () => Configuration.Value.Email, (template, target, message) =>
// Configuration.Value.EmailSender)` plus the app's EmailOwnerData expressions):
//
//   1. the CONFIGURATION (Southwind reads it from its persisted ApplicationConfiguration; eastwind has no
//      such entity, so it comes from the environment with safe defaults — `EASTWIND_MAIL_*`);
//   2. which SENDER CONFIGURATION a template / target should use;
//   3. how to read an EMAIL OWNER's address off each owner type (altea's registry replaces Signum's
//      queryable EmailOwnerData expression — see @altea/altea-email's data/Email.ts).
//
// `sendEmails` defaults to FALSE: a dev database records a message as "Sent" without touching the network,
// which is what you want until a real SMTP host is configured.

export namespace EastwindEmail {

    /** The app's mail settings, from the environment (see the header). Built once, on first read. */
    let cached: EmailConfigurationEmbedded | undefined;

    export function configuration(): EmailConfigurationEmbedded {
        return cached ??= EmailConfigurationEmbedded.create({
            defaultCulture: process.env["EASTWIND_MAIL_CULTURE"] ?? "en-US",
            urlLeft: (process.env["EASTWIND_MAIL_URL_LEFT"] ?? "http://localhost:5173").replace(/\/$/, ""),
            sendEmails: process.env["EASTWIND_MAIL_SEND"] === "true",
            reciveEmails: false,
            overrideEmailAddress: process.env["EASTWIND_MAIL_OVERRIDE"] ?? null,
            avoidSendingEmailsOlderThan: null,
        });
    }

    /** Signum's `getEmailSenderConfiguration` — eastwind has ONE sender configuration, so whichever row
     *  exists is used (an app with several would pick by template / target here). */
    export async function senderConfiguration(
        _template: EmailTemplateEntity | null,
        _target: Lite<Entity> | null,
        _message: EmailMessageEntity | null,
    ): Promise<EmailSenderConfigurationEntity | null> {
        const all = await EmailSenderConfigurationLogicCache();
        return all[0] ?? null;
    }

    async function EmailSenderConfigurationLogicCache(): Promise<EmailSenderConfigurationEntity[]> {
        return await table(EmailSenderConfigurationEntity).toArray() as EmailSenderConfigurationEntity[];
    }

    /** Register how each of eastwind's email-owner types yields an address. Southwind's only owner is the
     *  USER (its customers carry no email), so that is what eastwind registers too. */
    export function registerEmailOwners(): void {
        EmailLogic.registerEmailOwner(UserEntity, u => ({
            owner: u.toLite(),
            email: u.email,
            displayName: u.userName,
            culture: null, // altea has no CultureInfoEntity on the user (see altea-auth's User.ts)
            externalId: u.externalId,
        }));
    }

    /** The master template a fresh database gets (Signum's `EmailMasterTemplateLogic
     *  .CreateDefaultMasterTemplate`): plain chrome with `@[content]` where a template's body lands. */
    export function registerDefaultMasterTemplate(): void {
        EmailMasterTemplateLogic.createDefaultMasterTemplate = () => EmailMasterTemplateEntity.create({
            name: "Default",
            isDefault: true,
            messages: [EmailMasterTemplateEntity_Message.create({
                culture: configuration().defaultCulture,
                text: defaultMasterTemplateHtml,
            })],
        });
    }
}

const defaultMasterTemplateHtml = `<html>
<head>
  <meta charset="utf-8" />
</head>
<body style="font-family: sans-serif; font-size: 14px; color: #333;">
@[content]
<hr />
<p style="color: #999; font-size: 12px;">eastwind</p>
</body>
</html>`;
