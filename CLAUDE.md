# Working with this repository using Claude

This project is a monorepo for a Hono-based API with Drizzle ORM. When asking Claude to
make changes here, share the workspace-aware npm scripts so it can run the correct
commands. Useful entry points include:

- `npm run dev:backend` to start the API locally.
- `npm run generate:api` to rebuild the OpenAPI-driven Zod types.
- `npm run test --workspace backend` to exercise the backend suite.

Context to provide in prompts:

- The backend lives in `apps/backend` and uses Vitest for testing.
- Shared OpenAPI assets live in `packages/openapi` and are generated with Orval.
- Environment variables should be loaded from `apps/backend/.env` during local runs.

When requesting updates, favor small, incremental steps and ask Claude to summarize the
tests it ran. For documentation requests, prefer short sections with bullet lists and
shell commands in fenced `bash` blocks.
