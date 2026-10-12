# eastwind

**A demo line-of-business application on the [altea](altea/README.md) framework** — altea's counterpart to
Signum's [Southwind](https://github.com/signumsoftware/southwind), and the template a new altea
application is cloned from.

It carries Northwind's schema and its data: Orders and OrderLines, Customers (`Person` / `Company` under an
abstract `CustomerEntity`), Products with Categories and Suppliers, Employees, Shippers — about 830 orders
once loaded. Around that sits most of what altea ships: authentication and per-role authorization,
dashboards, charts, user queries, a toolbar, mail, SMS, processes, scheduled tasks, an office-template
engine, a workflow, a chatbot agent, caching and a REST surface.

```
altea/       the framework, as a git submodule — ~50 workspace packages
eastwind/    this application
old/         Signum + Southwind, read-only — the sources this was ported from
```

- **Conventions** for writing altea code: [`altea/AGENTS.md`](altea/AGENTS.md).
- **This application's own layout and commands**: [`AGENTS.md`](AGENTS.md).
- **What it carries only because it was ported**: [`eastwind/docs/Port.md`](eastwind/docs/Port.md).

## Running it locally

You need **Node**, **pnpm**, and a **PostgreSQL** or **SQL Server** you are willing to have wiped.

```bash
git clone <this repository> && cd eastwind
git submodule update --init altea          # `old/` is the Signum source, only a port needs it
pnpm install
pnpm --filter eastwind build
```

Every entry point takes the **environment** as an argument — there is no default, so nothing can start
against the wrong database by omission. Each `eastwind/.env.<environment>` is a tracked template; in
`eastwind/.env.local` set two connection strings, each to a database that **already exists** (altea has no
`CREATE DATABASE`):

- `EASTWIND_DB` — the application's own database. `new` wipes it.
- `NORTHWIND_DB` — the Northwind **source** database the demo data is read from. Keep it separate from
  `EASTWIND_DB`, or `new` wipes it too.

Either connection string starting with `postgres` means PostgreSQL; anything else means SQL Server.

> **In VS Code:** every command below can also run interactively. Open **Run and Debug**, pick
> **eastwind terminal** and press F5. It builds the terminal, asks for the environment (`local`), and opens a
> menu (`SN` seed Northwind, `N` new database, `S` sync, `SQL`, `TS`, `L` load, `C` check) under the
> debugger, so a breakpoint in a loader or a migration is hit.

### 1. Seed the Northwind source database

```bash
pnpm --filter eastwind terminal local seed-northwind   # (re)creates Northwind's tables + data in NORTHWIND_DB
```

Like Southwind, eastwind **reads its demo data from a real Northwind database**: the loaders in `ts` import
it from `NORTHWIND_DB`, so `ts` fails without it. The command runs Northwind's vendor script for that
database's dialect (from `eastwind/terminal/northwind/`). Run it once per machine; re-running it resets the
data.

> **In VS Code:** **Run and Debug → eastwind terminal**, then choose `SN`.

### 2. Create the schema and load the data

```bash
pnpm --filter eastwind terminal local new   # clean + generate the schema   (DESTRUCTIVE — asks for the DB name; --force skips it)
pnpm --filter eastwind terminal local ts    # roles, users, the Northwind data, the XML seeds
```

> **In VS Code:** **Run and Debug → eastwind terminal**, then choose `N`, then `TS`. Each `ts` step is recorded once it has run, so
> after a failure (for example an unseeded Northwind) fix the cause and choose `TS` again. It continues from
> where it stopped.

### 3. Run the stack

```bash
pnpm --filter eastwind stack local          # types watcher + API + client, together
```

> **In VS Code:** **Run and Debug → eastwind full stack** runs the same three processes with the **API
> under the debugger**. It frees ports 3001/5173 first, waits for the type watcher's first pass before
> starting vite, and asks for the environment. Stopping it stops all three. It runs the compiled output, so
> restart the session to pick up an edit; the watcher has already recompiled it.

The client opens on **http://localhost:5173**, the API on **3001**. To move them — to run a clone of this
application beside the original — uncomment `CLIENT_PORT` and `PORT` in `eastwind/.env.local`; everything
else follows (see `eastwind/scripts/ports.mjs`).

```
Username: System        (or Steven, Anne, … — any user the seed created)
```

On a development database the seed hashes each user's name as their password, and
`VITE_PASSWORD_IS_USERNAME=true` in `.env.local` drops the password box entirely — so switching roles is
one field. It is a client-side convenience only: the request is the normal `/api/auth/login`, every auth
rule still applies, and the flag is dead code in a production build.

`terminal local sync` diffs the model against the database and writes the script it proposes to
`eastwind/terminal/sync/` for you to read before it runs. That is the command you will use most. In
VS Code it is `S` in the **eastwind terminal** menu.

## Starting a new application from this one

```bash
node altea/cli/altea-clone/bin/altea-clone.js --name myapp
```

It finishes by printing the remaining steps. `altea-simplify` runs from the new project's own submodule,
which already carries the committed bundle:

```bash
cd ../myapp
node altea/cli/altea-simplify/bin/altea-simplify.js
pnpm install
pnpm --filter myapp build
```

`altea-clone` creates a fresh repository beside this one, adds altea as a submodule **pinned to the same
commit this workspace has**, and copies the application renamed in file names and in content. It does not
carry `old/` over: a new application ports from nothing.

`altea-simplify` then removes the modules it does not need, following
[`Modules.xml`](Modules.xml) — the spec that says, per module, exactly which files,
lines, imports, package references and tsconfig references it owns. Eleven modules are optional and a
fresh clone drops them unless you tick them back on; both ends of that range are exercised, so an
application with every optional module removed and one with *every* module removed each still compile,
bundle and run.

If you are porting an existing **Signum** application, keep the `Port` and `LegacyMode` modules and read
[`altea/AlteaPortLegacy.md`](altea/AlteaPortLegacy.md): the C# → TypeScript translation table, and the
`@legacy*` declarations that let the port run against the database the Signum application left behind.

## A note on the environment files

`eastwind/.env.*` are tracked here on purpose — `altea-clone` copies what `git ls-files` lists, so a new
application arrives with the shape of its environment already filled in. They are therefore **public files
in a public repository**, and nothing genuinely secret goes in one. In a cloned application the ignore rule
applies normally and they stay out of its commits.
