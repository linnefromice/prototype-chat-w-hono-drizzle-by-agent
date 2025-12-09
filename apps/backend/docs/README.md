# API Documentation

This directory contains the generated API documentation from the OpenAPI specification.

## Viewing the Documentation

### Option 1: Local Server (Recommended)

Start a local server to view the documentation:

```bash
npm run docs:serve
```

Then open your browser at: `http://localhost:8080`

### Option 2: Direct File Access

Open the `index.html` file directly in your browser:

```bash
open docs/index.html  # macOS
xdg-open docs/index.html  # Linux
start docs/index.html  # Windows
```

## Updating the Documentation

When you update the OpenAPI specification in `packages/openapi/openapi.yaml`, regenerate the documentation:

```bash
npm run docs:generate
```

## Development Workflow

For active development with automatic regeneration and serving:

```bash
npm run docs:dev
```

This command will:
1. Generate the latest documentation from the OpenAPI spec
2. Start a local server at `http://localhost:8080`

## Files

- `index.html` - The generated API documentation (committed to Git)
- `README.md` - This file

## Technology

The documentation is generated using [Redocly](https://redocly.com/), which creates a beautiful, interactive HTML documentation from OpenAPI specifications.

## Source

The source OpenAPI specification is located at:
`packages/openapi/openapi.yaml`
