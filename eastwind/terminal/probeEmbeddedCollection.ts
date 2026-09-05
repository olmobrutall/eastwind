// The three DIRECTORY configurations as real EMBEDDEDs on the application's settings row — Signum's own
// shape (Signum.Authorization/BaseAD/BaseADConfigurationEmbedded.cs), which altea could not express until
// a collection could be declared inside an embedded.
//
// The framework half is pinned DB-free and against the music model (altea's
// test/server/{schema,orm}/embeddedCollection.test.ts). What only THIS database can show is the
// combination those cannot: a collection inside an embedded whose row type lives in a FRAMEWORK package
// and therefore cannot name its owner — its @backReference is an empty @implementedBy that eastwind
// widens to ApplicationConfigurationEntity. Every layer has to agree on that one column: the schema names
// it, the saver writes the owner into it, the LINQ binder correlates the collection on it, and the delete
// cascade finds the rows through it.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/probeEmbeddedCollection.js
import { Starter } from "../starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { Schema } from "@altea/altea/server/schema/schema";
import { ExecutionMode } from "@altea/altea/server/executionMode";
import { table } from "@altea/altea/server/table";
import { retrieve } from "@altea/altea/server/Database";
import { Serializer } from "@altea/altea/data/serializer";
import { FieldEmbedded, FieldEntityArray, FieldImplementedBy } from "@altea/altea/server/schema/field";
import { IsNullable } from "@altea/altea/server/schema/dbType";
import { ApplicationConfigurationEntity } from "../globals/ApplicationConfiguration.data";
import { ClientCertificationFileEntity } from "@altea/altea-email/data/EmailSenderConfiguration";
import { AzureADConfigurationEmbedded, AzureADRoleMappingEntity, AzureADType } from "@altea/altea-auth-azuread/data/AzureAD";
import { RoleEntity } from "@altea/altea-auth/data/Role";
import { SmtpEmailServiceEntity, EmailSenderConfigurationEntity } from "@altea/altea-email/data/EmailSenderConfiguration";
import { EmailConfigurationEmbedded } from "@altea/altea-email/data/Email";
import { ChatbotConfigurationEmbedded } from "@altea/altea-agent/data/LanguageModel";
import { WorkflowConfigurationEmbedded } from "@altea/altea-workflow/data/Workflow";
import { SMSConfigurationEmbedded } from "@altea/altea-sms/data/SMS";

let pass = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: string): void {
    if (ok) { pass++; console.log("  OK   " + name); return; }
    failures.push(name + (detail == null ? "" : ": " + detail));
}

