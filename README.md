# Paprika Recipe Manager API Client

Unofficial Node.js CLI and library for [Paprika Recipe Manager](https://www.paprikaapp.com/).

## ⚠️ Unofficial API

This is a reverse-engineered API client. Paprika does not provide official API documentation. Use at your own risk.

## Features

- **Recipes**: List, get, add, delete (trash/permanent)
- **Categories**: List, create, nest, rename, delete
- **Photos**: Upload with automatic thumbnail generation
- **Meals**: Add/delete meal plan entries
- **Groceries**: List, clear
- **Pantry**: List, add, delete items

## Architecture

### Two API Versions

Paprika uses two different API versions:

| API | Auth | Use Cases |
|-----|------|-----------|
| **v1** (`/api/v1/sync/`) | HTTP Basic Auth | Reading data, simple writes |
| **v2** (`/api/v2/sync/`) | JWT Bearer Token | Photos, categories, complex writes |

### Key Protocol Details

1. **All payloads are gzipped** - Both request and response data is gzip-compressed
2. **Multipart form uploads** - Data sent as `multipart/form-data` with gzipped JSON in `data` field
3. **UUIDs are uppercase** - All UIDs use uppercase format: `A1B2C3D4-E5F6-...`
4. **Categories use collection endpoint** - POST to `/categories/` (not `/category/{uid}/`)
5. **Two-stage deletion** - Recipes: `in_trash: true` → `deleted: true`

### Category API Quirks

Categories are different from other resources:
- **Endpoint**: `POST /api/v2/sync/categories/` (no UID in path)
- **Body**: Array of category objects `[{uid, name, parent_uid, ...}]`
- Same endpoint for create, update, nest, and delete

## Installation

```bash
# Clone the repo
git clone https://github.com/arthursoares/paprika-api.git
cd paprika-api

# Install dependencies (none required - uses Node.js built-ins)
# Requires: Node.js 18+, ImageMagick (for photo thumbnails)

# Configure credentials (see Configuration section)
```

## Configuration

Credentials are loaded via SOPS-encrypted YAML:

```yaml
# ~/clawd/secrets/api-keys.enc.yaml
paprika:
  email: your@email.com
  password: your-password
```

Or set `PAPRIKA_SECRETS` environment variable to point to your secrets file.

## CLI Usage

```bash
# List all recipes (returns UIDs and hashes)
./paprika-api.js list

# Get full recipe details
./paprika-api.js get <recipe-uid>

# Add recipe from stdin
echo '{"name": "Test", "ingredients": "..."}' | ./paprika-api.js add

# Categories
./paprika-api.js categories
./paprika-api.js add-category "My Category"
./paprika-api.js add-category "Subcategory" --parent <parent-uid>
./paprika-api.js nest-category <child-uid> <parent-uid>
./paprika-api.js rename-category <uid> "New Name"
./paprika-api.js delete-category <uid>

# Assign/remove category from recipe
./paprika-api.js assign-category <recipe-uid> <category-uid>
./paprika-api.js remove-category <recipe-uid> <category-uid>

# Photos (requires ImageMagick)
./paprika-api.js upload-photo <recipe-uid> /path/to/photo.jpg

# Meal planning
./paprika-api.js meals
./paprika-api.js add-meal <recipe-uid> 2024-01-15 2  # type: 0=breakfast, 1=lunch, 2=dinner
./paprika-api.js delete-meal <meal-uid>

# Pantry
./paprika-api.js pantry
./paprika-api.js add-pantry "Olive Oil" "500ml" "Oils"
./paprika-api.js delete-pantry <item-uid>

# Delete recipes
./paprika-api.js delete-recipe <uid>              # Moves to trash
./paprika-api.js delete-recipe <uid> --permanent  # Permanent delete
```

## Recipe Object Structure

```javascript
{
  uid: "A1B2C3D4-...",           // Uppercase UUID
  name: "Recipe Name",
  ingredients: "1 cup flour\n2 eggs",  // Newline-separated
  directions: "Step 1...\n\nStep 2...",
  description: "Short description",
  notes: "Optional notes",
  servings: "4",
  prep_time: "15 minutes",
  cook_time: "30 minutes",
  source: "Cookbook Name",
  source_url: "https://...",
  categories: ["cat-uid-1", "cat-uid-2"],  // Array of category UIDs
  rating: 0,                     // 0-5
  photo: "uuid.jpg",             // Thumbnail filename
  photo_large: "uuid.jpg",       // Full-size filename
  photo_hash: "SHA256...",
  in_trash: false,
  created: "2024-01-15 12:00:00",
  hash: "SHA256..."              // Content hash for sync
}
```

## Known Limitations

- No official API documentation - behavior may change
- Photo upload requires ImageMagick for thumbnail generation
- Rate limiting is unknown - be conservative with batch operations
- Some fields may not sync to all Paprika clients

## License

MIT
