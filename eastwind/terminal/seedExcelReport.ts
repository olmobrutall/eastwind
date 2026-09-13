// A demo ExcelReport for the Order query, so the Excel menu has something to list and run.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/seedExcelReport.js <template.xlsx>
import { readFileSync } from "node:fs";
import { Starter } from "../app/starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { QueryLogic } from "@altea/altea/server/dynamicQuery/queryLogic";
import { ExecutionMode } from "@altea/altea/server/executionMode";
import { table } from "@altea/altea/server/table";
import { ExcelReportEntity } from "@altea/altea-office-template/data/excel/ExcelReport";
import { FileEmbedded } from "@altea/altea-files/data/Files";

async function main(): Promise<void> {
    await Starter.start(process.env["EASTWIND_DB"]!);

    const path = process.argv[2];
    if (path == undefined)
        throw new Error("usage: seedExcelReport <template.xlsx>");

    await ExecutionMode.global(async () => {
        const existing = await table(ExcelReportEntity)
            .filter(er => er.displayName == "Orders by customer")
            .toArray() as ExcelReportEntity[];

        for (const old of existing)
            await old.delete();

        const report = ExcelReportEntity.create({
            query: QueryLogic.tryGetQueryEntityByKey("Order")!,
            displayName: "Orders by customer",
            file: FileEmbedded.create({ fileName: "OrdersReport.xlsx", binaryFile: readFileSync(path) }),
        });

        await report.save();
        console.log(`[seed] ExcelReport ${report.id} '${report.displayName}' for query Order`);
    });

    await Connector.current().closeConnection();
}

void main();
