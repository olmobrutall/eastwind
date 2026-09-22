import * as path from "node:path";
import { FileTypeAlgorithm, type IFileTypeAlgorithm } from "@altea/altea-files/server/FileTypeAlgorithm";
import { AzureBlobStorageFileTypeAlgorithm, AzureWebDownload } from "@altea/altea-files-azure/server/AzureBlobStorageFileTypeAlgorithm";
import { AzureBlobStorage, type AzureBlobStorageConfiguration } from "@altea/altea-files-azure/server/AzureBlobStorageConfiguration";
import { S3FileTypeAlgorithm, S3WebDownload } from "@altea/altea-files-s3/server/S3FileTypeAlgorithm";
import { S3Storage, resolveEndpoint, type S3Configuration } from "@altea/altea-files-s3/server/S3Configuration";

// eastwind's side of the file-storage modules: which backend holds the bytes, and where each named store
// puts them.
//
// What is app code and what is not:
//  - the BACKEND choice and its credentials are the app's, and they live in the environment: a store is
//    registered while the schema is BUILT, before any configuration row can be read;
//  - WHERE a local store writes is derived from the store's NAME (`<root>/<name>`) rather than configured
//    per store, so the paths cannot drift from the code that names the stores. Only the ROOT is a
//    variable (EASTWIND_FILE_STORE_ROOT, default `./files`) — see `filesRoot`;
//  - CONNECTING to Azure / S3 is the MODULE's business — `AzureBlobStorage` / `S3Storage` cache the client
//    and hold the container / bucket naming rules, so this file only names the store and the prefix.
//
//   EASTWIND_FILE_STORE=folder    (default) — a local folder per store
//   EASTWIND_FILE_STORE=azure               — one Azure Blob container per store
//   EASTWIND_FILE_STORE=s3                  — one S3 bucket (or key prefix) per store
//   EASTWIND_FILE_STORE_ROOT=./files        — where the local folders live (see `filesRoot`)
//
// Azure needs EASTWIND_AZURE_STORAGE_CONNECTION_STRING — one credential, one variable (the module also
// accepts an account + key pair, which eastwind does not use); S3 needs EASTWIND_S3_ENDPOINT / _ACCESS_KEY / _SECRET_KEY
// (a local MinIO — see @altea/altea-files-s3's docker-compose.yml.example) or an AWS region + credentials.
// NEVER commit real values: they belong in an untracked eastwind/.env.<environment>, like the
// connection string.

// The backends this application can point a store at. One line each, because removing a cloud backend is
// removing its line — the type, the check and the error message all read from here.
const STORE_KINDS = [
    "folder",
    "azure",//AzureKind
    "s3",//S3Kind
] as const;

export type FileStoreKind = typeof STORE_KINDS[number];

export namespace EastwindFileStores {

    /** The prefix eastwind's containers / buckets are named with. */
    const prefix = "eastwind";

    /**
     * The root every LOCAL store writes under; each store gets `<filesRoot>/<its folder>`.
     *
     * Configurable for ONE reason: LegacyMode points this application at another deployment's FILES as
     * well as its database, and every file-backed row holds a suffix relative to whatever root that
     * deployment used. Without it a diff-log dump, an exception stack trace or a received e-mail's raw
     * MIME is simply not there, and the retrieve of that row FAILS (`ENOENT` out of BigStringLogic's
     * File-mode read), which takes the entity page and every contextual menu with it.
     *
     *   EASTWIND_FILE_STORE_ROOT=c:/LegacyFiles
     */
    function filesRoot(): string {
        return process.env["EASTWIND_FILE_STORE_ROOT"] ?? "./files";
    }

    /**
     * The folder a store's bytes live in on a LEGACY deployment, for a store this application spells
     * differently — an escape hatch for a port whose folder names cannot be adopted wholesale.
     *
     * Empty here: every store is named for the folder the legacy deployment already uses, so nothing
     * needs mapping. Applied only in LEGACY mode and only to a LOCAL store — an Azure container / S3
     * bucket is named `${prefix}-${name}` and has no counterpart in a legacy deployment's cloud
     * configuration.
     */
    const legacyFolders: Record<string, string> = {};

