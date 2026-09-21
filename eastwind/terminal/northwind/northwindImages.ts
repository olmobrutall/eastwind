import * as fs from "node:fs";
import * as path from "node:path";
import { FileEmbedded, FileEntity } from "@altea/altea-files/data/Files";
import { terminalFile } from "../terminalFile";

// The Northwind demo IMAGES, as files on disk beside this module.
//
// Northwind ships a category picture and an employee photo as an OLE-wrapped bitmap inside the source
// database, and that is the one place the two vendor scripts genuinely disagree: the SQL Server script
// carries them as ~700 KB of `0x…` hex literals, while the Postgres dump carries `'\x'` (empty) for every
// row. So the seed drops those two columns entirely (see northwindSeed.ts) and the loaders read the
// pictures from these two folders instead — the same bytes on both dialects, and a modern PNG/JPEG rather
// than a 1994 bitmap behind a 78-byte OLE header.
//
// Lookup is by BASE NAME with the extension discovered from the directory: these are art assets, and
// swapping a .png set for a .jpg one must not need a code change. A missing file is NOT an error — the
// loader leaves the field null and says so, so a checkout without the (large, binary) folders still loads.
export namespace NorthwindImages {

    /** `image_categories/<CategoryName>.<ext>` — Northwind's "Grains/Cereals" is the file "Grains-Cereals". */
    export function category(categoryName: string): FileEmbedded | null {
        return read("image_categories", sanitize(categoryName));
    }

    /** `image_photos/<FirstName> <LastName>.<ext>` — Northwind's own employee names, verbatim. A
     *  FileEntity (a row), because that is what EmployeeEntity.photo references; a category picture is
     *  a FileEmbedded. */
    export function employeePhoto(firstName: string, lastName: string): FileEntity | null {
        const bytes = readBytes("image_photos", sanitize(`${firstName} ${lastName}`));
        return bytes == null ? null : FileEntity.create({ fileName: bytes.fileName, binaryFile: bytes.binaryFile });
    }

    // A category name may hold a slash ("Grains/Cereals", "Meat/Poultry"), which no file system accepts.
    // ONE mechanical rule — slash becomes a hyphen — so the folder stays readable and needs no lookup table.
    function sanitize(name: string): string {
        return name.replace(/\//g, "-");
    }

    const dirCache = new Map<string, Map<string, string>>();

    // Base name (lower-cased) → full path, for one folder. Read once per folder per process.
    function index(folder: string): Map<string, string> {
        let files = dirCache.get(folder);
        if (files == null) {
            files = new Map();
            const dir = terminalFile("northwind", folder);
            if (fs.existsSync(dir))
                for (const name of fs.readdirSync(dir))
                    files.set(path.parse(name).name.toLowerCase(), path.join(dir, name));
            else
                console.log(`  [images] no ${folder}/ folder at ${dir}`);
            dirCache.set(folder, files);
        }
        return files;
    }

    function read(folder: string, baseName: string): FileEmbedded | null {
        const bytes = readBytes(folder, baseName);
        return bytes == null ? null : FileEmbedded.create(bytes);
    }

    /** The bytes and the name, before either file shape wraps them. */
    function readBytes(folder: string, baseName: string): { fileName: string; binaryFile: Uint8Array } | null {
        const file = index(folder).get(baseName.toLowerCase());
        if (file == null) {
            console.log(`  [images] no ${folder}/${baseName}.* — leaving it empty`);
            return null;
        }
        return { fileName: path.basename(file), binaryFile: fs.readFileSync(file) };
    }
}
