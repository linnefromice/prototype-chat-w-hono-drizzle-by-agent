# prototype-hono-drizzle-codex

## Project overview

Monorepo starter for a Hono API with Drizzle ORM and OpenAPI-driven type sharing. The
structure is ready for future frontends or shared packages under `apps/` and
`packages/`.

## Workspace layout

- `apps/backend`: Hono API service with Drizzle ORM and Zod validation.
- `packages/openapi`: Source OpenAPI spec and generated Zod schemas/types for
  shared consumption.

## Commands

- Install dependencies (root): `npm install`
- Generate Zod schemas from OpenAPI: `npm run generate:api`
- Run backend in dev mode: `npm run dev:backend`

### Environment variables

Copy `apps/backend/.env.example` to `.env` and set:

- `DATABASE_URL`: PostgreSQL connection string
- `PORT` (optional): Port for the backend server (defaults to `3000`)
