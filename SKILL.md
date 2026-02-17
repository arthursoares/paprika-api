---
name: paprika
description: Interact with Paprika Recipe Manager. Fetch recipes, meal plans, groceries, and categories via unofficial API. Supports photo uploads, meal plan management, and full category CRUD.
---

# Paprika Recipe Manager

Full TypeScript SDK for Paprika app via unofficial REST API.

**Repo:** https://github.com/arthursoares/paprika-api

## 🔍 Semantic Recipe Search (USE THIS FIRST!)

**When someone asks "what should I make?" or describes ingredients/cravings, ALWAYS use semantic search first:**

```bash
node ~/clawd/skills/paprika/search-recipes.js "warming chickpea dish"
node ~/clawd/skills/paprika/search-recipes.js "quick weeknight pasta"
node ~/clawd/skills/paprika/search-recipes.js "something with eggplant and tahini"
```

This searches 1600+ recipes using embeddings — much faster than iterating through the API.

**How it works:**
- `recipes-index.json` — pre-built embeddings for all recipes
- `search-recipes.js` — cosine similarity search against query
- `build-recipe-index.js` — rebuilds index when new recipes are added

**Rebuild index after bulk imports:**
```bash
node ~/clawd/skills/paprika/build-recipe-index.js
```
Skips already-indexed recipes, only embeds new ones.

---

## CLI Reference

```bash
cd ~/clawd/skills/paprika
npm run dev -- <command>
```

### Recipes

```bash
# List all recipe UIDs
npm run dev -- list

# Get full recipe
npm run dev -- get <uid>

# Add recipe from stdin
echo '{"name": "Test", "ingredients": "..."}' | npm run dev -- add

# Delete recipe
npm run dev -- delete-recipe <uid>              # Moves to trash
npm run dev -- delete-recipe <uid> --permanent  # Permanent delete
```

### Categories

```bash
npm run dev -- categories
npm run dev -- add-category "My Category"
npm run dev -- add-category "Subcategory" --parent <parent-uid>
npm run dev -- nest-category <child-uid> <parent-uid>
npm run dev -- rename-category <uid> "New Name"
npm run dev -- delete-category <uid>
```

### Meal Planning

```bash
npm run dev -- meals
npm run dev -- add-meal <recipe-uid> 2024-03-15 2  # type: 0-3
npm run dev -- delete-meal <meal-uid>
```

### Pantry & Groceries

```bash
npm run dev -- pantry
npm run dev -- add-pantry "Olive Oil" "500ml" "Oils"
npm run dev -- delete-pantry <uid>

npm run dev -- groceries
npm run dev -- clear-groceries
```

### Photos

```bash
npm run dev -- upload-photo <recipe-uid> /path/to/photo.jpg
```

---

## Popina Kitchen Guidelines

### ⚠️ Checklist for Adding Recipes

Before adding any recipe, ensure:
- [ ] **Photo** — ALWAYS upload photos with recipes
- [ ] **Metric units** — convert all measurements
- [ ] **Categories** — assign relevant category **UIDs** (not names!)

### 🏷️ Categories (IMPORTANT)

**Categories must be UIDs, not string names.**

❌ WRONG:
```json
{"categories": ["Dessert Person", "Claire Saffitz"]}
```

✅ CORRECT:
```json
{"categories": ["6570BB83-3128-4916-85D9-F262DA129969"]}
```

### Metric Conversion (REQUIRED)

**Always use metric units** when creating or editing recipes:
- **Volume:** ml or L (not cups, tablespoons)
- **Weight:** grams or kg (not ounces, pounds)
- **Temperature:** Celsius (not Fahrenheit)

---

## LLM Categorization

Use GPT-4o-mini for intelligent category assignment:

```bash
cd ~/clawd/skills/paprika/categorization

# Single recipe
node categorize-llm.js --recipe <uid> --threshold 0.7 --apply

# Batch by category
node batch-llm.js --filter <category-uid> --threshold 0.7
```

---

## Cookbook Import Checklist

1. **Parse cookbook** → JSON with `parsers/<cookbook>_parser.py`
2. **Create category** nested under 📖 Books: `npm run dev -- add-category "Book (Author)" --parent <books-uid>`
3. **Import recipes** with category UID assigned
4. **Upload photos** for each recipe
5. **Run LLM categorization** on imported recipes
6. **Rebuild search index**: `node build-recipe-index.js`
7. **Verify** sample recipes have proper tags

---

## Key Category UIDs

| Category | UID |
|----------|-----|
| 📖 Books or Author | `CA3CF80A-FEBC-432E-B47A-80477C34216D-50032-0000F7802FD2FC8B` |
| Yotam Ottolenghi | `FEF828BC-B1EF-487F-B4FF-3A6FDF2C8F6B-51426-0000FC210E791CBD` |
| Linger | `523A338C-ED25-4BBD-88C9-7241CE3991F1` |
| Dessert Person | `6570BB83-3128-4916-85D9-F262DA129969` |

Use `npm run dev -- categories` to find others.
