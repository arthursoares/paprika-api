# Paprika Recipe Manager API Client

Unofficial TypeScript/Node.js client for [Paprika Recipe Manager](https://www.paprikaapp.com/). Works as both a CLI tool and an importable library.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ⚠️ Unofficial API

This is a reverse-engineered API client. Paprika does not provide official API documentation. Use at your own risk.

## Features

| Service | Operations |
|---------|------------|
| **Recipes** | List, get, create, update, delete (trash/permanent) |
| **Categories** | List, create, nest, rename, delete |
| **Meals** | List, add, delete meal plan entries |
| **Meal Types** | List, create custom meal types with colors |
| **Menus** | List, create, delete weekly meal planning menus |
| **Menu Items** | List, add, delete items within menus |
| **Groceries** | List, add, delete, clear grocery items |
| **Grocery Lists** | List, create, delete multiple grocery lists |
| **Grocery Aisles** | List, create, delete aisle categories |
| **Pantry** | List, add, delete pantry items |
| **Photos** | Upload with automatic thumbnail generation |
| **Bookmarks** | List, add, delete recipe bookmarks |
| **Status** | Get sync status with entity counts |

## Installation

```bash
# Clone and install
git clone https://github.com/arthursoares/paprika-api.git
cd paprika-api
npm install

# Build
npm run build
```

**Requirements:**
- Node.js 18+
- ImageMagick (for photo thumbnail generation)

## Configuration

### Option 1: Environment Variables (Recommended)

```bash
export PAPRIKA_EMAIL="your@email.com"
export PAPRIKA_PASSWORD="your-password"
```

### Option 2: SOPS-encrypted YAML

```yaml
# ~/clawd/secrets/api-keys.enc.yaml (or set PAPRIKA_SECRETS env var)
paprika:
  email: your@email.com
  password: your-password
```

## Library Usage

```typescript
import { PaprikaClient } from 'paprika-api';

const client = new PaprikaClient({
  email: 'your@email.com',
  password: 'your-password',
});

// List all recipes
const recipes = await client.recipes.list();
console.log(`Found ${recipes.length} recipes`);

// Get full recipe details
const recipe = await client.recipes.get(recipes[0].uid);
console.log(recipe.name, recipe.ingredients);

// Create a new recipe
const { uid } = await client.recipes.save({
  name: 'My New Recipe',
  ingredients: '1 cup flour\n2 eggs\n1 cup milk',
  directions: 'Mix ingredients.\n\nBake at 350°F for 30 minutes.',
  servings: '4',
  prep_time: '10 min',
  cook_time: '30 min',
});

// Add to meal plan
await client.meals.add(uid, '2024-03-15', MealType.Dinner);

// Get sync status
const status = await client.status.get();
console.log(`${status.recipes} recipes, ${status.meals} meals planned`);
```

### Available Services

```typescript
client.recipes        // Recipe CRUD operations
client.categories     // Category management with nesting
client.meals          // Meal planning
client.mealTypes      // Custom meal types (Breakfast, Lunch, etc.)
client.menus          // Weekly menu planning
client.menuItems      // Items within menus
client.groceries      // Grocery list items
client.groceryLists   // Multiple grocery lists
client.groceryAisles  // Aisle categories for groceries
client.pantry         // Pantry inventory
client.photos         // Photo uploads
client.bookmarks      // Recipe bookmarks
client.status         // Sync status
```

### Error Handling

```typescript
import { PaprikaClient, NotFoundError, AuthError, ApiError } from 'paprika-api';

try {
  const recipe = await client.recipes.get('non-existent-uid');
} catch (err) {
  if (err instanceof NotFoundError) {
    console.log('Recipe not found');
  } else if (err instanceof AuthError) {
    console.log('Check your credentials');
  } else if (err instanceof ApiError) {
    console.log(`API error: ${err.statusCode}`);
  }
}
```

## CLI Usage

```bash
# Using npm scripts (development)
npm run dev -- <command>

# Or after building
node dist/cli.js <command>
```

### Recipe Commands

```bash
# List all recipes (returns UIDs and hashes)
npm run dev -- list

# Get full recipe details
npm run dev -- get <recipe-uid>

# Add recipe from stdin
echo '{"name": "Test Recipe", "ingredients": "..."}' | npm run dev -- add

# Delete recipe (moves to trash)
npm run dev -- delete-recipe <uid>

# Permanently delete
npm run dev -- delete-recipe <uid> --permanent
```

### Category Commands

```bash
npm run dev -- categories
npm run dev -- add-category "Desserts"
npm run dev -- add-category "Cakes" --parent <desserts-uid>
npm run dev -- nest-category <child-uid> <parent-uid>
npm run dev -- rename-category <uid> "New Name"
npm run dev -- delete-category <uid>
```

### Meal Planning Commands

```bash
npm run dev -- meals
npm run dev -- add-meal <recipe-uid> 2024-03-15 2    # type: 0-3
npm run dev -- delete-meal <meal-uid>
```

### Other Commands

```bash
# Pantry
npm run dev -- pantry
npm run dev -- add-pantry "Olive Oil" "500ml" "Oils"
npm run dev -- delete-pantry <uid>

# Groceries
npm run dev -- groceries
npm run dev -- clear-groceries

# Photos (requires ImageMagick)
npm run dev -- upload-photo <recipe-uid> /path/to/photo.jpg

# Help
npm run dev -- help
```

## Architecture

### API Protocol

Paprika uses a sync-based API where all operations go through `/api/v2/sync/`:

| Aspect | Detail |
|--------|--------|
| **Auth** | JWT Bearer token (obtained via login) |
| **Payloads** | Gzip-compressed JSON |
| **Uploads** | Multipart form-data with gzipped `data` field |
| **UUIDs** | Uppercase format: `A1B2C3D4-E5F6-7890-ABCD-EF1234567890` |
| **Deletion** | Two-stage: `in_trash: true` → `deleted: true` |

### Project Structure

```
src/
├── types/          # Zod schemas + TypeScript types
├── errors/         # Typed error classes
├── config/         # Configuration (env vars, SOPS)
├── client/         # HTTP client + auth strategies
│   ├── auth.ts     # BasicAuth, JwtAuth
│   └── http.ts     # Gzip, multipart, decompression
├── services/       # Domain services
│   ├── recipes.ts
│   ├── categories.ts
│   ├── meals.ts
│   └── ...
├── index.ts        # PaprikaClient facade
└── cli.ts          # CLI entry point
```

### Category API Quirk

Categories differ from other resources:
- **Endpoint**: `POST /categories/` (collection endpoint, no UID in path)
- **Body**: Array of objects `[{uid, name, parent_uid, ...}]`
- Same endpoint handles create, update, and delete

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev -- <command>

# Run tests
npm test
npm run test:watch

# Type check
npm run typecheck

# Build for production
npm run build
```

### Adding Test Fixtures

Capture API traffic with Proxyman, then process HAR files:

```bash
npx tsx scripts/process-fixtures.ts captures/my-capture.har tests/fixtures/
```

The script sanitizes UUIDs, tokens, emails, and hashes automatically.

## Known Limitations

- No official API documentation - behavior may change without notice
- Photo upload requires ImageMagick for thumbnail generation
- Rate limiting is unknown - be conservative with batch operations
- Some fields may not sync to all Paprika client platforms

## License

MIT

## Acknowledgments

Built by reverse-engineering the Paprika Recipe Manager macOS app using [Proxyman](https://proxyman.io/).
