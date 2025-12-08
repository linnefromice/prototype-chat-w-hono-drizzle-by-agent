# prototype-hono-drizzle-codex

## Project overview

Monorepo starter for a Hono API with Drizzle ORM and OpenAPI-driven type sharing. The
structure is ready for future frontends or shared packages under `apps/` and
`packages/`.

## Prerequisites

- Node.js 20+ and npm
- Docker and Docker Compose (for local database)
  - OR: Local PostgreSQL instance or cloud database for `DATABASE_URL`
- Ability to install workspace dependencies (`npm install`)

## Database Setup

### Using Docker (Recommended for local development)

1. Start PostgreSQL with Docker Compose:

   ```bash
   docker compose up -d
   ```

2. Verify the database is running:

   ```bash
   docker compose ps
   ```

3. Access the database UI (Adminer):

   - Open http://localhost:8080 in your browser
   - Login credentials:
     - System: `PostgreSQL`
     - Server: `postgres`
     - Username: `postgres`
     - Password: `password`
     - Database: `app_db`

4. Stop the database when not needed:

   ```bash
   docker compose down
   ```

5. To remove all data and start fresh:

   ```bash
   docker compose down -v
   ```

### Using an existing PostgreSQL instance

If you prefer to use your own PostgreSQL instance, update `DATABASE_URL` in
`apps/backend/.env` to point to your database.

## Getting started

1. Install dependencies at the repo root:

   ```bash
   npm install
   ```

2. Copy the backend environment template and set your database URL:

   ```bash
   cp apps/backend/.env.example apps/backend/.env
   # If using Docker Compose, no changes needed
   # Otherwise, edit apps/backend/.env to point DATABASE_URL at your Postgres instance
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

## Common workflows

All commands can be run from the repository root.

### After code changes

**Quick verification**:

```bash
npm run verify
# Runs: build + test
```

Or individually:

```bash
npm run build
npm run test
```

### After OpenAPI spec changes

When you modify `packages/openapi/openapi.yaml`:

```bash
npm run api:update
# Runs: generate:api → build → test
```

Or step by step:

```bash
npm run generate:api
npm run build
npm run test
```

### After database schema changes

When you modify `apps/backend/src/infrastructure/db/schema.ts`:

```bash
npm run db:migrate
# Runs: db:generate → db:push → test
```

Or step by step:

```bash
npm run db:generate  # Generate migration files
npm run db:push      # Apply migrations to database
npm run test         # Verify nothing broke
```

### Available npm scripts

**Development**:
- `npm run dev:backend` - Start backend in watch mode
- `npm run build` - Build backend
- `npm run test` - Run all tests

**Database**:
- `npm run db:up` - Start PostgreSQL with Docker Compose
- `npm run db:down` - Stop PostgreSQL
- `npm run db:logs` - View PostgreSQL logs
- `npm run db:reset` - Reset database (remove all data)
- `npm run db:generate` - Generate migration files
- `npm run db:push` - Apply migrations
- `npm run db:migrate` - Full migration workflow (generate → push → test)

**API/Types**:
- `npm run generate:api` - Regenerate OpenAPI types and schemas
- `npm run api:update` - Full API update workflow (generate → build → test)

**Verification**:
- `npm run verify` - Build and test everything
- `npm run build:test` - Same as verify

## Database migrations

Drizzle Kit reads configuration from `apps/backend/drizzle.config.ts`, which uses
`DATABASE_URL` when present.

**First time setup** (after starting Docker Compose):

```bash
# Navigate to the backend directory
cd apps/backend

# Generate initial migration files
npx drizzle-kit generate

# Apply migrations to create tables
npx drizzle-kit push
```

**Making schema changes**:

```bash
# 1. Update apps/backend/src/infrastructure/db/schema.ts
# 2. Navigate to the backend directory
cd apps/backend

# 3. Generate SQL migrations from schema changes
npx drizzle-kit generate

# 4. Apply migrations to your database
npx drizzle-kit push
```

**Note**: Drizzle Kit will automatically use the `drizzle.config.ts` file in the current
directory. You can also run commands from the repository root by specifying the config
path explicitly with `--config apps/backend/drizzle.config.ts`.

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
