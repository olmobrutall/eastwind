import { BlobServiceClient, StorageSharedKeyCredential, type ContainerClient } from "@azure/storage-blob";
import { FileTypeAlgorithm, type IFileTypeAlgorithm } from "@altea/altea-files/server/FileTypeAlgorithm.server";
import {
    AzureBlobStorageFileTypeAlgorithm, AzureWebDownload,
} from "@altea/altea-files-azure/server/AzureBlobStorageFileTypeAlgorithm";
import { S3FileTypeAlgorithm, S3WebDownload } from "@altea/altea-files-s3/server/S3FileTypeAlgorithm";
import { toS3Client, resolveEndpoint, type S3Configuration } from "@altea/altea-files-s3/server/S3Configuration";
import type { S3Client } from "@aws-sdk/client-s3";

// eastwind's side of the file-storage modules: WHICH backend a file store uses.
//
// Southwind only ever configures the local folder (`new FileTypeAlgorithm { GetPhisicalPrefix = … }`); the
// Azure / S3 packages exist for a deployment that cannot keep files on the app server. eastwind picks between
// them with ONE environment variable, the same shape `EASTWIND_AD_PROVIDER` uses for the directory modules:
//
//   EASTWIND_FILE_STORE=folder    (default) — a local folder per store
//   EASTWIND_FILE_STORE=azure               — one Azure Blob container per store
//   EASTWIND_FILE_STORE=s3                  — one S3 bucket (or key prefix) per store
//
// Azure needs EASTWIND_AZURE_STORAGE_ACCOUNT + EASTWIND_AZURE_STORAGE_KEY (or
// EASTWIND_AZURE_STORAGE_CONNECTION_STRING); S3 needs EASTWIND_S3_ENDPOINT / _ACCESS_KEY / _SECRET_KEY
// (a local MinIO — see @altea/altea-files-s3's docker-compose.yml.example) or an AWS region + credentials.
// NEVER commit real values: they belong in eastwind/.env.postgres, like the connection string.
//
// A store is named by its `name` (the FileTypeSymbol's short name), which becomes the folder, the container
// or the bucket / key prefix — so the three backends address the same logical stores.

export type FileStoreKind = "folder" | "azure" | "s3";

export namespace EastwindFileStores {

    export function kind(): FileStoreKind {
        const value = (process.env["EASTWIND_FILE_STORE"] ?? "folder").toLowerCase();
        if (value === "folder" || value === "azure" || value === "s3")
            return value;

        throw new Error(`EASTWIND_FILE_STORE='${value}' is not one of folder / azure / s3`);
    }

    /**
     * The algorithm for one named store. `folder` is the local path (and the container / bucket name);
     * `onlyImages` / `maxSizeInBytes` are the policy knobs every backend shares.
     */
    export function store(name: string, options?: { onlyImages?: boolean; maxSizeInBytes?: number | null }): IFileTypeAlgorithm {
        switch (kind()) {
            case "azure":
                return new AzureBlobStorageFileTypeAlgorithm({
                    // One container per store, created on first write so a fresh account needs no setup.
                    getClient: () => azureContainer(name),
                    createBlobContainerIfNotExists: true,
                    // The download still goes through altea's own owner-addressed route (which is what
                    // enforces type / row authorization), so no public URL is handed out.
                    webDownload: () => AzureWebDownload.None,
                    ...options,
                });

            case "s3":
                return new S3FileTypeAlgorithm({
                    client: s3Client(),
                    endpoint: resolveEndpoint(s3Configuration()),
                    sharedBucketName: process.env["EASTWIND_S3_BUCKET"] ?? null,
                    // With a shared bucket this is the key PREFIX; without one it IS the bucket name.
                    getBucketNameOrSubDirectory: () => bucketNameOf(name),
                    createBucketIfNotExists: true,
                    webDownload: () => S3WebDownload.None,
                    ...options,
                });

            default:
                return new FileTypeAlgorithm({
                    physicalPrefix: () => process.env[folderVariable(name)] ?? `./files/${name}`,
                    ...options,
                });
        }
    }

    /** The env var that overrides one store's local folder (`EASTWIND_FILES_EMAILATTACHMENTS`, …). */
    function folderVariable(name: string): string {
        return "EASTWIND_FILES_" + name.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    }

    // Azure Blob / S3 buckets accept only lower-case letters, digits and hyphens.
    function bucketNameOf(name: string): string {
        return "eastwind-" + name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[^A-Za-z0-9]/g, "-").toLowerCase();
    }

    // ---- Azure ------------------------------------------------------------------------------------------

    let blobService: BlobServiceClient | undefined;
    const containers = new Map<string, ContainerClient>();

    function azureContainer(name: string): ContainerClient {
        let container = containers.get(name);
        if (container == undefined) {
            container = azureBlobService().getContainerClient(bucketNameOf(name));
            containers.set(name, container);
        }
        return container;
    }

    function azureBlobService(): BlobServiceClient {
        if (blobService != undefined)
            return blobService;

        const connectionString = process.env["EASTWIND_AZURE_STORAGE_CONNECTION_STRING"];
        if (connectionString)
            return blobService = BlobServiceClient.fromConnectionString(connectionString);

        const account = process.env["EASTWIND_AZURE_STORAGE_ACCOUNT"];
        const key = process.env["EASTWIND_AZURE_STORAGE_KEY"];
        if (!account || !key)
            throw new Error("EASTWIND_FILE_STORE=azure needs EASTWIND_AZURE_STORAGE_ACCOUNT +"
                + " EASTWIND_AZURE_STORAGE_KEY (or EASTWIND_AZURE_STORAGE_CONNECTION_STRING).");

        return blobService = new BlobServiceClient(
            `https://${account}.blob.core.windows.net`,
            new StorageSharedKeyCredential(account, key));
    }

    // ---- S3 ---------------------------------------------------------------------------------------------

    let s3: S3Client | undefined;

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

    function s3Client(): S3Client {
        if (s3 != undefined)
            return s3;

        const client = toS3Client(s3Configuration());
        if (client == null)
            throw new Error("EASTWIND_FILE_STORE=s3 needs EASTWIND_S3_ACCESS_KEY + EASTWIND_S3_SECRET_KEY"
                + " (and EASTWIND_S3_ENDPOINT for a non-AWS server such as MinIO).");

        return s3 = client;
    }
}
