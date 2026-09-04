// ExcelReport — a stored .xlsx TEMPLATE attached to a query, whose "Data" sheet a report run refills from
// the search (Signum.Excel's ExcelReportEntity + ExcelGenerator).
//
// What this pins is the part a unit test cannot see: the generated workbook is a real OOXML package, and the
// three things the generator has to get right are structural — the template's own styles survive, the
// pivot caches point at the new range, and a column the template asks for but the query does not have is a
// loud error rather than a quietly wrong file. Plus the table itself, which must match Signum's column for
// column, since reading an existing Signum database is the point of porting this at all.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/probeExcelReport.js
import { Starter } from "../starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { Schema } from "@altea/altea/server/schema/schema";
import { QueryLogic } from "@altea/altea/server/dynamicQuery/queryLogic";
import { Column, Pagination, QueryRequest } from "@altea/altea/server/dynamicQuery/requests";
import { ExecutionMode } from "@altea/altea/server/executionMode";
import { OxmlPackage } from "@altea/altea-office-template/server/oxml/OxmlPackage.server";
import { OxmlElement, OxmlText } from "@altea/altea-office-template/server/oxml/OxmlElement.server";
import { ExcelReportGenerator } from "@altea/altea-office-template/server/excel/ExcelReportGenerator.server";
import { templateBytes } from "@altea/altea-office-template/server/excel/PlainExcelGenerator.server";
import { ExcelReportEntity, extensionError } from "@altea/altea-office-template/data/excel/ExcelReport";
import { FileEmbedded } from "@altea/altea-files/data/Files";
import { OrderEntity } from "../orders/Order.data";

let pass = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: string): void {
    if (ok) { pass++; console.log("  OK   " + name); return; }
    failures.push(name + (detail == null ? "" : ": " + detail));
}

async function main(): Promise<void> {
    await Starter.start(process.env["EASTWIND_DB"]!);

    // ---- the table ---------------------------------------------------------------------------------
    // Signum's excel.ExcelReport: Id, Ticks, Query_id, DisplayName, File_FileName, File_BinaryFile.
    const t = Schema.current.table(ExcelReportEntity);
    check("table is excel.excel_report", t.name.toString().toLowerCase().includes("excel_report")
        && t.name.toString().toLowerCase().includes("excel"), t.name.toString());

    const columns = Object.keys(t.columns).map(c => c.toLowerCase());
    for (const expected of ["id", "ticks", "query_id", "display_name", "file_file_name", "file_binary_file"])
        check(`column ${expected}`, columns.includes(expected), columns.join(", "));

    check("no column Signum does not have", columns.length === 6, columns.join(", "));

    // ---- the extension rule ------------------------------------------------------------------------
    check("an .xlsx template is accepted", extensionError(file("Report.xlsx", new Uint8Array())) == undefined);
    check("an .xls template is refused", extensionError(file("Report.xls", new Uint8Array())) != undefined);
    check("an .XLSX template is accepted (case)", extensionError(file("R.XLSX", new Uint8Array())) == undefined);
    check("an extensionless name is refused", extensionError(file("Report", new Uint8Array())) != undefined);
    check("an empty file name says nothing (the NotNull validator does)",
        extensionError(file("", new Uint8Array())) == undefined);

    // ---- the generator -----------------------------------------------------------------------------
    const request = await orderRequest();
    const results = await ExecutionMode.global(() => QueryLogic.queries.executeQueryAsync(request));
    check("the demo query returns rows", results.rows.length > 0, String(results.rows.length));

    const template = buildTemplate(["Id", "Ship name"]);
    const bytes = ExcelReportGenerator.writeDataInExcelFile(results, request, template);
    const pkg = OxmlPackage.load(bytes);
    const sheet = worksheet(pkg);
    const rows = [...sheet.element("sheetData")!.elements("row")];

    check("one header row plus one row per result",
        rows.length === results.rows.length + 1, `${rows.length} vs ${results.rows.length + 1}`);

    const header = [...rows[0]!.elements("c")].map(cellString);
    check("the header is the template's columns, in the template's order",
        header.join("|") === "Id|Ship name", header.join("|"));

    // The SAMPLE row's style is what a data cell wears — the whole reason a template is a template.
    const dataCells = [...rows[1]!.elements("c")];
    check("a data cell takes the sample row's style",
        dataCells[1]?.getAttribute("s") === String(SAMPLE_STYLE), dataCells[1]?.getAttribute("s"));
    check("the header keeps A1's style",
        [...rows[0]!.elements("c")][0]?.getAttribute("s") === String(HEADER_STYLE));

    // The row/cell references are stamped, or Excel repairs the file.
    check("rows are renumbered from 1", rows[0]!.getAttribute("r") === "1" && rows[1]!.getAttribute("r") === "2");
    check("cells are re-referenced", dataCells[0]?.getAttribute("r") === "A2"
        && dataCells[1]?.getAttribute("r") === "B2", dataCells.map(c => c.getAttribute("r")).join(","));

    // ---- a column the template asks for but the query does not have --------------------------------
    let refused = false;
    try {
        ExcelReportGenerator.writeDataInExcelFile(results, request, buildTemplate(["Id", "Nonexistent"]));
    } catch (e) {
        refused = String(e).includes("Nonexistent");
    }
    check("a template column with no query column is refused, naming it", refused);

    // ---- a query column the template does not mention ----------------------------------------------
    const narrow = ExcelReportGenerator.writeDataInExcelFile(results, request, buildTemplate(["Id"]));
    const narrowHeader = [...worksheet(OxmlPackage.load(narrow)).element("sheetData")!.elements("row")]
        .slice(0, 1).flatMap(r => [...r.elements("c")]).map(cellString);
    check("a query column the template lacks is APPENDED, after the template's",
        narrowHeader.join("|") === "Id|Ship name", narrowHeader.join("|"));

    // ---- the pivot cache ---------------------------------------------------------------------------
    const withPivot = ExcelReportGenerator.writeDataInExcelFile(results, request, buildTemplate(["Id", "Ship name"], true));
    const pivotPkg = OxmlPackage.load(withPivot);
    const definition = pivotPkg.parts.find(p => p.contentType.includes("pivotCacheDefinition"))?.rootElement;
    const source = definition?.descendantsNamed("worksheetSource")[0];
    check("the pivot cache is repointed at the written range",
        source?.getAttribute("ref") === `A1:B${results.rows.length + 1}`, source?.getAttribute("ref"));
    check("the pivot cache refreshes on load", definition?.getAttribute("refreshOnLoad") === "1");
    check("the pivot cache drops the template's cached records", definition?.getAttribute("saveData") === "0");

    // ---- report ------------------------------------------------------------------------------------
    console.log(`\n${pass} checks passed, ${failures.length} failed`);
    for (const f of failures)
        console.log("  FAIL " + f);

    await Connector.current().closeConnection();
    process.exit(failures.length === 0 ? 0 : 1);
}

