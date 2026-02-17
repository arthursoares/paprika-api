# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Unofficial TypeScript CLI and library for Paprika Recipe Manager. Requires Node.js 18+ and ImageMagick for photo thumbnails.

## Development Commands

```bash
npm run dev -- <command>     # Run CLI in development
npm run build                # Build for production
npm test                     # Run tests
npm run test:watch           # Run tests in watch mode
npm run typecheck            # Type check without emit
```

## CLI Usage

```bash
npm run dev -- list                           # List recipes
npm run dev -- get <uid>                      # Get recipe details
echo '{"name":"Test"}' | npm run dev -- add   # Add recipe from stdin
npm run dev -- help                           # Show all commands
```

## Project Structure

```
src/
├── types/       # Zod schemas + TypeScript types
├── errors/      # Typed error classes
├── config/      # Configuration (env vars, SOPS)
├── client/      # HTTP client + auth strategies
├── services/    # Domain services (recipes, categories, etc.)
├── index.ts     # PaprikaClient facade
└── cli.ts       # CLI entry point
```

## Architecture

### Dual API System

| API | Auth | Implementation |
|-----|------|----------------|
| **v1** `/api/v1/sync/` | HTTP Basic Auth | `BasicAuth` class |
| **v2** `/api/v2/sync/` | JWT Bearer Token | `JwtAuth` class |

### Critical Protocol Details

1. **All payloads are gzipped** - Handled by `PaprikaHttpClient`
2. **Multipart form uploads** - Data sent as FormData with gzipped JSON
3. **UUIDs are uppercase** - `crypto.randomUUID().toUpperCase()`
4. **Two-stage deletion** - Recipes: `in_trash: true` → `deleted: true`

### Category API Quirk

Categories use a different pattern (encapsulated in `CategoryService`):
- **Endpoint**: `POST /categories/` (collection endpoint, no UID in path)
- **Body**: Array of category objects `[{uid, name, parent_uid, ...}]`

### Credentials

Environment variables (preferred for automation):
```bash
export PAPRIKA_EMAIL=your@email.com
export PAPRIKA_PASSWORD=your-password
```

Or SOPS-encrypted YAML at `PAPRIKA_SECRETS` or `~/clawd/secrets/api-keys.enc.yaml`

## Adding Test Fixtures

Convert Proxyman HAR captures to sanitized test fixtures:

```bash
npx tsx scripts/process-fixtures.ts captures/<file>.har tests/fixtures/
```

## Library Usage

```typescript
import { PaprikaClient } from 'paprika-api';

const client = new PaprikaClient({
  email: 'your@email.com',
  password: 'your-password',
});

const recipes = await client.recipes.list();
const recipe = await client.recipes.get(recipes[0].uid);
```
