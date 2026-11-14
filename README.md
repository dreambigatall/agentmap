# Skillflow

Design, review and sign off the workflows your AI agents follow, before any code is written.

The product requirements and the build plan live in the PRD document (two tabs: PRD and Build plan).

## Layout

| Folder | What it is |
| --- | --- |
| `apps/api` | NestJS backend, REST API under `/api`, Prisma for the database |
| `apps/web` | Next.js frontend; forwards `/api/*` to the backend |
| `packages/shared` | Code both apps use: Zod schemas, permission table, flow layout |

The database is PostgreSQL hosted on Supabase, used as plain Postgres through a connection string.

## First run

1. Install Node.js 20 or newer and pnpm.
2. `pnpm install`
3. Copy `apps/api/.env.example` to `apps/api/.env` and paste your two Supabase connection strings
   (Supabase > Project Settings > Database > Connection string).
4. Copy `apps/web/.env.example` to `apps/web/.env.local`.
5. `pnpm dev` starts both apps:
   - Web: http://localhost:3000
   - API: http://localhost:4000/api, interactive docs at http://localhost:4000/api/docs

The badge in the top bar shows whether the API and the database are reachable.

## Everyday commands

| Command | Does |
| --- | --- |
| `pnpm dev` | Runs web and API with reload |
| `pnpm test` | Runs every test in every package |
| `pnpm typecheck` / `pnpm lint` | Checks types and style |
| `pnpm db:migrate` | Creates and applies a migration after editing `schema.prisma` |
| `pnpm db:deploy` | Applies existing migrations to a hosted database |
| `pnpm api:client` | Regenerates the web app's typed API client after an API change |

A migration is never edited after it has been applied to a hosted database; a fix is a new migration.
