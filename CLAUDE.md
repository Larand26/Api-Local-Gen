# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — run with hot reload (`tsx watch src/server.ts`)
- `npm run build` — `tsc` to `dist/`, then `scripts/copy-assets.js` copies `src/db/query/*.sql` to `dist/db/query/`
- `npm start` — run the compiled `dist/server.js`
- `npm run pm2-start` / `pm2-restart` / `pm2-stop` — build and run under PM2 (`ecosystem.config.cjs`)
- `docker build` — multi-stage `Dockerfile` (node:20-alpine), exposes port 3000

There is no linter and no test suite. `npm test` expects `src/tests/test.js`, which is gitignored and usually missing. To type-check, run `npx tsc --noEmit`.

## Architecture

This is an Express 5 + TypeScript (ESM, `NodeNext`) REST API. It exposes data from an ERP that runs on **SQL Server**, plus a small warehouse "change address" app that keeps its users in **MySQL**.

Each request goes through: `routes/index.ts` → `controllers/*` (static methods on abstract classes, validate input, map results to HTTP status) → `services/*` (return `Iresponse { success, data?, error? }` and never throw to the controller) → `db/SqlServer.ts` or `db/MySql.ts` (singleton instances).

Key conventions:
- **Imports must use the `.js` extension** (for example `import X from "./foo.js"`), because the project uses NodeNext ESM with `verbatimModuleSyntax`. Type-only imports must use `import type`.
- **SQL lives in `src/db/query/*.sql`** and is loaded at runtime with `fs.readFile` relative to `__dirname`. Some services (Orders, Invoice, Clients) cache their query in a static `initialize()`, which `server.ts` calls at startup; if the file is missing, the process exits. A new `.sql` file only reaches `dist/` through `npm run build`, because of the copy-assets step. Some queries are still inline strings (for example `OrdersService.getOrdersByCnpj`).
- **SQL Server parameters** use named `@param` placeholders, passed as an object to `SqlServer.query(sql, { name: value })`. MySQL uses `?` placeholders with an array.
- `SqlServer` connects lazily with a shared pool. `server.ts` closes the pool on SIGINT/SIGTERM.
- ERP queries filter on `ID_CODFILIAIS = 1` (a single branch) and alias the ERP's Portuguese column names to English snake_case.

### Auth (two separate mechanisms)
- `/api/get-*` routes use the `authToken` middleware, which compares a static `Authorization: Bearer <API_TOKEN>` header against the env var.
- `/api/change-address-app/*` routes do **not** use that middleware. Login checks the MySQL `USUARIOS` table and issues a JWT (`JwtService`). `update-address` reads the JWT from the request **body** (`token`), not from a header.

### Configuration
Environment variables are loaded with `dotenv` in `src/config/*.ts`: `PORT`, `API_TOKEN`, `SQLSERVER_*` (including `SQLSERVER_ENCRYPT` and `SQLSERVER_TRUST_SERVER_CERTIFICATE`), `MYSQL_*`, `JWT_SECRET`, `JWT_EXPIRES_IN`.

Code comments, log messages and commit messages are in Portuguese, and commits use conventional prefixes (`feat:`, `build:`).
