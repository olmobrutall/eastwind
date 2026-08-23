# Module port status — Signum extensions → altea packages

Snapshot of the extension-by-extension port state, as of 2026-08-23.

`old/Framework/Extensions/` holds **55** Signum extension projects (+ `Signum.Extensions.Test`, the shared
suite). `altea/` holds **44** extension packages (+ `altea/altea` core, `quote-transformer`,
`quote-transformer-test`).

Counts: **46 ported**, **2 partial**, **3 deferred by design**, **7 pending** — of which **1 is started by
`Southwind/Starter.cs`** and so blocks eastwind parity.

LOC = `.cs` + `.ts` + `.tsx` lines still in `old/`, as a rough size signal only.

---

## Ported

| Signum extension | altea package | Notes |
| --- | --- | --- |
| Signum.Agent | `altea-agent` | 3 missing .NET substrates hand-built (`IChatClient`; 7 providers → 3 wire protocols); tools DECLARED, not reflected |
| Signum.Alerts | `altea-alert` | AlertType is a plain Symbol (altea has no SemiSymbol); Title/Text are stored columns |
| Signum.Authorization | `altea-auth` | UserTicket cookie login + SessionLog left as no-op seams |
| Signum.Authorization.AzureAD | `altea-auth-azuread` | `Microsoft.Graph` → plain REST |
| Signum.Authorization.OpenID | `altea-auth-openid` | discovery cache + `jose` over a locally fetched JWKS |
| Signum.Authorization.ResetPassword | `altea-auth-reset-password` | |
| Signum.Authorization.WindowsAD | `altea-auth-windowsad` | LDAP via `ldapts`; SPNEGO/Kerberos is an injected seam (no SSPI on Node) |
| Signum.Caching | `altea-cache` | row tuples + completer; SqlDependency → PG LISTEN/NOTIFY or HTTP broadcast |
| Signum.Chart | `altea-chart` | 19 chart types; Google Maps chart scripts skipped (Southwind disables them too) |
| Signum.CodeMirror | `altea-codemirror` | CM5 → CM6; client-only; adds `MarkdownCodeMirror` |
| Signum.ConcurrentUser | `altea-concurrent-user` | SignalR → the core WebSocket hub |
| Signum.Dashboard | `altea-dashboard` | `CachedQueryEntity` + `RegenerateCachedQueries` deferred |
| Signum.DiffLog | `altea-diff-log` | `registerWhenAlreadyFilteringBy` + the auditor-token registry unported |
| Signum.Eval | `altea-eval` | `EvalEmbedded<F>` = stored TypeScript; TypeHelp + the EvalPanel page unported |
| Signum.Files | `altea-files` | |
| Signum.Files.AzureBlobs | `altea-files-azure` | refuses `renameAlgorithm` and `readAllBytesSync` |
| Signum.Files.S3 | `altea-files-s3` | idem; SigV4 presigning is async, so `presignedUrl()` not `fullWebPath()` |
| Signum.Help | `altea-help` | prose auto-generated from reflection; no PropertyRouteEntity (route strings); query columns are root sub-TOKENS; the dead `HelpSearch` is wired up; no interactive console import |
| Signum.HtmlEditor | `altea-html-editor` | Lexical pinned to Signum's exact 0.45 |
| Signum.Mailing | `altea-email` | incl. Signum.Mailing's Reception half |
| Signum.Mailing.ExchangeWS | `altea-mailing-exchange` | hand-built SOAP; no Autodiscover SCP/DNS-SRV, no TNEF, no integrated auth |
| Signum.Mailing.MicrosoftGraph | `altea-mailing-microsoft-graph` | incl. the RemoteEmails half |
| Signum.Mailing.Pop3 | `altea-mailing-pop3` | ~200 lines over `node:tls` + `mailparser` |
| Signum.Map | `altea-map` | owns no tables; forced `Graph.GetState` → `Quoted` + a transformer fix; no MList half, no `fromToStates`, one state machine per map |
| Signum.Migrations | `altea-migrations` | |
| Signum.Omnibox | `altea-omnibox` | |
| Signum.Playwright | `altea-playwright` | CDP debug launcher + 5 line proxies + 4 panel proxies unported |
| Signum.Processes | `altea-processes` | PackageOperation contextual menu unported |
| Signum.Profiler | `altea-profiler` | |
| Signum.Rest | `altea-rest` | Signum's MVC action filter becomes Express middleware mounted on a path prefix; a logged `?apiKey=` is redacted; no Swagger, no DeleteLogs |
| Signum.Scheduler | `altea-scheduler` | in-process `setTimeout` runner; owns `HolidayCalendar` |
| Signum.SMS | `altea-sms` | structurally a small sibling of `altea-email`; the GSM-alphabet length rules carry their own suite (Signum's UCS-2 budget of 60 corrected to 70); no `SendAsyncSMS`, no DeleteLogs, no package NumLines/NumErrors columns |
| Signum.Templating | `altea-templating` | the Roslyn Eval becomes `TemplateApplicableSymbol` |
| Signum.TimeMachine | `altea-time-machine` | |
| Signum.Toolbar | `altea-toolbar` | |
| Signum.Tour | `altea-tour` | |
| Signum.Translation | `altea-translations` | both halves; `countLocalizationHits` + the two terminal commands unported |
| Signum.Tree | `altea-tree` | `SqlHierarchyId` → a textual route + TypeScript arithmetic; the depth-first ORDER is computed in memory; `DisabledMixin` not ported |
| Signum.ViewLog | `altea-view-log` | three new core seams (`ExecutionMode.onApiRetrieved`, `queryExecuted`, `Connector.withSqlCapture`); the SQL sink is async-local, not a global logger swap; the other modules report through the seam rather than depending on this one |
| Signum.UserAssets | `altea-user-assets` | |
| Signum.UserQueries | `altea-user-queries` | |
| Signum.Word | `altea-office-template` | docx/pptx/xlsx; `Word*` → `Office*` rename |
| Signum.Workflow | `altea-workflow` | no `MyActiveAlerts`, no `PackageExecuteAlgorithm<T>` |
| Signum.Extensions.Test | *(each package's own `test/`)* | altea keeps a suite inside the package it tests |

## Partial

| Signum extension | altea package | What is missing | Southwind starts it |
| --- | --- | --- | --- |
| Signum.Dynamic | `altea-dynamic` | Only the **interpreted** half is ported (DynamicView / ViewOverride / ViewSelector, DynamicCSSOverride, DynamicSqlMigration). The **compiled** half — `DynamicType`, `DynamicExpression`, `DynamicValidation`, `DynamicApi`, `DynamicTypeCondition`, `DynamicMixinConnection`, `DynamicIsolation` — generates C# and Roslyn-compiles it. The blocker is not the compiler but that altea's entity model is stamped at BUILD time by the quote-transformer, so a runtime-invented type needs the transformer over generated source + a process restart + a schema sync. | yes (`DynamicLogicStarter`) |
| Signum.Excel | `altea-office-template` | `PlainExcelGenerator` + `ImporterFromExcel` are ported. `ExcelReportEntity` (a stored .xlsx template filled by column-NAME matching) is deliberately superseded by altea-office-template's `@[Token]` engine. `ExcelAttachmentEntity` (a UserQuery exported to .xlsx as an email attachment) has no counterpart yet. | yes (`excelReport: true`) |

## Deferred by design — not to be ported

| Signum extension | What it is | LOC | Why |
| --- | --- | --- | --- |
| Signum.Selenium | the pre-Playwright e2e driver | 4 597 | superseded by Signum.Playwright **inside Signum itself**; `altea-playwright` is the port |
| Signum.MachineLearning | `PredictorEntity`, neural-net training / prediction over CNTK / TensorFlow | 5 988 | no substrate on Node, and hosting a training runtime is out of altea's scope. Southwind's SalesEstimation panel is dropped with it (noted in `eastwind/products/Product.tsx`) |
| Signum.Notes | `NoteEntity` — free-text notes attached to any entity, plus the frame widget | 289 | out of scope for the demo app |

## Pending

**Next up: Signum.Markdown.** (Signum.Map, Signum.Help, Signum.Tree, Signum.Rest, Signum.ViewLog and Signum.SMS are done — see Ported.)

| # | Signum extension | What it is | LOC | Southwind starts it |
| --- | --- | --- | --- | --- |
| 1 | Signum.Markdown | `MarkdownLine` + the server markdown→html renderer | 189 | yes — the EDITOR half already stands in as `altea-codemirror`'s `MarkdownCodeMirror` |
| 2 | Signum.Isolation | multi-tenant row isolation: `IsolationEntity`, the ambient query filter, the navbar picker | 718 | no (referenced only) |
| 3 | Signum.WhatsNew | release-notes entity, navbar dropdown, per-user read log | 1 292 | no |
| 4 | Signum.Printing | `PrintLineEntity` print queue + admin panel | 633 | no |
| 5 | Signum.Calendar | `CalendarDayEntity` — a working-days table | 72 | no |
| 6 | Signum.WorkflowDynamic | glues Signum.Workflow to the **compiled** Dynamic half | 197 | via `DynamicLogicStarter` — blocked on Signum.Dynamic's compiled half |
| 7 | Signum.Playwright.Workflow | `CaseFrame` page / modal proxies for the workflow UI | 169 | test-only |

## Adjacent gaps (not extension projects)

Pieces `Southwind/Starter.cs` starts that live in Signum core rather than in an extension:

| Signum piece | altea state |
| --- | --- |
| `VisualTipLogic` | ported into core (`altea/client/Basics/VisualTipIcon`, `SearchControlVisualTips`) |
| `ChangeLogLogic` | ported into core |
| `SystemEventLogLogic` | ported |
| `SessionLogLogic` | **no-op seam** in `altea-auth/server/AuthServer.ts` |
| `UserTicketLogic` | **deferred seam** — `AuthClient.registerUserTicketAuthenticator` is a stub (no cookie plumbing) |
| `TokenMigrationLogic` | ported (`altea-migrations`) |
