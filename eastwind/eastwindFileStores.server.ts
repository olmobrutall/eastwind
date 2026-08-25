import * as path from "node:path";
import { FileTypeAlgorithm, type IFileTypeAlgorithm } from "@altea/altea-files/server/FileTypeAlgorithm.server";
import {
    AzureBlobStorageFileTypeAlgorithm, AzureWebDownload,
} from "@altea/altea-files-azure/server/AzureBlobStorageFileTypeAlgorithm";
import {
    AzureBlobStorage, type AzureBlobStorageConfiguration,
} from "@altea/altea-files-azure/server/AzureBlobStorageConfiguration";
import { S3FileTypeAlgorithm, S3WebDownload } from "@altea/altea-files-s3/server/S3FileTypeAlgorithm";
import { S3Storage, resolveEndpoint, type S3Configuration } from "@altea/altea-files-s3/server/S3Configuration";

// eastwind's side of the file-storage modules — Signum's `Starter.GetFileTypeAlgorithm(p => p.Folders.X)`,
// which Southwind also keeps in its own Starter.
//
// What is app code and what is not:
//  - the BACKEND choice and its credentials are the app's, and they live in the environment exactly where
//    Southwind keeps them (`azureStorageConnectionString` is a `Starter.Start` parameter fed from
//    appsettings.json, never a member of the configuration entity);
//  - WHERE a local store writes is derived from the store's NAME (`./files/<name>`) rather than configured
//    — see the divergence note in globals/ApplicationConfiguration.data.ts;
//  - CONNECTING to Azure / S3 is the MODULE's business — `AzureBlobStorage` / `S3Storage` cache the client
//    and hold the container / bucket naming rules, so this file only names the store and the prefix.
//
//   EASTWIND_FILE_STORE=folder    (default) — a local folder per store
//   EASTWIND_FILE_STORE=azure               — one Azure Blob container per store
//   EASTWIND_FILE_STORE=s3                  — one S3 bucket (or key prefix) per store
//
// Azure needs EASTWIND_AZURE_STORAGE_CONNECTION_STRING — one credential, one variable (the module also
// accepts an account + key pair, which eastwind does not use); S3 needs EASTWIND_S3_ENDPOINT / _ACCESS_KEY / _SECRET_KEY
// (a local MinIO — see @altea/altea-files-s3's docker-compose.yml.example) or an AWS region + credentials.
// NEVER commit real values: they belong in eastwind/.env.postgres, like the connection string.

export type FileStoreKind = "folder" | "azure" | "s3";

export namespace EastwindFileStores {

    /** The prefix eastwind's containers / buckets are named with. */
    const prefix = "eastwind";

    /** The root every LOCAL store writes under; each store gets `<filesRoot>/<its name>`. */
    const filesRoot = "./files";

    export function kind(): FileStoreKind {
        const value = (process.env["EASTWIND_FILE_STORE"] ?? "folder").toLowerCase();
        if (value === "folder" || value === "azure" || value === "s3")
            return value;

        throw new Error(`EASTWIND_FILE_STORE='${value}' is not one of folder / azure / s3`);
    }

    /**
     * The algorithm for one named store. The NAME is the whole address: the local folder under `filesRoot`,
     * the Azure container, and the S3 bucket / key prefix — where Signum passes a configuration selector
     * (`p => p.Folders.CachedQueryFolder`), and only for the local case. `onlyImages` / `maxSizeInBytes` are
     * the policy knobs every backend shares.
     *
     * Which is why the name is KEBAB-CASE and checked: an Azure container / S3 bucket accepts only
     * lower-case letters, digits and hyphens (3-63 characters, no leading or trailing one). `containerNameOf`
     * / `bucketNameOf` would silently normalise "emailAttachments" into "email-attachments", so the name a
     * store is registered under would not be the name its bytes live under. Southwind hits the same rule
     * head-on — it passes the configured folder STRAIGHT to `new BlobContainerClient(conn, folder)`, so its
     * value has to be written "email-attachments" by hand.
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
                });

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
                });

            default:
                return new FileTypeAlgorithm({
                    physicalPrefix: () => path.join(filesRoot, name),
                    ...options,
                });
        }
    }

    function azureConfiguration(): AzureBlobStorageConfiguration {
        return {
            connectionString: process.env["EASTWIND_AZURE_STORAGE_CONNECTION_STRING"] ?? null,
        };
    }

    function s3Configuration(): S3Configuration {
        return {
            endpoint: process.env["EASTWIND_S3_ENDPOINT"] ?? null,
            accessKey: process.env["EASTWIND_S3_ACCESS_KEY"] ?? null,
            secretKey: process.env["EASTWIND_S3_SECRET_KEY"] ?? null,
            region: process.env["EASTWIND_S3_REGION"] ?? null,
            sharedBucketName: process.env["EASTWIND_S3_BUCKET"] ?? null,
            forcePathStyle: process.env["EASTWIND_S3_FORCE_PATH_STYLE"] !== "false",
        };
    }
}