function file(fileName: string, binaryFile: Uint8Array): FileEmbedded {
    return FileEmbedded.create({ fileName, binaryFile });
}

async function orderRequest(): Promise<QueryRequest> {
    const queryName = QueryLogic.toQueryName("Order");
    const options = 4 /* CanElement */;
    return new QueryRequest(
        queryName,
        [],
        [],
        [new Column(QueryLogic.getToken(queryName, "id", options)),
         new Column(QueryLogic.getToken(queryName, "shipName", options))],
        new Pagination.Firsts(5),
        false);
}

/** The two style indexes the built template stamps, so the assertions can name them. */
const HEADER_STYLE = 1;
const SAMPLE_STYLE = 2;

/**
 * A template whose "Data" sheet has a header row and one sample row — the two things the generator reads
 * out of a template.
 *
 * Built FROM the package's own `plainExcelTemplate.xlsx` (the styles workbook every plain export already
 * inherits) rather than from nothing: OxmlPackage only loads, and a hand-rolled zip would be testing the
 * probe's idea of an .xlsx rather than a real one.
 */
function buildTemplate(headers: string[], withPivot = false): Uint8Array {
    const pkg = OxmlPackage.load(templateBytes());

    const workbook = pkg.mainPart.rootElement!;
    const sheets = workbook.element("sheets")!;
    const worksheetPart = pkg.mainPart.partsOfType(
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet")[0]!;
    const id = pkg.mainPart.getIdOfPart(worksheetPart)!;

    sheets.removeAllChildren();
    const sheet = sheets.appendChild(new OxmlElement("sheet"));
    sheet.setAttribute("name", "Data");
    sheet.setAttribute("sheetId", "1");
    sheet.setAttribute("r:id", id);

    const root = worksheetPart.rootElement!;
    const sheetData = root.element("sheetData") ?? root.appendChild(new OxmlElement("sheetData"));
    sheetData.removeAllChildren();

    const headerRow = sheetData.appendChild(new OxmlElement("row"));
    headerRow.setAttribute("r", "1");
    headers.forEach((h, i) => {
        const c = headerRow.appendChild(new OxmlElement("c"));
        c.setAttribute("r", colName(i) + "1");
        c.setAttribute("s", String(HEADER_STYLE));
        c.setAttribute("t", "inlineStr");
        c.appendChild(new OxmlElement("is")).appendChild(new OxmlElement("t")).appendChild(new OxmlText(h));
    });

    const sampleRow = sheetData.appendChild(new OxmlElement("row"));
    sampleRow.setAttribute("r", "2");
    headers.forEach((_, i) => {
        const c = sampleRow.appendChild(new OxmlElement("c"));
        c.setAttribute("r", colName(i) + "2");
        c.setAttribute("s", String(SAMPLE_STYLE));
    });

    if (withPivot) {
        // Written as TEXT, not built as an element tree: `XmlElement.toString()` is the DEBUG form
        // (`<name>`), so a tree stringified into a part would be malformed XML — which is exactly the
        // shape a first version of this probe wrote, and it read back as a pivot cache with no source.
        const pivotXml = [
            `<?xml version="1.0" encoding="UTF-8"?>`,
            `<pivotCacheDefinition xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"`,
            ` refreshOnLoad="0" saveData="1">`,
            `<cacheSource type="worksheet"><worksheetSource sheet="Data" ref="A1:B2"/></cacheSource>`,
            `</pivotCacheDefinition>`,
        ].join("");

        pkg.addPart("/xl/pivotCache/pivotCacheDefinition1.xml",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotCacheDefinition+xml",
            new TextEncoder().encode(pivotXml));
    }

    return pkg.save();
}

function worksheet(pkg: OxmlPackage): OxmlElement {
    return pkg.mainPart.partsOfType(
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet")[0]!.rootElement!;
}

function cellString(cell: OxmlElement): string {
    return cell.element("is")?.innerText ?? cell.element("v")?.innerText ?? "";
}

function colName(index0: number): string {
    return String.fromCharCode("A".charCodeAt(0) + index0);
}

void main();
