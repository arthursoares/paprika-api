#!/usr/bin/env node
import {
  PaprikaClient,
  PaprikaError,
  resolveConfig
} from "./chunk-ZJCLRWSV.js";

// src/cli.ts
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}
function exit(message) {
  console.error(message);
  process.exit(1);
}
var commands = {
  async list(client) {
    const recipes = await client.recipes.list();
    console.log(JSON.stringify(recipes, null, 2));
  },
  async recipes(client) {
    return commands.list(client, []);
  },
  async get(client, [uid]) {
    if (!uid) exit("Usage: paprika get <uid>");
    const recipe = await client.recipes.get(uid);
    console.log(JSON.stringify(recipe, null, 2));
  },
  async add(client) {
    const input = await readStdin();
    const recipe = JSON.parse(input);
    const result = await client.recipes.save(recipe);
    console.log(JSON.stringify(result, null, 2));
  },
  async "delete-recipe"(client, args) {
    const uid = args[0];
    if (!uid) exit("Usage: paprika delete-recipe <uid> [--permanent]");
    const permanent = args.includes("--permanent");
    await client.recipes.delete(uid, permanent);
    console.log(JSON.stringify({ uid, success: true, permanent }, null, 2));
  },
  async "update-recipe"(client, args) {
    const uid = args[0];
    if (!uid) exit("Usage: paprika update-recipe <uid>  (JSON patch on stdin)");
    const body = (await readStdin()).trim();
    if (!body) exit("Empty stdin \u2014 provide a JSON patch.");
    let patch;
    try {
      patch = JSON.parse(body);
    } catch (e) {
      exit(`Invalid JSON on stdin: ${e.message}`);
    }
    const result = await client.recipes.update(uid, patch);
    console.log(JSON.stringify({ ok: true, ...result, patchedFields: Object.keys(patch) }, null, 2));
  },
  async "set-categories"(client, args) {
    const [uid, ...catUids] = args;
    if (!uid) exit("Usage: paprika set-categories <recipe-uid> [<cat-uid>...]");
    const result = await client.recipes.update(uid, { categories: catUids });
    console.log(JSON.stringify({ ok: true, ...result, categories: catUids }, null, 2));
  },
  async "add-categories"(client, args) {
    const [uid, ...catUids] = args;
    if (!uid || catUids.length === 0) {
      exit("Usage: paprika add-categories <recipe-uid> <cat-uid> [<cat-uid>...]");
    }
    const current = await client.recipes.get(uid);
    const merged = Array.from(/* @__PURE__ */ new Set([...current.categories ?? [], ...catUids]));
    const result = await client.recipes.update(uid, { categories: merged });
    console.log(JSON.stringify({ ok: true, ...result, added: catUids, categories: merged }, null, 2));
  },
  async "remove-categories"(client, args) {
    const [uid, ...catUids] = args;
    if (!uid || catUids.length === 0) {
      exit("Usage: paprika remove-categories <recipe-uid> <cat-uid> [<cat-uid>...]");
    }
    const removeSet = new Set(catUids);
    const current = await client.recipes.get(uid);
    const filtered = (current.categories ?? []).filter((c) => !removeSet.has(c));
    const result = await client.recipes.update(uid, { categories: filtered });
    console.log(JSON.stringify({ ok: true, ...result, removed: catUids, categories: filtered }, null, 2));
  },
  async categories(client) {
    const categories = await client.categories.list();
    console.log(JSON.stringify(categories, null, 2));
  },
  async "add-category"(client, args) {
    if (!args[0]) exit("Usage: paprika add-category <name> [--parent <uid>]");
    const parentIdx = args.indexOf("--parent");
    let parentUid;
    let name = args.join(" ");
    if (parentIdx !== -1) {
      parentUid = args[parentIdx + 1];
      name = args.slice(0, parentIdx).join(" ");
    }
    const result = await client.categories.create(name, parentUid);
    console.log(JSON.stringify(result, null, 2));
  },
  async "nest-category"(client, [childUid, parentUid]) {
    if (!childUid || !parentUid) exit("Usage: paprika nest-category <child-uid> <parent-uid>");
    await client.categories.nest(childUid, parentUid);
    console.log(JSON.stringify({ success: true }, null, 2));
  },
  async "rename-category"(client, args) {
    const [uid, ...nameParts] = args;
    if (!uid || nameParts.length === 0) exit("Usage: paprika rename-category <uid> <new-name>");
    await client.categories.rename(uid, nameParts.join(" "));
    console.log(JSON.stringify({ success: true }, null, 2));
  },
  async "delete-category"(client, [uid]) {
    if (!uid) exit("Usage: paprika delete-category <uid>");
    await client.categories.delete(uid);
    console.log(JSON.stringify({ success: true }, null, 2));
  },
  async meals(client) {
    const meals = await client.meals.list();
    console.log(JSON.stringify(meals, null, 2));
  },
  async "add-meal"(client, args) {
    const [recipeUid, date, typeStr, name] = args;
    if (!recipeUid || !date) exit("Usage: paprika add-meal <recipe-uid> <date> [type] [name]");
    const type = parseInt(typeStr, 10) || 0;
    const result = await client.meals.add(recipeUid, date, type, name);
    console.log(JSON.stringify(result, null, 2));
  },
  async "delete-meal"(client, [uid]) {
    if (!uid) exit("Usage: paprika delete-meal <uid>");
    await client.meals.delete(uid);
    console.log(JSON.stringify({ success: true }, null, 2));
  },
  async pantry(client) {
    const items = await client.pantry.list();
    console.log(JSON.stringify(items, null, 2));
  },
  async "add-pantry"(client, [ingredient, quantity, aisle]) {
    if (!ingredient) exit("Usage: paprika add-pantry <ingredient> [quantity] [aisle]");
    const result = await client.pantry.add(ingredient, quantity, aisle);
    console.log(JSON.stringify(result, null, 2));
  },
  async "delete-pantry"(client, [uid]) {
    if (!uid) exit("Usage: paprika delete-pantry <uid>");
    await client.pantry.delete(uid);
    console.log(JSON.stringify({ success: true }, null, 2));
  },
  async groceries(client) {
    const items = await client.groceries.list();
    console.log(JSON.stringify(items, null, 2));
  },
  async "clear-groceries"(client) {
    const count = await client.groceries.clear();
    console.log(JSON.stringify({ cleared: count }, null, 2));
  },
  async "upload-photo"(client, [recipeUid, photoPath]) {
    if (!recipeUid || !photoPath) exit("Usage: paprika upload-photo <recipe-uid> <photo-path>");
    const result = await client.photos.upload(recipeUid, photoPath);
    console.log(JSON.stringify(result, null, 2));
  }
};
function printHelp() {
  console.log(`Paprika Recipe Manager CLI

Commands:
  list / recipes              List all recipe UIDs
  get <uid>                   Get full recipe details
  add                         Add recipe (JSON from stdin)
  delete-recipe <uid> [--permanent]
                              Delete recipe (moves to trash, or permanent)
  update-recipe <uid>         Partial update (JSON patch from stdin)
  set-categories <recipe-uid> [<cat-uid>...]
                              Replace the recipe's categories array
  add-categories <recipe-uid> <cat-uid>...
                              Append to existing categories (deduped)
  remove-categories <recipe-uid> <cat-uid>...
                              Remove specific categories
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
async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help") {
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
//# sourceMappingURL=cli.js.map