    /** LegacyMode, read here for the same reason `kind()` reads its own variable — see {@link filesRoot}. */
    function legacy(): boolean {
        const v = process.env["LegacyMode"]?.trim().toLowerCase();
        return v === "true" || v === "1";
    }

    export function kind(): FileStoreKind {
        const value = (process.env["EASTWIND_FILE_STORE"] ?? "folder").toLowerCase();
        if ((STORE_KINDS as readonly string[]).includes(value))
            return value as FileStoreKind;

        throw new Error(`EASTWIND_FILE_STORE='${value}' is not one of ${STORE_KINDS.join(" / ")}`);
    }

    /**
     * The algorithm for one named store. The NAME is the whole address: the local folder under `filesRoot`,
     * the Azure container, and the S3 bucket / key prefix. `onlyImages` / `maxSizeInBytes` are the policy
     * knobs every backend shares.
     *
     * Which is why the name is KEBAB-CASE and checked: an Azure container / S3 bucket accepts only
     * lower-case letters, digits and hyphens (3-63 characters, no leading or trailing one). `containerNameOf`
     * / `bucketNameOf` would silently normalise "emailAttachments" into "email-attachments", so the name a
     * store is registered under would not be the name its bytes live under.
     */
    export function store(
        name: string,
        options?: { onlyImages?: boolean; maxSizeInBytes?: number | null },
    ): IFileTypeAlgorithm {
        // 54 = 63 (the container / bucket limit) minus `${prefix}-`.
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || name.length < 3 || name.length > 54)
            throw new Error(`EastwindFileStores.store('${name}'): a store name is lower-case letters, digits`
                + " and single hyphens, 3-54 characters — it is used verbatim as an Azure container / S3"
                + " bucket name.");

        switch (kind()) {
            case "azure":
                return new AzureBlobStorageFileTypeAlgorithm({
                    // One container per store, created on first write so a fresh account needs no setup.
                    getClient: () => AzureBlobStorage.container(azureConfiguration(),
                        AzureBlobStorage.containerNameOf(name, prefix)),
                    createBlobContainerIfNotExists: true,
                    // The download still goes through altea's own owner-addressed route (which is what
                    // enforces type / row authorization), so no public URL is handed out.
                    webDownload: () => AzureWebDownload.None,
                    ...options,
                });//AzureStore

            case "s3":
                return new S3FileTypeAlgorithm({
                    client: S3Storage.client(s3Configuration()),
                    endpoint: resolveEndpoint(s3Configuration()),
                    sharedBucketName: process.env["EASTWIND_S3_BUCKET"] ?? null,
                    // With a shared bucket this is the key PREFIX; without one it IS the bucket name.
                    getBucketNameOrSubDirectory: () => S3Storage.bucketNameOf(name, prefix),
                    createBucketIfNotExists: true,
                    webDownload: () => S3WebDownload.None,
                    ...options,
                });//S3Store

            default:
                return new FileTypeAlgorithm({
                    physicalPrefix: () => path.join(filesRoot(),
                        legacy() ? legacyFolders[name] ?? name : name),
                    ...options,
                });
        }
    }

    function azureConfiguration(): AzureBlobStorageConfiguration {
        return {
            connectionString: process.env["EASTWIND_AZURE_STORAGE_CONNECTION_STRING"] ?? null,
        };
    }//AzureConfiguration

    function s3Configuration(): S3Configuration {
        return {
            endpoint: process.env["EASTWIND_S3_ENDPOINT"] ?? null,
            accessKey: process.env["EASTWIND_S3_ACCESS_KEY"] ?? null,
            secretKey: process.env["EASTWIND_S3_SECRET_KEY"] ?? null,
            region: process.env["EASTWIND_S3_REGION"] ?? null,
            sharedBucketName: process.env["EASTWIND_S3_BUCKET"] ?? null,
            forcePathStyle: process.env["EASTWIND_S3_FORCE_PATH_STYLE"] !== "false",
        };
    }//S3Configuration
}
