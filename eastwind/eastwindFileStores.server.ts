import { FileTypeAlgorithm, type IFileTypeAlgorithm } from "@altea/altea-files/server/FileTypeAlgorithm.server";
import {
    AzureBlobStorageFileTypeAlgorithm, AzureWebDownload,
} from "@altea/altea-files-azure/server/AzureBlobStorageFileTypeAlgorithm";
import {
    AzureBlobStorage, type AzureBlobStorageConfiguration,
} from "@altea/altea-files-azure/server/AzureBlobStorageConfiguration";
import { S3FileTypeAlgorithm, S3WebDownload } from "@altea/altea-files-s3/server/S3FileTypeAlgorithm";
import { S3Storage, resolveEndpoint, type S3Configuration } from "@altea/altea-files-s3/server/S3Configuration";
import { GlobalsLogic } from "./globals/GlobalsLogic.server";
import type { FoldersConfigurationEmbedded } from "./globals/ApplicationConfiguration.data";

// eastwind's side of the file-storage modules — Signum's `Starter.GetFileTypeAlgorithm(p => p.Folders.X)`,
// which Southwind also keeps in its own Starter.
//
// What is app code and what is not:
//  - the BACKEND choice and its credentials are the app's, and they live in the environment exactly where
//    Southwind keeps them (`azureStorageConnectionString` is a `Starter.Start` parameter fed from
//    appsettings.json, never a member of the configuration entity);
//  - WHERE a local store writes is the ApplicationConfiguration's `Folders` member, read on every write;
//  - CONNECTING to Azure / S3 is the MODULE's business — `AzureBlobStorage` / `S3Storage` cache the client
//    and hold the container / bucket naming rules, so this file only names the store and the prefix.
//
//   EASTWIND_FILE_STORE=folder    (default) — a local folder per store
//   EASTWIND_FILE_STORE=azure               — one Azure Blob container per store
//   EASTWIND_FILE_STORE=s3                  — one S3 bucket (or key prefix) per store
//
// Azure needs EASTWIND_AZURE_STORAGE_ACCOUNT + EASTWIND_AZURE_STORAGE_KEY (or
// EASTWIND_AZURE_STORAGE_CONNECTION_STRING); S3 needs EASTWIND_S3_ENDPOINT / _ACCESS_KEY / _SECRET_KEY
// (a local MinIO — see @altea/altea-files-s3's docker-compose.yml.example) or an AWS region + credentials.
// NEVER commit real values: they belong in eastwind/.env.postgres, like the connection string.

export type FileStoreKind = "folder" | "azure" | "s3";

export namespace EastwindFileStores {

    /** The prefix eastwind's containers / buckets are named with. */
    const prefix = "eastwind";

    export function kind(): FileStoreKind {
        const value = (process.env["EASTWIND_FILE_STORE"] ?? "folder").toLowerCase();
        if (value === "folder" || value === "azure" || value === "s3")
            return value;

        throw new Error(`EASTWIND_FILE_STORE='${value}' is not one of folder / azure / s3`);
    }

    /**
     * The algorithm for one named store. `folder` selects this store's folder off the configuration's
     * `Folders` member (Signum's `p => p.Folders.CachedQueryFolder`) and is READ ON EVERY WRITE, so editing
     * it takes effect immediately; `onlyImages` / `maxSizeInBytes` are the policy knobs every backend shares.
     */
    export function store(
        name: string,
        folder: (f: FoldersConfigurationEmbedded) => string,
        options?: { onlyImages?: boolean; maxSizeInBytes?: number | null },
    ): IFileTypeAlgorithm {
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
                    physicalPrefix: () => folder(GlobalsLogic.configuration().folders),
                    ...options,
                });
        }
    }

    function azureConfiguration(): AzureBlobStorageConfiguration {
        return {
            connectionString: process.env["EASTWIND_AZURE_STORAGE_CONNECTION_STRING"] ?? null,
            accountName: process.env["EASTWIND_AZURE_STORAGE_ACCOUNT"] ?? null,
            accountKey: process.env["EASTWIND_AZURE_STORAGE_KEY"] ?? null,
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
