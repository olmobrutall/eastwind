import * as React from "react";
import { Tabs, Tab } from "react-bootstrap";
import { AutoLine } from "@altea/altea/client/Lines/AutoLine";
import { EntityLine } from "@altea/altea/client/Lines/EntityLine";
import { EntityDetail } from "@altea/altea/client/Lines/EntityDetail";
import { RenderEntity } from "@altea/altea/client/Lines/RenderEntity";
import type { TypeContext } from "@altea/altea/client/TypeContext";
import { ApplicationConfigurationEntity } from "./ApplicationConfiguration.data";

// Port of Southwind's `Globals/ApplicationConfiguration.tsx` — one tab per module, each rendering that
// module's own configuration view through RenderEntity (so a module owns how its settings look, and this
// page only decides the order of the tabs).
//
// The three DIRECTORY tabs use EntityDetail rather than RenderEntity because those members are NULLABLE
// (Southwind's `azureAD` is too): the line is what creates the embedded when an administrator decides to
// configure that directory, and removes it again.
export default function ApplicationConfiguration(p: { ctx: TypeContext<ApplicationConfigurationEntity> }): React.JSX.Element {
    const ctx = p.ctx;
    return (
        <div>
            <AutoLine ctx={ctx.subCtx(a => a.environment)} />
            {/* Southwind does not render `databaseName` — its value comes from the seed and is the
                row's identity, so there is nothing to edit. Here nothing reads it and the seed is the
                only writer, so a row that predates the column (the sync defaults it to '') could not
                be repaired at all without a line: the next save of ANY setting would fail its
                min-length validator with no field to fix. */}
            <AutoLine ctx={ctx.subCtx(a => a.databaseName)} />
            <Tabs id={ctx.prefix + "appTabs"}>
                <Tab eventKey="email" title={ctx.niceName(a => a.email)}>
                    <RenderEntity ctx={ctx.subCtx(a => a.email)} />
                    <EntityLine ctx={ctx.subCtx(a => a.emailSender)} />
                </Tab>
                <Tab eventKey="chatbot" title={ctx.niceName(a => a.chatbot)}>
                    <RenderEntity ctx={ctx.subCtx(a => a.chatbot)} />
                </Tab>
                <Tab eventKey="workflow" title={ctx.niceName(a => a.workflow)}>
                    <RenderEntity ctx={ctx.subCtx(a => a.workflow)} />
                </Tab>
                {/* `sms` and `translation` are non-nullable embeddeds, like email and chatbot, so they are
                    always there to edit. `sms` was on the entity with no tab at all. */}
                <Tab eventKey="sms" title={ctx.niceName(a => a.sms)}>
                    <RenderEntity ctx={ctx.subCtx(a => a.sms)} />
                </Tab>
                <Tab eventKey="translation" title={ctx.niceName(a => a.translation)}>
                    <RenderEntity ctx={ctx.subCtx(a => a.translation)} />
                </Tab>
                <Tab eventKey="azureAD" title={ctx.niceName(a => a.azureAD)}>
                    <EntityDetail ctx={ctx.subCtx(a => a.azureAD)} />
                </Tab>
                <Tab eventKey="openID" title={ctx.niceName(a => a.openID)}>
                    <EntityDetail ctx={ctx.subCtx(a => a.openID)} />
                </Tab>
                <Tab eventKey="windowsAD" title={ctx.niceName(a => a.windowsAD)}>
                    <EntityDetail ctx={ctx.subCtx(a => a.windowsAD)} />
                </Tab>
            </Tabs>
        </div>
    );
}