async function main(): Promise<void> {
    await Starter.start(process.env["EASTWIND_DB"]!);

    // ---- the schema ---------------------------------------------------------------------------------
    const config = Schema.current.table(ApplicationConfigurationEntity);
    const columns = Object.keys(config.columns).map(c => c.toLowerCase());

    // The configuration is FLATTENED onto the settings row (Signum has no azure_ad_configuration table).
    check("the AD configuration is flattened onto application_configuration",
        columns.includes("azure_ad_has_value") && columns.includes("azure_ad_tenant_name"),
        columns.filter(c => c.startsWith("azure_ad")).join(", "));
    check("it has no reference column of its own",
        !columns.some(c => c === "azure_adid" || c === "azure_ad_id"), columns.join(", "));
    check("the three directories are each embedded",
        ["azure_ad_has_value", "open_id_has_value", "windows_ad_has_value"].every(c => columns.includes(c)));

    // …but the COLLECTION inside it is not: its rows live in their own table.
    check("the collection contributes no column to the owner",
        !columns.some(c => c.includes("role_mapping")), columns.join(", "));

    const embedded = config.fields["azureAD"]?.field;
    check("azureAD is a FieldEmbedded", embedded instanceof FieldEmbedded);
    const collection = embedded instanceof FieldEmbedded ? embedded.embeddedFields["roleMapping"]?.field : undefined;
    check("its roleMapping is a FieldEntityArray", collection instanceof FieldEntityArray);

    // The back reference: one column, pointing at the ENTITY that holds the embedded, NOT NULL.
    const rows = Schema.current.table(AzureADRoleMappingEntity);
    const back = rows.fields["configuration"]?.field;
    check("the row's back reference is a widened @implementedBy", back instanceof FieldImplementedBy);
    const backColumns = back?.columns() ?? [];
    check("it resolves to exactly ONE column", backColumns.length === 1, String(backColumns.length));
    check("that column points at ApplicationConfigurationEntity",
        backColumns[0]?.referenceTable?.type === (ApplicationConfigurationEntity as unknown));
    check("and it is NOT NULL (a single implementation carries the field's nullability)",
        backColumns[0]?.nullable === IsNullable.No);
    check("the row keeps Signum's [PreserveOrder] column",
        Object.keys(rows.columns).map(c => c.toLowerCase()).includes("order"),
        Object.keys(rows.columns).join(", "));

    // ---- the SAME-PACKAGE case: SmtpNetworkDeliveryEmbedded ----------------------------------------
    // Its owner (SmtpEmailServiceEntity) is in the module itself, so the back reference names it directly
    // — no widening needed. Signum flattens it onto smtp_email_service as network_*.
    const smtp = Schema.current.table(SmtpEmailServiceEntity);
    const smtpColumns = Object.keys(smtp.columns).map(c => c.toLowerCase());
    check("the SMTP network delivery is flattened onto smtp_email_service",
        ["network_has_value", "network_host", "network_port"].every(c => smtpColumns.includes(c)),
        smtpColumns.join(", "));
    check("it has no reference column of its own", !smtpColumns.includes("network_id"), smtpColumns.join(", "));
    check("its certification rows point back at the SERVICE",
        Schema.current.table(ClientCertificationFileEntity).fields["service"]?.field.columns()[0]?.referenceTable?.type
            === (SmtpEmailServiceEntity as unknown));

    // ---- save / retrieve / delete, all through the embedded -----------------------------------------
    await ExecutionMode.global(async () => {
        const role = await table(RoleEntity).firstOrNull();
        if (role == null) {
            failures.push("no RoleEntity row to map to — run the C# migrations first");
            return;
        }

        const template = await table(ApplicationConfigurationEntity).first();

        const app = newConfiguration("probe-embedded-collection", template, {
            type: AzureADType.AzureAD,
            // Well-formed placeholders: the probe never talks to a directory.
            applicationID: "00000000-0000-0000-0000-000000000001",
            directoryID: "00000000-0000-0000-0000-000000000002",
            roleMapping: [
                AzureADRoleMappingEntity.create({ adNameOrGuid: "Group A", role: role.toLite() }),
                AzureADRoleMappingEntity.create({ adNameOrGuid: "Group B", role: role.toLite() }),
            ],
        });
        await app.save();

        // The saver reached one member deeper: each row carries the OWNER's id and its index.
        const saved = app.azureAD!.roleMapping;
        check("the saver wired the back reference to the settings row",
            saved.every(r => (r.configuration as { id?: unknown }).id === app.id),
            JSON.stringify(saved.map(r => (r.configuration as { id?: unknown }).id)));
        check("and numbered the rows", saved.map(r => r.order).join(",") === "0,1",
            saved.map(r => r.order).join(","));

        // The binder correlated the collection on that same column, so a retrieve brings it back.
        const back1 = await retrieve(ApplicationConfigurationEntity, app.id);
        check("a retrieve eager-loads the collection through the embedded",
            back1.azureAD?.roleMapping.length === 2, String(back1.azureAD?.roleMapping.length));
        check("in order", back1.azureAD!.roleMapping.map(r => r.adNameOrGuid).join(",") === "Group A,Group B",
            back1.azureAD!.roleMapping.map(r => r.adNameOrGuid).join(","));

        // The wire form omits a recoverable back reference; the codec fills it from the nearest ENTITY.
        const parsed = Serializer.parse(Serializer.stringify(back1)) as ApplicationConfigurationEntity;
        check("the serializer round-trips it, recovering the owner",
            parsed.azureAD?.roleMapping.length === 2
            && parsed.azureAD.roleMapping.every(r => (r.configuration as { id?: unknown }).id === app.id));

        // Dropping one element sweeps its row (the orphan sweep reaches into the embedded).
        const droppedId = back1.azureAD!.roleMapping[1].id;
        back1.azureAD!.roleMapping = [back1.azureAD!.roleMapping[0]];
        await back1.save();
        check("removing an element deletes its row",
            await table(AzureADRoleMappingEntity).count(r => r.id == droppedId) === 0);

        // Clearing the embedded takes the rest with it.
        const keptId = back1.azureAD!.roleMapping[0].id;
        back1.azureAD = null;
        await back1.save();
        const cleared = await retrieve(ApplicationConfigurationEntity, app.id);
        check("clearing the embedded clears the row's columns", cleared.azureAD == null);
        check("and deletes the rows it held",
            await table(AzureADRoleMappingEntity).count(r => r.id == keptId) === 0);

        // Finally, the DELETE cascade finds the rows through the embedded (a flat walk left them behind,
        // then failed on their foreign key).
        const app2 = newConfiguration("probe-embedded-collection-2", template, {
            type: AzureADType.AzureAD,
            applicationID: "00000000-0000-0000-0000-000000000001",
            directoryID: "00000000-0000-0000-0000-000000000002",
            roleMapping: [AzureADRoleMappingEntity.create({ adNameOrGuid: "Group C", role: role.toLite() })],
        });
        await app2.save();
        const cascadeId = app2.azureAD!.roleMapping[0].id;

        await table(ApplicationConfigurationEntity).filter(a => a.id == app2.id).executeDelete();
        check("deleting the owner cascades to the embedded's rows",
            await table(AzureADRoleMappingEntity).count(r => r.id == cascadeId) === 0);

        // The dev seed's SMTP sender survived the flattening (migrateSmtpNetwork.ts).
        const sender = await table(EmailSenderConfigurationEntity).firstOrNull();
        if (sender != null) {
            const service = sender.service as SmtpEmailServiceEntity;
            check("a stored SMTP service still reads its network settings back",
                service.network != null && service.network.host.length > 0,
                JSON.stringify(service.network));
        }

        // Leave nothing behind.
        await table(ApplicationConfigurationEntity).filter(a => a.id == app.id).executeDelete();
        check("the probe cleans up after itself",
            await table(ApplicationConfigurationEntity).count(a => a.environment.startsWith("probe-embedded-collection")) === 0);
    });

    return report();
}

