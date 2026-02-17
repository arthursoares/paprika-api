# Paprika API Production-Ready Rewrite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite the single-file Paprika API client as a production-ready TypeScript library with proper architecture, types, and tests.

**Architecture:** Layered design with types → client (HTTP/auth) → services (domain logic) → CLI. Each layer has single responsibility. Services encapsulate Paprika protocol quirks.

**Tech Stack:** TypeScript, zod (validation), vitest (testing), tsx (dev), tsup (build)

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore` (update)

**Step 1: Initialize package.json**

```json
{
  "name": "paprika-api",
  "version": "2.0.0",
  "description": "Unofficial Node.js client for Paprika Recipe Manager",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "paprika": "dist/cli.js"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsx src/cli.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "engines": {
    "node": ">=18"
  },
  "files": ["dist"],
  "keywords": ["paprika", "recipe", "api", "cli"],
  "license": "MIT",
  "devDependencies": {
    "tsup": "^8.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  },
  "dependencies": {
    "zod": "^3.22.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/cli.ts'],
    },
  },
});
```

**Step 4: Create tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node18',
  shims: true,
});
```

**Step 5: Update .gitignore**

```gitignore
node_modules/
dist/
*.log
.env
coverage/
```

**Step 6: Install dependencies**

Run: `npm install`
Expected: Dependencies installed, package-lock.json created

**Step 7: Verify setup**

Run: `npm run typecheck`
Expected: Error (no src files yet) - that's OK

**Step 8: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts tsup.config.ts .gitignore package-lock.json
git commit -m "chore: initialize TypeScript project with vitest and tsup"
```

---

## Task 2: Error Types

**Files:**
- Create: `src/errors/index.ts`
- Create: `tests/unit/errors.test.ts`

**Step 1: Write failing test for error types**

```typescript
// tests/unit/errors.test.ts
import { describe, it, expect } from 'vitest';
import {
  PaprikaError,
  AuthError,
  NotFoundError,
  ApiError,
  NetworkError,
  ValidationError,
} from '../../src/errors';

