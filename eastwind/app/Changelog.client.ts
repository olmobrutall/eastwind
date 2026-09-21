import type { ChangeLogDic } from "@altea/altea/client/Basics/ChangeLogClient";

// eastwind's own change log, registered as the MAIN one by `ChangeLogClient.start` in MainAdmin.
//
// This is the APPLICATION's deployment timeline, so its dates are DEPLOY dates. A line reading
// `Update Altea` (optionally `Update Altea to <date>`) is not shown as written: the merge replaces it with
// the framework entries implemented before that date, so they appear under the deployment that actually
// shipped them. See `ChangeLogClient.getChangeLogs`.
export default {
    "2026-09-04": [
        "Add the change log",
        "Update Altea",
    ],
} as ChangeLogDic;
