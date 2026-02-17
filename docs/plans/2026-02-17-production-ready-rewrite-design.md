# Paprika API Production-Ready Rewrite Design

**Date:** 2026-02-17
**Status:** Approved
**Approach:** Clean rewrite with TypeScript

## Overview

Rewrite the single-file Paprika API client into a production-ready TypeScript library that works as:
- CLI tool for manual use
- Importable library for other Node.js apps
- Automation-friendly for scripts and cron jobs

## Project Structure

```
paprika-api/
├── src/
│   ├── types/           # TypeScript interfaces for all entities
│   │   ├── recipe.ts
│   │   ├── category.ts
│   │   ├── meal.ts
│   │   ├── pantry.ts
│   │   ├── grocery.ts
│   │   └── index.ts
│   │
│   ├── client/          # Low-level HTTP handling
│   │   ├── http.ts      # Fetch wrapper with gzip, multipart
│   │   ├── auth.ts      # V1 Basic + V2 JWT auth strategies
│   │   └── index.ts
│   │
│   ├── services/        # Domain services (business logic)
│   │   ├── recipes.ts
│   │   ├── categories.ts
│   │   ├── meals.ts
│   │   ├── pantry.ts
│   │   ├── groceries.ts
│   │   ├── photos.ts
│   │   └── index.ts
│   │
│   ├── errors/          # Custom error types
│   │   └── index.ts
│   │
│   ├── config/          # Configuration loading
│   │   └── index.ts
│   │
│   ├── index.ts         # Library exports
│   └── cli.ts           # CLI entry point
│
├── scripts/
│   └── process-fixtures.ts  # HAR → test fixtures converter
│
├── tests/
│   ├── fixtures/        # Proxyman captures as JSON fixtures
│   ├── unit/            # Unit tests with mocked HTTP
│   └── helpers/         # Test utilities
│
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Core Types

### Recipe

```typescript
interface Recipe {
  uid: string;                    // Uppercase UUID
  name: string;
  ingredients: string;            // Newline-separated
  directions: string;
  description: string;
  notes: string;
  nutritional_info: string;
  servings: string;
  prep_time: string;
  cook_time: string;
  total_time: string;
  difficulty: string;
  source: string;
  source_url: string;
  image_url: string | null;
  photo: string | null;           // Thumbnail filename
  photo_large: string | null;     // Full-size filename
  photo_hash: string | null;
  categories: string[];           // Array of category UIDs
  rating: number;                 // 0-5
  in_trash: boolean;
  is_pinned: boolean;
  on_favorites: boolean;
  created: string;                // "YYYY-MM-DD HH:MM:SS"
  hash: string;                   // Content hash for sync
}

type RecipeInput = Partial<Recipe> & { name: string };

interface RecipeListItem {
  uid: string;
  hash: string;
}
```

### Category

```typescript
interface Category {
  uid: string;
  name: string;
  parent_uid: string | null;
  order_flag: number;
  deleted: boolean;
}
```

### Meal

```typescript
interface Meal {
  uid: string;
  recipe_uid: string;
  date: string;
  type: MealType;
  name: string;
  order_flag: number;
}

enum MealType {
  Breakfast = 0,
  Lunch = 1,
  Dinner = 2,
  Snack = 3,
}
```

### Pantry

```typescript
interface PantryItem {
  uid: string;
  ingredient: string;
  quantity: string;
  aisle: string;
  purchase_date: string;
  expiration_date: string | null;
  in_stock: boolean;
}
```

## Client Layer

### Auth Strategies

```typescript
interface AuthStrategy {
  getHeaders(): Promise<Record<string, string>>;
}

class BasicAuth implements AuthStrategy {
  // HTTP Basic Auth for v1 API
}

class JwtAuth implements AuthStrategy {
  // JWT Bearer token for v2 API (lazy-loaded, cached)
}
```

### HTTP Client

```typescript
interface RequestOptions {
  method: 'GET' | 'POST';
  endpoint: string;
  apiVersion: 'v1' | 'v2';
  data?: unknown;                 // Will be gzipped
  files?: FileUpload[];           // For multipart
}

class PaprikaHttpClient {
  // Auto-selects auth based on API version
  // Gzips all data payloads
  // Constructs multipart when files present
  // Decompresses responses
  // Retries transient failures with exponential backoff
}
```

## Services Layer

Each service encapsulates domain logic and protocol quirks:

- **RecipeService**: list, get, save, delete (two-stage)
- **CategoryService**: list, create, nest, rename, delete (collection endpoint quirk)
- **MealService**: list, add, delete
- **PantryService**: list, add, delete
- **GroceryService**: list, clear
- **PhotoService**: upload (multi-step process with thumbnail generation)

### Main Client Facade

```typescript
class PaprikaClient {
  readonly recipes: RecipeService;
  readonly categories: CategoryService;
  readonly meals: MealService;
  readonly pantry: PantryService;
  readonly groceries: GroceryService;
  readonly photos: PhotoService;

  constructor(config: PaprikaConfig) { /* ... */ }
}
```

## Error Handling

```typescript
class PaprikaError extends Error { }        // Base error
class AuthError extends PaprikaError { }    // Bad credentials, expired JWT
class NotFoundError extends PaprikaError { } // Resource not found
class ApiError extends PaprikaError { }     // API error response
class NetworkError extends PaprikaError { } // Transient failures
class ValidationError extends PaprikaError { } // Invalid input/response
```

## Configuration

```typescript
interface PaprikaConfig {
  email: string;
  password: string;
  apiBaseUrl?: string;
  timeout?: number;
  retries?: number;
}

// Multiple sources supported:
// 1. Direct (library use)
// 2. Environment variables (PAPRIKA_EMAIL, PAPRIKA_PASSWORD)
// 3. SOPS-encrypted YAML (existing workflow)
```

## CLI Design

- Thin layer: parse args, call services, format output
- JSON output only (consistent, parseable)
- Errors to stderr with exit code 1
- Backward compatible with current commands
- No CLI framework dependency

## Testing Strategy

### Unit Tests with Mocked HTTP

```typescript
// Mock client returns fixture data
const client = createMockClient({
  'GET v1 /recipes/': { result: fixtures.recipeListResponse },
});
const service = new RecipeService(client);
const recipes = await service.list();
```

### Fixture Processing

Script to convert Proxyman HAR exports to sanitized test fixtures:

1. Filter to paprikaapp.com API calls
2. Base64 decode request/response bodies
3. Parse multipart, gzip decompress data fields
4. Obfuscate: UUIDs (consistent mapping), emails, JWT tokens, hashes
5. Write JSON fixture files

## Dependencies

| Package | Purpose |
|---------|---------|
| typescript | Language |
| zod | Runtime validation + type inference |
| vitest | Testing framework |
| tsx | Dev execution |
| tsup | Build/bundle |

## Not Included (YAGNI)

- CLI framework (simple arg parsing suffices)
- Logging framework (console is fine)
- HTTP library (Node fetch is sufficient)
