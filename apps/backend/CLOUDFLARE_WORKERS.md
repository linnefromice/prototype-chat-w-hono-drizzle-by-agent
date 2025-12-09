# Cloudflare Workers Deployment Guide

This document outlines how to deploy the Hono API backend to Cloudflare Workers with D1 (SQLite) database.

## Prerequisites

- Node.js installed
- Cloudflare account
- Wrangler CLI installed globally or via npm

```bash
npm install -g wrangler
# or use npx wrangler for project-specific usage
```

## Architecture Overview

The application supports multiple environments:

- **Local Development**: Uses `better-sqlite3` with file-based SQLite (`dev.db`)
- **Testing**: Uses `better-sqlite3` with in-memory SQLite (`:memory:`)
- **Production (Cloudflare Workers)**: Uses Cloudflare D1 (managed SQLite)

## Setup Steps

### 1. Authenticate with Cloudflare

```bash
wrangler login
```

### 2. Create D1 Database

Create the D1 database for your project:

```bash
cd apps/backend
npm run d1:create
```

This will output a database ID. Copy it and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "prototype-hono-drizzle-db"
database_id = "YOUR_DATABASE_ID_HERE"  # Paste your ID here
```

### 3. Generate and Apply Migrations

First, generate the SQL schema from Drizzle:

```bash
npm run db:generate
```

This creates migration files in the `migrations` directory.

Apply migrations to your D1 database:

```bash
npm run d1:migrations:apply
```

Alternatively, you can execute a specific SQL file:

```bash
npm run d1:execute
```

### 4. Local Development with Wrangler

Test your Workers application locally with D1:

```bash
npm run wrangler:dev
```

This starts a local development server that simulates the Cloudflare Workers environment.

### 5. Deploy to Cloudflare Workers

Deploy to production:

```bash
npm run wrangler:deploy
```

## Database Client Architecture

The application uses different database clients depending on the environment:

### Local/Test: `better-sqlite3`
- **File**: `src/infrastructure/db/client.ts`
- **Usage**: Node.js server (`src/server.ts`) and Vitest tests
- **Database**: File-based (`dev.db`) or in-memory (`:memory:`)

### Production: Cloudflare D1
- **File**: `src/infrastructure/db/client.d1.ts`
- **Usage**: Cloudflare Workers (`src/index.ts`)
- **Database**: Cloudflare D1 (managed SQLite)

Both clients use the same Drizzle ORM schema, ensuring consistency across environments.

## Environment Variables

The Workers environment uses bindings instead of environment variables:

```typescript
export type Env = {
  DB: D1Database  // D1 database binding
}
```

Configure bindings in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "prototype-hono-drizzle-db"
database_id = "your-database-id"
```

## Deployment Environments

### Development Environment

```bash
wrangler dev --env dev
```

Uses `env.dev` configuration from `wrangler.toml`.

### Production Environment

```bash
wrangler deploy --env production
```

Uses `env.production` configuration from `wrangler.toml`.

## Database Migrations

### Creating Migrations

1. Update your schema in `src/infrastructure/db/schema.ts`
2. Generate migration files:

```bash
npm run db:generate
```

3. Apply to D1:

```bash
npm run d1:migrations:apply
```

### Manual SQL Execution

Execute SQL directly against D1:

```bash
wrangler d1 execute prototype-hono-drizzle-db --command="SELECT * FROM users"
```

Or from a file:

```bash
wrangler d1 execute prototype-hono-drizzle-db --file=./path/to/script.sql
```

## Monitoring and Logs

View logs in real-time:

```bash
wrangler tail
```

View past logs in Cloudflare Dashboard:
1. Go to Workers & Pages
2. Select your worker
3. Click "Logs" tab

## Performance Considerations

### D1 Limits (as of 2024)

- **Database size**: 500 MB per database (free tier)
- **Reads**: 5 million reads/day (free tier)
- **Writes**: 100,000 writes/day (free tier)
- **Response time**: Typically < 50ms for simple queries

### Optimization Tips

1. **Batch Operations**: Group multiple inserts/updates when possible
2. **Indexes**: Add indexes to frequently queried columns
3. **Connection Pooling**: Not needed - D1 handles this automatically
4. **Caching**: Consider using Workers KV or Cache API for frequently accessed data

## Troubleshooting

### Error: "Cannot find binding 'DB'"

**Solution**: Ensure `wrangler.toml` has the D1 binding configured correctly and that you've created the database.

### Error: "Table does not exist"

**Solution**: Run migrations:

```bash
npm run d1:migrations:apply
```

### Local Development Issues

If `wrangler dev` fails:

1. Check that wrangler is up to date: `npm install -g wrangler@latest`
2. Clear wrangler cache: `rm -rf ~/.wrangler`
3. Re-authenticate: `wrangler login`

### Type Errors with D1

The D1 type definitions are provided by `@cloudflare/workers-types`. If you encounter type errors:

```bash
npm install -D @cloudflare/workers-types
```

Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"]
  }
}
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test --workspace backend

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          workingDirectory: apps/backend
          command: deploy --env production
```

## Cost Estimation

**Free Tier** (per month):
- 100,000 requests/day
- 10 ms CPU time per request
- 5 million D1 reads/day
- 100,000 D1 writes/day

**Paid Plan** (Workers Paid):
- $5/month base
- $0.50 per million requests
- Additional D1 usage billed separately

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [D1 Documentation](https://developers.cloudflare.com/d1/)
- [Hono Documentation](https://hono.dev/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)

## Support

For issues specific to this project, please file an issue on GitHub.

For Cloudflare Workers support, visit the [Cloudflare Community](https://community.cloudflare.com/).