// A throwaway settings row carrying `azureAD`. The other modules' configurations are required members,
// so they are filled the way the dev seed fills them, and the email sender and the cultures are borrowed
// from the row that already exists rather than created — none of it is what this probe is about.
function newConfiguration(environment: string, template: ApplicationConfigurationEntity,
    azureAD: Partial<AzureADConfigurationEmbedded>): ApplicationConfigurationEntity {
    return ApplicationConfigurationEntity.create({
        environment,
        databaseName: template.databaseName,
        email: EmailConfigurationEmbedded.create({ defaultCulture: template.email.defaultCulture, urlLeft: "http://localhost:5173", sendEmails: false, reciveEmails: false, avoidSendingEmailsOlderThan: null }),
        emailSender: template.emailSender,
        chatbot: ChatbotConfigurationEmbedded.create({}),
        workflow: WorkflowConfigurationEmbedded.create({ avoidExecutingScriptsOlderThan: null }),
        sms: SMSConfigurationEmbedded.create({ defaultCulture: template.sms.defaultCulture }),
        azureAD: AzureADConfigurationEmbedded.create(azureAD),
        openID: null,
        windowsAD: null,
    });
}

function report(): void {
    console.log(`\n${pass} checks passed, ${failures.length} failed`);
    for (const f of failures)
        console.log("  FAIL " + f);
    void Connector.current().closeConnection();
    process.exit(failures.length === 0 ? 0 : 1);
}

void main();