describe('Error types', () => {
  it('PaprikaError is base error', () => {
    const err = new PaprikaError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('PaprikaError');
    expect(err.message).toBe('test');
  });

  it('AuthError includes default message', () => {
    const err = new AuthError();
    expect(err).toBeInstanceOf(PaprikaError);
    expect(err.name).toBe('AuthError');
    expect(err.message).toBe('Authentication failed');
  });

  it('NotFoundError includes resource info', () => {
    const err = new NotFoundError('Recipe', 'ABC123');
    expect(err).toBeInstanceOf(PaprikaError);
    expect(err.resourceType).toBe('Recipe');
    expect(err.uid).toBe('ABC123');
    expect(err.message).toBe('Recipe not found: ABC123');
  });

  it('ApiError includes status and body', () => {
    const err = new ApiError(400, { error: 'bad request' });
    expect(err).toBeInstanceOf(PaprikaError);
    expect(err.statusCode).toBe(400);
    expect(err.body).toEqual({ error: 'bad request' });
  });

  it('NetworkError includes cause', () => {
    const cause = new Error('ECONNREFUSED');
    const err = new NetworkError('Connection failed', cause);
    expect(err).toBeInstanceOf(PaprikaError);
    expect(err.cause).toBe(cause);
  });

  it('ValidationError includes details', () => {
    const err = new ValidationError('Invalid input', { field: 'name' });
    expect(err).toBeInstanceOf(PaprikaError);
    expect(err.details).toEqual({ field: 'name' });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/errors.test.ts`
Expected: FAIL - Cannot find module '../../src/errors'

**Step 3: Implement error types**

```typescript
// src/errors/index.ts
export class PaprikaError extends Error {
  constructor(message: string, public override cause?: Error) {
    super(message);
    this.name = 'PaprikaError';
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class AuthError extends PaprikaError {
  constructor(message = 'Authentication failed') {
    super(message);
    this.name = 'AuthError';
  }
}

export class NotFoundError extends PaprikaError {
  constructor(
    public resourceType: string,
    public uid: string,
  ) {
    super(`${resourceType} not found: ${uid}`);
    this.name = 'NotFoundError';
  }
}

export class ApiError extends PaprikaError {
  constructor(
    public statusCode: number,
    public body: unknown,
  ) {
    super(`API error ${statusCode}`);
    this.name = 'ApiError';
  }
}

export class NetworkError extends PaprikaError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends PaprikaError {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/errors.test.ts`
Expected: PASS - All 6 tests pass

**Step 5: Commit**

```bash
git add src/errors/index.ts tests/unit/errors.test.ts
git commit -m "feat: add typed error classes"
```

---

## Task 3: Core Types with Zod Schemas

**Files:**
- Create: `src/types/recipe.ts`
- Create: `src/types/category.ts`
- Create: `src/types/meal.ts`
- Create: `src/types/pantry.ts`
- Create: `src/types/grocery.ts`
- Create: `src/types/index.ts`
- Create: `tests/unit/types.test.ts`

**Step 1: Write failing test for recipe schema**

```typescript
// tests/unit/types.test.ts
import { describe, it, expect } from 'vitest';
import { RecipeSchema, RecipeListItemSchema, MealType } from '../../src/types';

describe('Recipe schemas', () => {
  it('validates full recipe', () => {
    const recipe = {
      uid: 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890',
      name: 'Test Recipe',
      ingredients: '1 cup flour',
      directions: 'Mix well',
      description: '',
      notes: '',
      nutritional_info: '',
      servings: '4',
      prep_time: '10 min',
      cook_time: '20 min',
      total_time: '30 min',
      difficulty: 'Easy',
      source: '',
      source_url: '',
      image_url: null,
      photo: null,
      photo_large: null,
      photo_hash: null,
      categories: [],
      rating: 3,
      in_trash: false,
      is_pinned: false,
      on_favorites: false,
      created: '2024-01-15 12:00:00',
      hash: 'ABC123',
    };

    const result = RecipeSchema.safeParse(recipe);
    expect(result.success).toBe(true);
  });

  it('validates recipe list item', () => {
    const item = {
      uid: 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890',
      hash: 'ABC123',
    };

    const result = RecipeListItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('rejects invalid rating', () => {
    const recipe = {
      uid: 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890',
      name: 'Test',
      rating: 6, // Invalid: max is 5
    };

    const result = RecipeSchema.partial().safeParse(recipe);
    expect(result.success).toBe(false);
  });
});

describe('MealType enum', () => {
  it('has correct values', () => {
    expect(MealType.Breakfast).toBe(0);
    expect(MealType.Lunch).toBe(1);
    expect(MealType.Dinner).toBe(2);
    expect(MealType.Snack).toBe(3);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/types.test.ts`
Expected: FAIL - Cannot find module '../../src/types'

**Step 3: Implement recipe types**

```typescript
// src/types/recipe.ts
import { z } from 'zod';

export const RecipeSchema = z.object({
  uid: z.string(),
  name: z.string(),
  ingredients: z.string(),
  directions: z.string(),
  description: z.string(),
  notes: z.string(),
  nutritional_info: z.string(),
  servings: z.string(),
  prep_time: z.string(),
  cook_time: z.string(),
  total_time: z.string(),
  difficulty: z.string(),
  source: z.string(),
  source_url: z.string(),
  image_url: z.string().nullable(),
  photo: z.string().nullable(),
  photo_large: z.string().nullable(),
  photo_hash: z.string().nullable(),
  categories: z.array(z.string()),
  rating: z.number().min(0).max(5),
  in_trash: z.boolean(),
  is_pinned: z.boolean(),
  on_favorites: z.boolean(),
  created: z.string(),
  hash: z.string(),
});

export type Recipe = z.infer<typeof RecipeSchema>;

export const RecipeInputSchema = RecipeSchema.partial().required({ name: true });
export type RecipeInput = z.infer<typeof RecipeInputSchema>;

export const RecipeListItemSchema = z.object({
  uid: z.string(),
  hash: z.string(),
});

export type RecipeListItem = z.infer<typeof RecipeListItemSchema>;
```

**Step 4: Implement category types**

```typescript
// src/types/category.ts
import { z } from 'zod';

export const CategorySchema = z.object({
  uid: z.string(),
  name: z.string(),
  parent_uid: z.string().nullable(),
  order_flag: z.number(),
  deleted: z.boolean().optional().default(false),
});

export type Category = z.infer<typeof CategorySchema>;
```

**Step 5: Implement meal types**

```typescript
// src/types/meal.ts
import { z } from 'zod';

export enum MealType {
  Breakfast = 0,
  Lunch = 1,
  Dinner = 2,
  Snack = 3,
}

export const MealSchema = z.object({
  uid: z.string(),
  recipe_uid: z.string(),
  date: z.string(),
  type: z.nativeEnum(MealType),
  name: z.string(),
  order_flag: z.number(),
});

export type Meal = z.infer<typeof MealSchema>;
```

**Step 6: Implement pantry types**

```typescript
// src/types/pantry.ts
import { z } from 'zod';

export const PantryItemSchema = z.object({
  uid: z.string(),
  ingredient: z.string(),
  quantity: z.string(),
  aisle: z.string(),
  purchase_date: z.string(),
  expiration_date: z.string().nullable(),
  in_stock: z.boolean(),
});

export type PantryItem = z.infer<typeof PantryItemSchema>;
```

**Step 7: Implement grocery types**

```typescript
// src/types/grocery.ts
import { z } from 'zod';

export const GroceryItemSchema = z.object({
  uid: z.string(),
  name: z.string(),
  ingredient: z.string().optional(),
  recipe_uid: z.string().nullable().optional(),
  aisle: z.string().optional(),
  quantity: z.string().optional(),
  purchased: z.boolean().optional(),
});

export type GroceryItem = z.infer<typeof GroceryItemSchema>;
```

**Step 8: Create index barrel export**

```typescript
// src/types/index.ts
export * from './recipe';
export * from './category';
export * from './meal';
export * from './pantry';
export * from './grocery';
```

**Step 9: Run test to verify it passes**

Run: `npm test -- tests/unit/types.test.ts`
Expected: PASS - All tests pass

**Step 10: Commit**

```bash
git add src/types/ tests/unit/types.test.ts
git commit -m "feat: add zod schemas for all entity types"
```

---

## Task 4: Configuration Module

**Files:**
- Create: `src/config/index.ts`
- Create: `tests/unit/config.test.ts`

**Step 1: Write failing test for config**

```typescript
// tests/unit/config.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PaprikaConfigSchema, configFromEnv } from '../../src/config';

describe('PaprikaConfig', () => {
  it('validates minimal config', () => {
    const config = { email: 'test@example.com', password: 'secret' };
    const result = PaprikaConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('applies default values', () => {
    const config = { email: 'test@example.com', password: 'secret' };
    const result = PaprikaConfigSchema.parse(config);
    expect(result.timeout).toBe(30000);
    expect(result.retries).toBe(3);
  });

  it('allows custom values', () => {
    const config = {
      email: 'test@example.com',
      password: 'secret',
      timeout: 60000,
      retries: 5,
    };
    const result = PaprikaConfigSchema.parse(config);
    expect(result.timeout).toBe(60000);
    expect(result.retries).toBe(5);
  });
});

describe('configFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('reads from environment variables', () => {
    process.env.PAPRIKA_EMAIL = 'env@example.com';
    process.env.PAPRIKA_PASSWORD = 'envpassword';

    const config = configFromEnv();
    expect(config.email).toBe('env@example.com');
    expect(config.password).toBe('envpassword');
  });

  it('throws when env vars missing', () => {
    delete process.env.PAPRIKA_EMAIL;
    delete process.env.PAPRIKA_PASSWORD;

    expect(() => configFromEnv()).toThrow('Missing PAPRIKA_EMAIL');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/config.test.ts`
Expected: FAIL - Cannot find module '../../src/config'

**Step 3: Implement config module**

```typescript
// src/config/index.ts
import { z } from 'zod';
import { execSync } from 'child_process';
import { ValidationError } from '../errors';

export const PaprikaConfigSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  apiBaseUrl: z.string().url().optional().default('https://www.paprikaapp.com'),
  timeout: z.number().positive().optional().default(30000),
  retries: z.number().min(0).max(10).optional().default(3),
});

export type PaprikaConfig = z.infer<typeof PaprikaConfigSchema>;

export function configFromEnv(): PaprikaConfig {
  const email = process.env.PAPRIKA_EMAIL;
  const password = process.env.PAPRIKA_PASSWORD;

  if (!email) {
    throw new ValidationError('Missing PAPRIKA_EMAIL environment variable');
  }
  if (!password) {
    throw new ValidationError('Missing PAPRIKA_PASSWORD environment variable');
  }

  return PaprikaConfigSchema.parse({
    email,
    password,
    timeout: process.env.PAPRIKA_TIMEOUT ? parseInt(process.env.PAPRIKA_TIMEOUT, 10) : undefined,
    retries: process.env.PAPRIKA_RETRIES ? parseInt(process.env.PAPRIKA_RETRIES, 10) : undefined,
  });
}

export function configFromSops(secretsPath?: string): PaprikaConfig {
  const path = secretsPath
    ?? process.env.PAPRIKA_SECRETS
    ?? `${process.env.HOME}/clawd/secrets/api-keys.enc.yaml`;

  try {
    const email = execSync(`sops -d --extract '["paprika"]["email"]' "${path}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    const password = execSync(`sops -d --extract '["paprika"]["password"]' "${path}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    return PaprikaConfigSchema.parse({ email, password });
  } catch (error) {
    throw new ValidationError(`Failed to load credentials from SOPS: ${path}`, error);
  }
}

export function resolveConfig(): PaprikaConfig {
  // Try env vars first (for automation)
  if (process.env.PAPRIKA_EMAIL && process.env.PAPRIKA_PASSWORD) {
    return configFromEnv();
  }

  // Fall back to SOPS
  return configFromSops();
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/config.test.ts`
Expected: PASS - All tests pass

**Step 5: Commit**

```bash
git add src/config/index.ts tests/unit/config.test.ts
git commit -m "feat: add configuration module with env and SOPS support"
```

---

## Task 5: Auth Strategies

**Files:**
- Create: `src/client/auth.ts`
- Create: `tests/unit/auth.test.ts`

**Step 1: Write failing test for auth strategies**

```typescript
// tests/unit/auth.test.ts
import { describe, it, expect, vi } from 'vitest';
import { BasicAuth, JwtAuth, type AuthStrategy } from '../../src/client/auth';

describe('BasicAuth', () => {
  it('generates correct Authorization header', async () => {
    const auth = new BasicAuth('user@example.com', 'password123');
    const headers = await auth.getHeaders();

    const expected = Buffer.from('user@example.com:password123').toString('base64');
    expect(headers.Authorization).toBe(`Basic ${expected}`);
  });
});

describe('JwtAuth', () => {
  it('implements AuthStrategy interface', () => {
    const auth = new JwtAuth('user@example.com', 'password123');
    expect(auth.getHeaders).toBeDefined();
  });
});

describe('AuthStrategy interface', () => {
  it('BasicAuth implements AuthStrategy', () => {
    const auth: AuthStrategy = new BasicAuth('a', 'b');
    expect(auth.getHeaders).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/auth.test.ts`
Expected: FAIL - Cannot find module '../../src/client/auth'

**Step 3: Implement auth strategies**

```typescript
// src/client/auth.ts
import { AuthError } from '../errors';

export interface AuthStrategy {
  getHeaders(): Promise<Record<string, string>>;
}

export class BasicAuth implements AuthStrategy {
  constructor(
    private email: string,
    private password: string,
  ) {}

  async getHeaders(): Promise<Record<string, string>> {
    const token = Buffer.from(`${this.email}:${this.password}`).toString('base64');
    return { Authorization: `Basic ${token}` };
  }
}

export class JwtAuth implements AuthStrategy {
  private token: string | null = null;
  private apiBaseUrl: string;

  constructor(
    private email: string,
    private password: string,
    apiBaseUrl = 'https://www.paprikaapp.com',
  ) {
    this.apiBaseUrl = apiBaseUrl;
  }

  async getHeaders(): Promise<Record<string, string>> {
    if (!this.token) {
      this.token = await this.login();
    }
    return { Authorization: `Bearer ${this.token}` };
  }

  private async login(): Promise<string> {
    const postData = `email=${encodeURIComponent(this.email)}&password=${encodeURIComponent(this.password)}`;

    const response = await fetch(`${this.apiBaseUrl}/api/v2/account/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Paprika Recipe Manager 3/3.8.4',
      },
      body: postData,
    });

    if (!response.ok) {
      throw new AuthError(`Login failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.result?.token) {
      throw new AuthError('No token in login response');
    }

    return data.result.token;
  }

  // Allow token reset for re-auth
  clearToken(): void {
    this.token = null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/auth.test.ts`
Expected: PASS - All tests pass

**Step 5: Commit**

```bash
git add src/client/auth.ts tests/unit/auth.test.ts
git commit -m "feat: add BasicAuth and JwtAuth strategies"
```

---

## Task 6: HTTP Client Core

**Files:**
- Create: `src/client/http.ts`
- Create: `src/client/index.ts`
- Create: `tests/unit/http.test.ts`

**Step 1: Write failing test for HTTP client**

```typescript
// tests/unit/http.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaprikaHttpClient, type RequestOptions } from '../../src/client/http';
import { BasicAuth, JwtAuth } from '../../src/client/auth';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('PaprikaHttpClient', () => {
  let client: PaprikaHttpClient;
  let basicAuth: BasicAuth;
  let jwtAuth: JwtAuth;

  beforeEach(() => {
    mockFetch.mockReset();
    basicAuth = new BasicAuth('test@example.com', 'password');
    jwtAuth = new JwtAuth('test@example.com', 'password');
    client = new PaprikaHttpClient(basicAuth, jwtAuth);
  });

  it('uses BasicAuth for v1 API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: [] }),
    });

    await client.request({
      method: 'GET',
      endpoint: '/recipes/',
      apiVersion: 'v1',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/sync/recipes/'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Basic /),
        }),
      }),
    );
  });

  it('gzips POST data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: true }),
    });

    await client.request({
      method: 'POST',
      endpoint: '/recipe/ABC/',
      apiVersion: 'v1',
      data: { name: 'Test Recipe' },
    });

    const call = mockFetch.mock.calls[0];
    expect(call[1].body).toBeInstanceOf(FormData);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/http.test.ts`
Expected: FAIL - Cannot find module '../../src/client/http'

**Step 3: Implement HTTP client**

```typescript
// src/client/http.ts
import { gzipSync, gunzipSync, brotliDecompressSync, inflateSync } from 'zlib';
import { AuthStrategy } from './auth';
import { ApiError, NetworkError } from '../errors';

export interface RequestOptions {
  method: 'GET' | 'POST';
  endpoint: string;
  apiVersion: 'v1' | 'v2';
  data?: unknown;
  files?: FileUpload[];
}

export interface FileUpload {
  name: string;
  filename: string;
  contentType: string;
  data: Buffer;
}

export class PaprikaHttpClient {
  private apiBaseUrl: string;

  constructor(
    private basicAuth: AuthStrategy,
    private jwtAuth: AuthStrategy,
    apiBaseUrl = 'https://www.paprikaapp.com',
  ) {
    this.apiBaseUrl = apiBaseUrl;
  }

  async request<T>(options: RequestOptions): Promise<T> {
    const auth = options.apiVersion === 'v1' ? this.basicAuth : this.jwtAuth;
    const authHeaders = await auth.getHeaders();

    const url = `${this.apiBaseUrl}/api/${options.apiVersion}/sync${options.endpoint}`;

    const headers: Record<string, string> = {
      ...authHeaders,
      'User-Agent': 'Paprika Recipe Manager 3/3.8.4',
      Accept: '*/*',
    };

    let body: FormData | undefined;

    if (options.method === 'POST' && (options.data || options.files)) {
      body = new FormData();

      if (options.data) {
        const gzipped = gzipSync(JSON.stringify(options.data));
        body.append('data', new Blob([gzipped]), 'file');
      }

      if (options.files) {
        for (const file of options.files) {
          body.append(file.name, new Blob([file.data], { type: file.contentType }), file.filename);
        }
      }
    }

    try {
      const response = await fetch(url, {
        method: options.method,
        headers,
        body,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new ApiError(response.status, errorBody);
      }

      const responseData = await this.parseResponse(response);
      return responseData as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new NetworkError('Request failed', error as Error);
    }
  }

  private async parseResponse(response: Response): Promise<unknown> {
    const contentEncoding = response.headers.get('content-encoding');
    let buffer = Buffer.from(await response.arrayBuffer());

    // Decompress if needed
    if (contentEncoding === 'gzip') {
      buffer = gunzipSync(buffer);
    } else if (contentEncoding === 'br') {
      buffer = brotliDecompressSync(buffer);
    } else if (contentEncoding === 'deflate') {
      buffer = inflateSync(buffer);
    }

    const text = buffer.toString('utf-8');
    return JSON.parse(text);
  }
}
```

**Step 4: Create client index**

```typescript
// src/client/index.ts
export * from './auth';
export * from './http';
```

**Step 5: Run test to verify it passes**

Run: `npm test -- tests/unit/http.test.ts`
Expected: PASS - All tests pass

**Step 6: Commit**

```bash
git add src/client/ tests/unit/http.test.ts
git commit -m "feat: add HTTP client with gzip and multipart support"
```

---

## Task 7: Recipe Service

**Files:**
- Create: `src/services/recipes.ts`
- Create: `tests/unit/services/recipes.test.ts`
- Create: `tests/helpers/mock-client.ts`

**Step 1: Create test helper for mocking**

```typescript
// tests/helpers/mock-client.ts
import { vi } from 'vitest';
import type { PaprikaHttpClient, RequestOptions } from '../../src/client/http';

type MockResponse = Record<string, unknown>;

export function createMockClient(
  responses: Record<string, MockResponse>,
): PaprikaHttpClient {
  return {
    request: vi.fn(async <T>(options: RequestOptions): Promise<T> => {
      const key = `${options.method} ${options.apiVersion} ${options.endpoint}`;
      const response = responses[key];
      if (!response) {
        throw new Error(`No mock for: ${key}`);
      }
      return response as T;
    }),
  } as unknown as PaprikaHttpClient;
}
```

**Step 2: Write failing test for RecipeService**

```typescript
// tests/unit/services/recipes.test.ts
import { describe, it, expect } from 'vitest';
import { RecipeService } from '../../../src/services/recipes';
import { createMockClient } from '../../helpers/mock-client';
import { NotFoundError } from '../../../src/errors';

describe('RecipeService', () => {
  describe('list', () => {
    it('returns recipe list items', async () => {
      const client = createMockClient({
        'GET v1 /recipes/': {
          result: [
            { uid: 'ABC123', hash: 'hash1' },
            { uid: 'DEF456', hash: 'hash2' },
          ],
        },
      });
      const service = new RecipeService(client);

      const recipes = await service.list();

      expect(recipes).toHaveLength(2);
      expect(recipes[0].uid).toBe('ABC123');
    });
  });

  describe('get', () => {
    it('returns full recipe', async () => {
      const client = createMockClient({
        'GET v1 /recipe/ABC123/': {
          result: {
            uid: 'ABC123',
            name: 'Test Recipe',
            ingredients: '1 cup flour',
          },
        },
      });
      const service = new RecipeService(client);

      const recipe = await service.get('ABC123');

      expect(recipe.name).toBe('Test Recipe');
    });

    it('throws NotFoundError when recipe missing', async () => {
      const client = createMockClient({
        'GET v1 /recipe/MISSING/': { result: null },
      });
      const service = new RecipeService(client);

      await expect(service.get('MISSING')).rejects.toThrow(NotFoundError);
    });
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npm test -- tests/unit/services/recipes.test.ts`
Expected: FAIL - Cannot find module '../../../src/services/recipes'

**Step 4: Implement RecipeService**

```typescript
// src/services/recipes.ts
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import type { PaprikaHttpClient } from '../client/http';
import { Recipe, RecipeInput, RecipeListItem, RecipeSchema, RecipeListItemSchema } from '../types';
import { NotFoundError } from '../errors';
import { z } from 'zod';

export class RecipeService {
  constructor(private client: PaprikaHttpClient) {}

  async list(): Promise<RecipeListItem[]> {
    const response = await this.client.request<{ result: unknown[] }>({
      method: 'GET',
      endpoint: '/recipes/',
      apiVersion: 'v1',
    });

    return z.array(RecipeListItemSchema).parse(response.result);
  }

  async get(uid: string): Promise<Recipe> {
    const response = await this.client.request<{ result: unknown }>({
      method: 'GET',
      endpoint: `/recipe/${uid}/`,
      apiVersion: 'v1',
    });

    if (!response.result) {
      throw new NotFoundError('Recipe', uid);
    }

    return RecipeSchema.parse(response.result);
  }

  async save(recipe: RecipeInput): Promise<{ uid: string }> {
    const uid = recipe.uid ?? randomUUID().toUpperCase();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const fullRecipe: Recipe = {
      uid,
      name: recipe.name,
      ingredients: recipe.ingredients ?? '',
      directions: recipe.directions ?? '',
      description: recipe.description ?? '',
      notes: recipe.notes ?? '',
      nutritional_info: recipe.nutritional_info ?? '',
      servings: recipe.servings ?? '',
      prep_time: recipe.prep_time ?? '',
      cook_time: recipe.cook_time ?? '',
      total_time: recipe.total_time ?? '',
      difficulty: recipe.difficulty ?? '',
      source: recipe.source ?? '',
      source_url: recipe.source_url ?? '',
      image_url: recipe.image_url ?? null,
      photo: recipe.photo ?? null,
      photo_large: recipe.photo_large ?? null,
      photo_hash: recipe.photo_hash ?? null,
      categories: recipe.categories ?? [],
      rating: recipe.rating ?? 0,
      in_trash: false,
      is_pinned: false,
      on_favorites: recipe.on_favorites ?? false,
      created: recipe.created ?? now,
      hash: this.computeHash(recipe),
    };

    await this.client.request({
      method: 'POST',
      endpoint: `/recipe/${uid}/`,
      apiVersion: 'v1',
      data: fullRecipe,
    });

    return { uid };
  }

  async delete(uid: string, permanent = false): Promise<void> {
    const recipe = await this.get(uid);

    // Two-stage deletion
    if (permanent || recipe.in_trash) {
      recipe.deleted = true;
      recipe.in_trash = true;
    } else {
      recipe.in_trash = true;
    }

    recipe.hash = this.computeHash(recipe);

    await this.client.request({
      method: 'POST',
      endpoint: `/recipe/${uid}/`,
      apiVersion: 'v2',
      data: recipe,
    });
  }

  private computeHash(recipe: unknown): string {
    return createHash('sha256').update(JSON.stringify(recipe)).digest('hex').toUpperCase();
  }
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- tests/unit/services/recipes.test.ts`
Expected: PASS - All tests pass

**Step 6: Commit**

```bash
git add src/services/recipes.ts tests/unit/services/recipes.test.ts tests/helpers/mock-client.ts
git commit -m "feat: add RecipeService with list, get, save, delete"
```

---

## Task 8: Category Service

**Files:**
- Create: `src/services/categories.ts`
- Create: `tests/unit/services/categories.test.ts`

**Step 1: Write failing test for CategoryService**

```typescript
// tests/unit/services/categories.test.ts
import { describe, it, expect, vi } from 'vitest';
import { CategoryService } from '../../../src/services/categories';
import { createMockClient } from '../../helpers/mock-client';

describe('CategoryService', () => {
  describe('list', () => {
    it('returns categories', async () => {
      const client = createMockClient({
        'GET v1 /categories/': {
          result: [
            { uid: 'CAT1', name: 'Desserts', parent_uid: null, order_flag: 0 },
          ],
        },
      });
      const service = new CategoryService(client);

      const categories = await service.list();

      expect(categories).toHaveLength(1);
      expect(categories[0].name).toBe('Desserts');
    });
  });

  describe('create', () => {
    it('sends array to collection endpoint', async () => {
      const mockRequest = vi.fn().mockResolvedValue({ result: true });
      const client = { request: mockRequest } as any;
      const service = new CategoryService(client);

      await service.create('New Category');

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: '/categories/',  // Collection endpoint, no UID
          apiVersion: 'v2',
          data: expect.arrayContaining([
            expect.objectContaining({ name: 'New Category' }),
          ]),
        }),
      );
    });

    it('supports parent_uid for nesting', async () => {
      const mockRequest = vi.fn().mockResolvedValue({ result: true });
      const client = { request: mockRequest } as any;
      const service = new CategoryService(client);

      await service.create('Subcategory', 'PARENT_UID');

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ parent_uid: 'PARENT_UID' }),
          ]),
        }),
      );
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/services/categories.test.ts`
Expected: FAIL - Cannot find module '../../../src/services/categories'

**Step 3: Implement CategoryService**

```typescript
// src/services/categories.ts
import { randomUUID } from 'crypto';
import type { PaprikaHttpClient } from '../client/http';
import { Category, CategorySchema } from '../types';
import { NotFoundError } from '../errors';
import { z } from 'zod';

export class CategoryService {
  constructor(private client: PaprikaHttpClient) {}

  async list(): Promise<Category[]> {
    const response = await this.client.request<{ result: unknown[] }>({
      method: 'GET',
      endpoint: '/categories/',
      apiVersion: 'v1',
    });

    return z.array(CategorySchema).parse(response.result);
  }

  async create(name: string, parentUid?: string): Promise<{ uid: string }> {
    const existing = await this.list();
    const maxOrder = existing.reduce((max, c) => Math.max(max, c.order_flag ?? 0), 0);

    const uid = randomUUID().toUpperCase();
    const category: Category = {
      uid,
      name,
      parent_uid: parentUid ?? null,
      order_flag: maxOrder + 1,
      deleted: false,
    };

    // QUIRK: Categories use collection endpoint with array body
    await this.client.request({
      method: 'POST',
      endpoint: '/categories/',
      apiVersion: 'v2',
      data: [category],
    });

    return { uid };
  }

  async update(uid: string, updates: Partial<Pick<Category, 'name' | 'parent_uid'>>): Promise<void> {
    const existing = await this.list();
    const category = existing.find(c => c.uid === uid);

    if (!category) {
      throw new NotFoundError('Category', uid);
    }

    const updated: Category = {
      ...category,
      name: updates.name ?? category.name,
      parent_uid: updates.parent_uid !== undefined ? updates.parent_uid : category.parent_uid,
    };

    await this.client.request({
      method: 'POST',
      endpoint: '/categories/',
      apiVersion: 'v2',
      data: [updated],
    });
  }

  async nest(childUid: string, parentUid: string): Promise<void> {
    await this.update(childUid, { parent_uid: parentUid });
  }

  async rename(uid: string, name: string): Promise<void> {
    await this.update(uid, { name });
  }

  async delete(uid: string): Promise<void> {
    const existing = await this.list();
    const category = existing.find(c => c.uid === uid);

    if (!category) {
      throw new NotFoundError('Category', uid);
    }

    const deleted: Category = { ...category, deleted: true };

    await this.client.request({
      method: 'POST',
      endpoint: '/categories/',
      apiVersion: 'v2',
      data: [deleted],
    });
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/services/categories.test.ts`
Expected: PASS - All tests pass

**Step 5: Commit**

```bash
git add src/services/categories.ts tests/unit/services/categories.test.ts
git commit -m "feat: add CategoryService with collection endpoint quirk"
```

---

## Task 9: Remaining Services (Meals, Pantry, Groceries, Photos)

**Files:**
- Create: `src/services/meals.ts`
- Create: `src/services/pantry.ts`
- Create: `src/services/groceries.ts`
- Create: `src/services/photos.ts`
- Create: `src/services/index.ts`

**Step 1: Implement MealService**

```typescript
// src/services/meals.ts
import { randomUUID } from 'crypto';
import type { PaprikaHttpClient } from '../client/http';
import { Meal, MealSchema, MealType } from '../types';
import { z } from 'zod';

export class MealService {
  constructor(private client: PaprikaHttpClient) {}

  async list(): Promise<Meal[]> {
    const response = await this.client.request<{ result: unknown[] }>({
      method: 'GET',
      endpoint: '/meals/',
      apiVersion: 'v1',
    });

    return z.array(MealSchema).parse(response.result);
  }

  async add(
    recipeUid: string,
    date: string,
    type: MealType = MealType.Dinner,
    name = '',
  ): Promise<{ uid: string }> {
    const uid = randomUUID().toUpperCase();

    const meal = {
      uid,
      recipe_uid: recipeUid,
      date: `${date} 00:00:00`,
      type,
      name,
      order_flag: 0,
    };

    // v2 API expects array
    await this.client.request({
      method: 'POST',
      endpoint: '/meals/',
      apiVersion: 'v2',
      data: [meal],
    });

    return { uid };
  }

  async delete(uid: string): Promise<void> {
    await this.client.request({
      method: 'POST',
      endpoint: '/meals/',
      apiVersion: 'v2',
      data: [{ uid, deleted: true }],
    });
  }
}
```

**Step 2: Implement PantryService**

```typescript
// src/services/pantry.ts
import { randomUUID } from 'crypto';
import type { PaprikaHttpClient } from '../client/http';
import { PantryItem, PantryItemSchema } from '../types';
import { z } from 'zod';

export class PantryService {
  constructor(private client: PaprikaHttpClient) {}

  async list(): Promise<PantryItem[]> {
    const response = await this.client.request<{ result: unknown[] }>({
      method: 'GET',
      endpoint: '/pantry/',
      apiVersion: 'v1',
    });

    return z.array(PantryItemSchema).parse(response.result);
  }

  async add(ingredient: string, quantity = '', aisle = ''): Promise<{ uid: string }> {
    const uid = randomUUID().toUpperCase();
    const now = new Date().toISOString().split('T')[0] + ' 00:00:00';

    const item: PantryItem = {
      uid,
      ingredient,
      quantity,
      aisle,
      purchase_date: now,
      expiration_date: null,
      in_stock: true,
    };

    await this.client.request({
      method: 'POST',
      endpoint: '/pantry/',
      apiVersion: 'v2',
      data: [item],
    });

    return { uid };
  }

  async delete(uid: string): Promise<void> {
    await this.client.request({
      method: 'POST',
      endpoint: '/pantry/',
      apiVersion: 'v2',
      data: [{ uid, deleted: true }],
    });
  }
}
```

**Step 3: Implement GroceryService**

```typescript
// src/services/groceries.ts
import type { PaprikaHttpClient } from '../client/http';
import { GroceryItem, GroceryItemSchema } from '../types';
import { z } from 'zod';

export class GroceryService {
  constructor(private client: PaprikaHttpClient) {}

  async list(): Promise<GroceryItem[]> {
    const response = await this.client.request<{ result: unknown[] }>({
      method: 'GET',
      endpoint: '/groceries/',
      apiVersion: 'v1',
    });

    return z.array(GroceryItemSchema).parse(response.result);
  }

  async delete(uid: string): Promise<void> {
    await this.client.request({
      method: 'POST',
      endpoint: `/grocery/${uid}/`,
      apiVersion: 'v1',
      data: { uid, deleted: true },
    });
  }

  async clear(): Promise<number> {
    const groceries = await this.list();
    for (const g of groceries) {
      await this.delete(g.uid);
    }
    return groceries.length;
  }
}
```

**Step 4: Implement PhotoService**

```typescript
// src/services/photos.ts
import { randomUUID, createHash } from 'crypto';
import { execSync } from 'child_process';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import type { PaprikaHttpClient } from '../client/http';
import { RecipeService } from './recipes';
import { ValidationError } from '../errors';

export class PhotoService {
  constructor(
    private client: PaprikaHttpClient,
    private recipeService: RecipeService,
  ) {}

  async upload(
    recipeUid: string,
    imagePath: string,
  ): Promise<{ photoUid: string; photoLargeUid: string }> {
    if (!existsSync(imagePath)) {
      throw new ValidationError(`Image file not found: ${imagePath}`);
    }

    const recipe = await this.recipeService.get(recipeUid);

    // Read original for full-size
    const photoLargeData = readFileSync(imagePath);

    // Create 500x500 thumbnail
    const thumbPath = `/tmp/paprika_thumb_${Date.now()}.jpg`;
    try {
      execSync(
        `convert "${imagePath}" -gravity center -crop 1:1 -resize 500x500 -quality 85 "${thumbPath}"`,
        { stdio: 'pipe' },
      );
    } catch {
      execSync(
        `convert "${imagePath}" -resize 500x500^ -gravity center -extent 500x500 -quality 85 "${thumbPath}"`,
        { stdio: 'pipe' },
      );
    }
    const photoThumbData = readFileSync(thumbPath);
    unlinkSync(thumbPath);

    const photoUid = randomUUID().toUpperCase();
    const photoLargeUid = randomUUID().toUpperCase();

    // Step 1: Upload full-size to /photo/ endpoint
    await this.client.request({
      method: 'POST',
      endpoint: `/photo/${photoLargeUid}/`,
      apiVersion: 'v2',
      data: {
        uid: photoLargeUid,
        hash: createHash('sha256').update(photoLargeData).digest('hex').toUpperCase(),
        recipe_uid: recipeUid,
        filename: `${photoLargeUid}.jpg`,
        name: '1',
        order_flag: 0,
        deleted: false,
      },
      files: [
        {
          name: 'photo_upload',
          filename: `${photoLargeUid}.jpg`,
          contentType: 'image/jpeg',
          data: photoLargeData,
        },
      ],
    });

    // Step 2: Sync recipe with thumbnail
    const updatedRecipe = {
      ...recipe,
      photo: `${photoUid}.jpg`,
      photo_large: `${photoLargeUid}.jpg`,
      photo_hash: createHash('sha256').update(photoThumbData).digest('hex').toUpperCase(),
    };
    updatedRecipe.hash = createHash('sha256').update(JSON.stringify(updatedRecipe)).digest('hex').toUpperCase();

    await this.client.request({
      method: 'POST',
      endpoint: `/recipe/${recipeUid}/`,
      apiVersion: 'v2',
      data: updatedRecipe,
      files: [
        {
          name: 'photo_upload',
          filename: `${photoUid}.jpg`,
          contentType: 'image/jpeg',
          data: photoThumbData,
        },
      ],
    });

    return { photoUid, photoLargeUid };
  }
}
```

**Step 5: Create services index**

```typescript
// src/services/index.ts
export * from './recipes';
export * from './categories';
export * from './meals';
export * from './pantry';
export * from './groceries';
export * from './photos';
```

**Step 6: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 7: Commit**

```bash
git add src/services/
git commit -m "feat: add Meal, Pantry, Grocery, and Photo services"
```

---

## Task 10: Main Client Facade

**Files:**
- Create: `src/index.ts`
- Create: `tests/unit/client.test.ts`

**Step 1: Write failing test for PaprikaClient**

```typescript
// tests/unit/client.test.ts
import { describe, it, expect } from 'vitest';
import { PaprikaClient } from '../../src';

describe('PaprikaClient', () => {
  it('exposes all services', () => {
    const client = new PaprikaClient({
      email: 'test@example.com',
      password: 'password',
    });

    expect(client.recipes).toBeDefined();
    expect(client.categories).toBeDefined();
    expect(client.meals).toBeDefined();
    expect(client.pantry).toBeDefined();
    expect(client.groceries).toBeDefined();
    expect(client.photos).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/client.test.ts`
Expected: FAIL - Cannot find module '../../src'

**Step 3: Implement PaprikaClient facade**

```typescript
// src/index.ts
import { PaprikaConfig, PaprikaConfigSchema } from './config';
import { BasicAuth, JwtAuth } from './client/auth';
import { PaprikaHttpClient } from './client/http';
import {
  RecipeService,
  CategoryService,
  MealService,
  PantryService,
  GroceryService,
  PhotoService,
} from './services';

export class PaprikaClient {
  readonly recipes: RecipeService;
  readonly categories: CategoryService;
  readonly meals: MealService;
  readonly pantry: PantryService;
  readonly groceries: GroceryService;
  readonly photos: PhotoService;

  constructor(config: PaprikaConfig) {
    const validated = PaprikaConfigSchema.parse(config);

    const basicAuth = new BasicAuth(validated.email, validated.password);
    const jwtAuth = new JwtAuth(validated.email, validated.password, validated.apiBaseUrl);
    const httpClient = new PaprikaHttpClient(basicAuth, jwtAuth, validated.apiBaseUrl);

    this.recipes = new RecipeService(httpClient);
    this.categories = new CategoryService(httpClient);
    this.meals = new MealService(httpClient);
    this.pantry = new PantryService(httpClient);
    this.groceries = new GroceryService(httpClient);
    this.photos = new PhotoService(httpClient, this.recipes);
  }
}

// Re-export types and utilities
export * from './types';
export * from './errors';
export * from './config';
export { MealType } from './types/meal';
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/index.ts tests/unit/client.test.ts
git commit -m "feat: add PaprikaClient facade exposing all services"
```

---

## Task 11: CLI Implementation

**Files:**
- Create: `src/cli.ts`

**Step 1: Implement CLI**

```typescript
// src/cli.ts
#!/usr/bin/env node
import { PaprikaClient } from './index';
import { resolveConfig } from './config';
import { PaprikaError } from './errors';
import { MealType } from './types';

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function exit(message: string): never {
  console.error(message);
  process.exit(1);
}

const commands: Record<string, (client: PaprikaClient, args: string[]) => Promise<void>> = {
  async list(client) {
    const recipes = await client.recipes.list();
    console.log(JSON.stringify(recipes, null, 2));
  },

  async recipes(client) {
    return commands.list(client, []);
  },

  async get(client, [uid]) {
    if (!uid) exit('Usage: paprika get <uid>');
    const recipe = await client.recipes.get(uid);
    console.log(JSON.stringify(recipe, null, 2));
  },

  async add(client) {
    const input = await readStdin();
    const recipe = JSON.parse(input);
    const result = await client.recipes.save(recipe);
    console.log(JSON.stringify(result, null, 2));
  },

  async 'delete-recipe'(client, args) {
    const uid = args[0];
    if (!uid) exit('Usage: paprika delete-recipe <uid> [--permanent]');
    const permanent = args.includes('--permanent');
    await client.recipes.delete(uid, permanent);
    console.log(JSON.stringify({ uid, success: true, permanent }, null, 2));
  },

  async categories(client) {
    const categories = await client.categories.list();
    console.log(JSON.stringify(categories, null, 2));
  },

  async 'add-category'(client, args) {
    if (!args[0]) exit('Usage: paprika add-category <name> [--parent <uid>]');
    const parentIdx = args.indexOf('--parent');
    let parentUid: string | undefined;
    let name = args.join(' ');
    if (parentIdx !== -1) {
      parentUid = args[parentIdx + 1];
      name = args.slice(0, parentIdx).join(' ');
    }
    const result = await client.categories.create(name, parentUid);
    console.log(JSON.stringify(result, null, 2));
  },

  async 'nest-category'(client, [childUid, parentUid]) {
    if (!childUid || !parentUid) exit('Usage: paprika nest-category <child-uid> <parent-uid>');
    await client.categories.nest(childUid, parentUid);
    console.log(JSON.stringify({ success: true }, null, 2));
  },

  async 'rename-category'(client, args) {
    const [uid, ...nameParts] = args;
    if (!uid || nameParts.length === 0) exit('Usage: paprika rename-category <uid> <new-name>');
    await client.categories.rename(uid, nameParts.join(' '));
    console.log(JSON.stringify({ success: true }, null, 2));
  },

  async 'delete-category'(client, [uid]) {
    if (!uid) exit('Usage: paprika delete-category <uid>');
    await client.categories.delete(uid);
    console.log(JSON.stringify({ success: true }, null, 2));
  },

  async meals(client) {
    const meals = await client.meals.list();
    console.log(JSON.stringify(meals, null, 2));
  },

  async 'add-meal'(client, args) {
    const [recipeUid, date, typeStr, name] = args;
    if (!recipeUid || !date) exit('Usage: paprika add-meal <recipe-uid> <date> [type] [name]');
    const type = (parseInt(typeStr, 10) || 0) as MealType;
    const result = await client.meals.add(recipeUid, date, type, name);
    console.log(JSON.stringify(result, null, 2));
  },

  async 'delete-meal'(client, [uid]) {
    if (!uid) exit('Usage: paprika delete-meal <uid>');
    await client.meals.delete(uid);
    console.log(JSON.stringify({ success: true }, null, 2));
  },

  async pantry(client) {
    const items = await client.pantry.list();
    console.log(JSON.stringify(items, null, 2));
  },

  async 'add-pantry'(client, [ingredient, quantity, aisle]) {
    if (!ingredient) exit('Usage: paprika add-pantry <ingredient> [quantity] [aisle]');
    const result = await client.pantry.add(ingredient, quantity, aisle);
    console.log(JSON.stringify(result, null, 2));
  },

  async 'delete-pantry'(client, [uid]) {
    if (!uid) exit('Usage: paprika delete-pantry <uid>');
    await client.pantry.delete(uid);
    console.log(JSON.stringify({ success: true }, null, 2));
  },

  async groceries(client) {
    const items = await client.groceries.list();
    console.log(JSON.stringify(items, null, 2));
  },

  async 'clear-groceries'(client) {
    const count = await client.groceries.clear();
    console.log(JSON.stringify({ cleared: count }, null, 2));
  },

  async 'upload-photo'(client, [recipeUid, photoPath]) {
    if (!recipeUid || !photoPath) exit('Usage: paprika upload-photo <recipe-uid> <photo-path>');
    const result = await client.photos.upload(recipeUid, photoPath);
    console.log(JSON.stringify(result, null, 2));
  },
};

function printHelp(): void {
  console.log(`Paprika Recipe Manager CLI

Commands:
  list / recipes              List all recipe UIDs
  get <uid>                   Get full recipe details
  add                         Add recipe (JSON from stdin)
  delete-recipe <uid> [--permanent]
                              Delete recipe (moves to trash, or permanent)
  categories                  List all categories
  add-category <name> [--parent <uid>]
                              Create category
  nest-category <child> <parent>
                              Nest category under parent
  rename-category <uid> <name>
                              Rename category
  delete-category <uid>       Delete category
  meals                       List meal plan
  add-meal <recipe-uid> <date> [type] [name]
                              Add meal (type: 0-3)
  delete-meal <uid>           Delete meal
  pantry                      List pantry items
  add-pantry <ingredient> [quantity] [aisle]
                              Add pantry item
  delete-pantry <uid>         Delete pantry item
  groceries                   List grocery items
  clear-groceries             Delete all grocery items
  upload-photo <recipe-uid> <path>
                              Upload photo to recipe
`);
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === 'help' || command === '--help') {
    printHelp();
    return;
  }

  const handler = commands[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }

  try {
    const config = resolveConfig();
    const client = new PaprikaClient(config);
    await handler(client, args);
  } catch (err) {
    if (err instanceof PaprikaError) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}

main();
```

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds, dist/ created

**Step 3: Test CLI manually (optional)**

Run: `PAPRIKA_EMAIL=x PAPRIKA_PASSWORD=y npm run dev -- help`
Expected: Help text displayed

**Step 4: Commit**

```bash
git add src/cli.ts
git commit -m "feat: add CLI with all commands"
```

---

## Task 12: Fixture Processing Script

**Files:**
- Create: `scripts/process-fixtures.ts`

**Step 1: Implement fixture processor**

```typescript
// scripts/process-fixtures.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { gunzipSync } from 'zlib';
import { join, basename } from 'path';

interface HarEntry {
  request: {
    method: string;
    url: string;
    postData?: { text: string };
  };
  response: {
    status: number;
    content: { text: string; encoding?: string };
  };
}

interface Har {
  log: { entries: HarEntry[] };
}

const UUID_PATTERN = /[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}/gi;

function obfuscateUUIDs(text: string, uuidMap: Map<string, string>): string {
  return text.replace(UUID_PATTERN, (match) => {
    const upper = match.toUpperCase();
    if (!uuidMap.has(upper)) {
      const index = uuidMap.size + 1;
      uuidMap.set(upper, `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`);
    }
    return uuidMap.get(upper)!;
  });
}

function obfuscate(text: string, uuidMap: Map<string, string>): string {
  let result = text;
  result = obfuscateUUIDs(result, uuidMap);
  result = result.replace(/Bearer [A-Za-z0-9._-]+/g, 'Bearer REDACTED_TOKEN');
  result = result.replace(/Basic [A-Za-z0-9+/=]+/g, 'Basic REDACTED');
  result = result.replace(/[\w.-]+@[\w.-]+\.\w+/g, 'user@example.com');
  result = result.replace(/[A-F0-9]{64}/gi, 'REDACTED_HASH'.padEnd(64, '0'));
  return result;
}

function parseMultipart(buffer: Buffer): unknown | null {
  const content = buffer.toString('binary');
  const boundaryMatch = content.match(/--([^\r\n]+)/);
  if (!boundaryMatch) return null;

  const boundary = boundaryMatch[1];
  const parts = content.split(`--${boundary}`);

  for (const part of parts) {
    if (part.includes('name="data"')) {
      const headerEnd = part.indexOf('\r\n\r\n');
      if (headerEnd === -1) continue;

      const dataStart = headerEnd + 4;
      const dataEnd = part.lastIndexOf('\r\n');
      const binaryData = part.slice(dataStart, dataEnd);
      const dataBuffer = Buffer.from(binaryData, 'binary');

      try {
        const decompressed = gunzipSync(dataBuffer);
        return JSON.parse(decompressed.toString('utf-8'));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function deriveFixtureName(method: string, path: string): string {
  const parts = path.replace('/api/v1/sync/', '').replace('/api/v2/sync/', '').split('/').filter(Boolean);

  if (parts.length === 0) return 'unknown';

  const resource = parts[0];
  const uid = parts[1];

  if (method === 'GET') {
    return uid ? `${resource}-get` : `${resource}-list`;
  }
  return uid ? `${resource}-sync-${uid.slice(0, 8)}` : `${resource}-sync`;
}

function processHar(harPath: string, outputDir: string): void {
  const har: Har = JSON.parse(readFileSync(harPath, 'utf-8'));
  const uuidMap = new Map<string, string>();

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const paprikaEntries = har.log.entries.filter(
    (e) => e.request.url.includes('paprikaapp.com/api') && !e.request.url.includes('appcenter'),
  );

  for (const entry of paprikaEntries) {
    const url = new URL(entry.request.url);

    // Decode request
    let requestBody: unknown = null;
    if (entry.request.postData?.text) {
      const decoded = Buffer.from(entry.request.postData.text, 'base64');
      requestBody = parseMultipart(decoded);
    }

    // Decode response
    let responseBody: unknown = null;
    if (entry.response.content.text) {
      const decoded = Buffer.from(entry.response.content.text, 'base64').toString('utf-8');
      try {
        responseBody = JSON.parse(decoded);
      } catch {
        responseBody = decoded;
      }
    }

    const fixture = {
      request: {
        method: entry.request.method,
        path: url.pathname,
        body: requestBody ? JSON.parse(obfuscate(JSON.stringify(requestBody), uuidMap)) : null,
      },
      response: {
        status: entry.response.status,
        body: responseBody ? JSON.parse(obfuscate(JSON.stringify(responseBody), uuidMap)) : null,
      },
    };

    const name = deriveFixtureName(entry.request.method, url.pathname);
    const outPath = join(outputDir, `${name}.json`);
    writeFileSync(outPath, JSON.stringify(fixture, null, 2));
    console.log(`Wrote: ${outPath}`);
  }
}

// CLI
const [harPath, outputDir] = process.argv.slice(2);
if (!harPath || !outputDir) {
  console.log('Usage: npx tsx scripts/process-fixtures.ts <har-file> <output-dir>');
  process.exit(1);
}
processHar(harPath, outputDir);
```

**Step 2: Test the script**

Run: `npx tsx scripts/process-fixtures.ts captures/www.paprikaapp.com_02-17-2026-12-23-16.har tests/fixtures/`
Expected: Fixture files created in tests/fixtures/

**Step 3: Commit**

```bash
git add scripts/process-fixtures.ts tests/fixtures/
git commit -m "feat: add fixture processing script for Proxyman HAR files"
```

---

## Task 13: Final Integration Test & Cleanup

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Update CLAUDE.md**

Add to CLAUDE.md:
```markdown
## Development Commands

```bash
npm run dev -- <command>     # Run CLI in development
npm run build                # Build for production
npm test                     # Run tests
npm run test:watch           # Run tests in watch mode
npm run typecheck            # Type check without emit
```

## Adding Test Fixtures

```bash
npx tsx scripts/process-fixtures.ts captures/<file>.har tests/fixtures/
```
```

**Step 5: Final commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with new development commands"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Project setup | package.json, tsconfig.json, vitest.config.ts |
| 2 | Error types | src/errors/index.ts |
| 3 | Core types with zod | src/types/*.ts |
| 4 | Configuration | src/config/index.ts |
| 5 | Auth strategies | src/client/auth.ts |
| 6 | HTTP client | src/client/http.ts |
| 7 | Recipe service | src/services/recipes.ts |
| 8 | Category service | src/services/categories.ts |
| 9 | Other services | src/services/*.ts |
| 10 | Client facade | src/index.ts |
| 11 | CLI | src/cli.ts |
| 12 | Fixture script | scripts/process-fixtures.ts |
| 13 | Integration & cleanup | Final verification |
