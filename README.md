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
pnpm --filter quote-transformer build      # the @quoted transformer, before anything else
pnpm --filter eastwind build
```

Every entry point takes the **environment** as an argument — there is no default, so nothing can start
against the wrong database by omission. Each `eastwind/.env.<environment>` is a tracked template; set at
least the connection string in `eastwind/.env.local`, then:

```bash
pnpm --filter eastwind terminal local new   # clean + generate the schema   (DESTRUCTIVE)
pnpm --filter eastwind terminal local ts    # roles, users, the Northwind data, the XML seeds
pnpm --filter eastwind stack local          # types watcher + API + client, together
```

The client opens on **http://localhost:5173**, the API on **3001**.

```
Username: System        (or Steven, Anne, … — any user the seed created)
```

On a development database the seed hashes each user's name as their password, and
`VITE_PASSWORD_IS_USERNAME=true` in `.env.local` drops the password box entirely — so switching roles is
one field. It is a client-side convenience only: the request is the normal `/api/auth/login`, every auth
rule still applies, and the flag is dead code in a production build.

`terminal local sync` diffs the model against the database and writes the script it proposes to
`eastwind/terminal/sync/` for you to read before it runs. That is the command you will use most.

## Starting a new application from this one

```bash
node altea/cli/altea-clone/dist/main.js --name myapp
```

It finishes by printing the remaining steps with the paths filled in — the new project's own submodule is
not installed yet, so `altea-simplify` is run from THIS workspace's copy:

```bash
cd ../myapp
node ../eastwind/altea/cli/altea-simplify/dist/main.js
pnpm install
pnpm --filter quote-transformer build
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
