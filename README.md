# prototype-hono-drizzle-codex

## Project overview

Monorepo starter for a Hono API with Drizzle ORM and OpenAPI-driven type sharing. The
structure is ready for future frontends or shared packages under `apps/` and
`packages/`.

## Prerequisites

- Node.js 20+ and npm
- Local PostgreSQL instance or cloud database for `DATABASE_URL`
- Ability to install workspace dependencies (`npm install`)

## Getting started

1. Install dependencies at the repo root:

   ```bash
   npm install
   ```

2. Copy the backend environment template and set your database URL:

   ```bash
   cp apps/backend/.env.example apps/backend/.env
   # Edit apps/backend/.env to point DATABASE_URL at your Postgres instance
   ```

3. Generate shared API types before running the backend (required on a clean clone):

   ```bash
   npm run generate:api
   ```

## Development workflow

- Start the Hono API in watch mode:

  ```bash
  npm run dev:backend
  ```

- Run backend tests with Vitest:

  ```bash
  npm run test --workspace backend
  ```

- Build the backend for production output:

  ```bash
  npm run build --workspace backend
  npm run start --workspace backend
  ```

- Keep OpenAPI output in sync whenever `packages/openapi/openapi.yaml` changes:

  ```bash
  npm run generate --workspace openapi
  ```

## Database migrations

Drizzle Kit reads configuration from `apps/backend/drizzle.config.ts`, which uses
`DATABASE_URL` when present. Examples:

```bash
# Generate SQL migrations from schema changes
npx drizzle-kit generate --config apps/backend/drizzle.config.ts

# Apply migrations to your database
npx drizzle-kit push --config apps/backend/drizzle.config.ts
```

## Workspace layout

- `apps/backend`: Hono API service with Zod validation, Drizzle schema, and Vitest
  suite.
- `packages/openapi`: Source OpenAPI spec and generated Zod schemas/types for
  shared consumption.

## Troubleshooting

- Ensure `DATABASE_URL` is reachable before running dev or migration commands.
- If type generation fails, delete `packages/openapi/dist` and re-run
  `npm run generate:api`.
- When using a different port, set `PORT` in `apps/backend/.env` to match your
  environment.
