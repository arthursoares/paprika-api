// src/config/index.ts
import { z } from "zod";
import { execSync } from "child_process";

// src/errors/index.ts
var PaprikaError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "PaprikaError";
    if ("captureStackTrace" in Error) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
};
var AuthError = class extends PaprikaError {
  constructor(message = "Authentication failed") {
    super(message);
    this.name = "AuthError";
  }
};
var NotFoundError = class extends PaprikaError {
  constructor(resourceType, uid) {
    super(`${resourceType} not found: ${uid}`);
    this.resourceType = resourceType;
    this.uid = uid;
    this.name = "NotFoundError";
  }
};
var ApiError = class extends PaprikaError {
  constructor(statusCode, body) {
    super(`API error ${statusCode}`);
    this.statusCode = statusCode;
    this.body = body;
    this.name = "ApiError";
  }
};
var NetworkError = class extends PaprikaError {
  constructor(message, cause) {
    super(message, cause);
    this.name = "NetworkError";
  }
};
var ValidationError = class extends PaprikaError {
  constructor(message, details) {
    super(message);
    this.details = details;
    this.name = "ValidationError";
  }
};

// src/config/index.ts
var PaprikaConfigSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  apiBaseUrl: z.string().url().optional().default("https://www.paprikaapp.com"),
  timeout: z.number().positive().optional().default(3e4),
  retries: z.number().min(0).max(10).optional().default(3)
});
function configFromEnv() {
  const email = process.env.PAPRIKA_EMAIL;
  const password = process.env.PAPRIKA_PASSWORD;
  if (!email) {
    throw new ValidationError("Missing PAPRIKA_EMAIL environment variable");
  }
  if (!password) {
    throw new ValidationError("Missing PAPRIKA_PASSWORD environment variable");
  }
  return PaprikaConfigSchema.parse({
    email,
    password,
    timeout: process.env.PAPRIKA_TIMEOUT ? parseInt(process.env.PAPRIKA_TIMEOUT, 10) : void 0,
    retries: process.env.PAPRIKA_RETRIES ? parseInt(process.env.PAPRIKA_RETRIES, 10) : void 0
  });
}
function configFromSops(secretsPath) {
  const path = secretsPath ?? process.env.PAPRIKA_SECRETS ?? `${process.env.HOME}/clawd/secrets/api-keys.enc.yaml`;
  try {
    const email = execSync(`sops -d --extract '["paprika"]["email"]' "${path}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    const password = execSync(`sops -d --extract '["paprika"]["password"]' "${path}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    return PaprikaConfigSchema.parse({ email, password });
  } catch (error) {
    throw new ValidationError(`Failed to load credentials from SOPS: ${path}`, error);
  }
}
function resolveConfig() {
  if (process.env.PAPRIKA_EMAIL && process.env.PAPRIKA_PASSWORD) {
    return configFromEnv();
  }
  return configFromSops();
}

// src/client/auth.ts
var BasicAuth = class {
  constructor(email, password) {
    this.email = email;
    this.password = password;
  }
  async getHeaders() {
    const token = Buffer.from(`${this.email}:${this.password}`).toString("base64");
    return { Authorization: `Basic ${token}` };
  }
};
var JwtAuth = class {
  constructor(email, password, apiBaseUrl = "https://www.paprikaapp.com") {
    this.email = email;
    this.password = password;
    this.apiBaseUrl = apiBaseUrl;
  }
  token = null;
  apiBaseUrl;
  async getHeaders() {
    if (!this.token) {
      this.token = await this.login();
    }
    return { Authorization: `Bearer ${this.token}` };
  }
  async login() {
    const postData = `email=${encodeURIComponent(this.email)}&password=${encodeURIComponent(this.password)}`;
    const response = await fetch(`${this.apiBaseUrl}/api/v2/account/login/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Paprika Recipe Manager 3/3.8.4 (com.hindsightlabs.paprika.mac.v3; build:41; macOS 15.5.0) Alamofire/5.2.2"
      },
      body: postData
    });
    if (!response.ok) {
      throw new AuthError(`Login failed: ${response.status}`);
    }
    const data = await response.json();
    if (!data.result?.token) {
      throw new AuthError("No token in login response");
    }
    return data.result.token;
  }
  // Allow token reset for re-auth
  clearToken() {
    this.token = null;
  }
};

// src/client/http.ts
import { gzipSync } from "zlib";
var PaprikaHttpClient = class {
  constructor(basicAuth, jwtAuth, apiBaseUrl = "https://www.paprikaapp.com") {
    this.basicAuth = basicAuth;
    this.jwtAuth = jwtAuth;
    this.apiBaseUrl = apiBaseUrl;
  }
  apiBaseUrl;
  async request(options) {
    const auth = options.apiVersion === "v1" ? this.basicAuth : this.jwtAuth;
    const authHeaders = await auth.getHeaders();
    const url = `${this.apiBaseUrl}/api/${options.apiVersion}/sync${options.endpoint}`;
    const headers = {
      ...authHeaders,
      "User-Agent": "Paprika Recipe Manager 3/3.8.4 (com.hindsightlabs.paprika.mac.v3; build:41; macOS 15.5.0) Alamofire/5.2.2",
      Accept: "*/*"
    };
    let body;
    if (options.method === "POST" && (options.data || options.files)) {
      body = new FormData();
      if (options.data) {
        const gzipped = gzipSync(JSON.stringify(options.data));
        body.append("data", new Blob([gzipped]), "file");
      }
      if (options.files) {
        for (const file of options.files) {
          body.append(
            file.name,
            new Blob([new Uint8Array(file.data)], { type: file.contentType }),
            file.filename
          );
        }
      }
    }
    try {
      const response = await fetch(url, {
        method: options.method,
        headers,
        body
      });
      if (!response.ok) {
        const errorBody = await response.text();
        throw new ApiError(response.status, errorBody);
      }
      const responseData = await this.parseResponse(response);
      return responseData;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new NetworkError("Request failed", error);
    }
  }
  async parseResponse(response) {
    const text = await response.text();
    return JSON.parse(text);
  }
};

// src/services/recipes.ts
import { randomUUID } from "crypto";
import { createHash } from "crypto";

// src/types/recipe.ts
import { z as z2 } from "zod";
var RecipeSchema = z2.object({
  uid: z2.string(),
  name: z2.string(),
  ingredients: z2.string(),
  directions: z2.string(),
  description: z2.string(),
  notes: z2.string(),
  nutritional_info: z2.string(),
  servings: z2.string(),
  prep_time: z2.string(),
  cook_time: z2.string(),
  total_time: z2.string(),
  difficulty: z2.string(),
  source: z2.string(),
  source_url: z2.string(),
  image_url: z2.string().nullable(),
  photo: z2.string().nullable(),
  photo_large: z2.string().nullable(),
  photo_hash: z2.string().nullable(),
  categories: z2.array(z2.string()),
  rating: z2.number().min(0).max(5),
  in_trash: z2.boolean(),
  is_pinned: z2.boolean(),
  on_favorites: z2.boolean(),
  created: z2.string(),
  hash: z2.string(),
  // Added missing fields:
  deleted: z2.boolean().optional().default(false),
  scale: z2.string().nullable().optional()
  // Recipe scaling e.g. "2/1"
});
var RecipeInputSchema = RecipeSchema.partial().required({ name: true });
var RecipeListItemSchema = z2.object({
  uid: z2.string(),
  hash: z2.string()
});

// src/types/category.ts
import { z as z3 } from "zod";
var CategorySchema = z3.object({
  uid: z3.string(),
  name: z3.string(),
  parent_uid: z3.string().nullable(),
  order_flag: z3.number(),
  deleted: z3.boolean().optional().default(false)
});

// src/types/meal.ts
import { z as z4 } from "zod";
var MealType = /* @__PURE__ */ ((MealType2) => {
  MealType2[MealType2["Breakfast"] = 0] = "Breakfast";
  MealType2[MealType2["Lunch"] = 1] = "Lunch";
  MealType2[MealType2["Dinner"] = 2] = "Dinner";
  MealType2[MealType2["Snack"] = 3] = "Snack";
  return MealType2;
})(MealType || {});
var MealSchema = z4.object({
  uid: z4.string(),
  recipe_uid: z4.string().nullable(),
  // Can be null for note-only meals
  date: z4.string(),
  type: z4.number(),
  // Legacy type number
  name: z4.string(),
  order_flag: z4.number(),
  type_uid: z4.string().nullable().optional(),
  // References custom meal type
  scale: z4.string().nullable().optional(),
  // Recipe scaling e.g. "2/1"
  is_ingredient: z4.boolean().optional().default(false)
});
var MealTypeSchema = z4.object({
  uid: z4.string(),
  name: z4.string(),
  order_flag: z4.number(),
  color: z4.string(),
  // Hex color e.g. "#E36C0C"
  export_all_day: z4.boolean(),
  export_time: z4.number(),
  // Seconds from midnight
  original_type: z4.number()
  // Maps to MealType enum
});

// src/types/pantry.ts
import { z as z5 } from "zod";
var PantryItemSchema = z5.object({
  uid: z5.string(),
  ingredient: z5.string(),
  quantity: z5.string(),
  aisle: z5.string(),
  purchase_date: z5.string(),
  expiration_date: z5.string().nullable(),
  in_stock: z5.boolean()
});

// src/types/grocery.ts
import { z as z6 } from "zod";
var GroceryItemSchema = z6.object({
  uid: z6.string(),
  recipe_uid: z6.string().nullable(),
  name: z6.string(),
  order_flag: z6.number(),
  purchased: z6.boolean(),
  aisle: z6.string(),
  ingredient: z6.string(),
  recipe: z6.string().nullable(),
  // Recipe name (not uid)
  instruction: z6.string(),
  quantity: z6.string(),
  separate: z6.boolean(),
  aisle_uid: z6.string().nullable(),
  list_uid: z6.string().nullable()
});
var GroceryListSchema = z6.object({
  uid: z6.string(),
  name: z6.string(),
  order_flag: z6.number(),
  is_default: z6.boolean(),
  reminders_list: z6.string()
});
var GroceryAisleSchema = z6.object({
  uid: z6.string(),
  name: z6.string(),
  order_flag: z6.number()
});
var GroceryIngredientSchema = z6.object({
  uid: z6.string(),
  name: z6.string(),
  aisle_uid: z6.string().nullable()
});

// src/types/menu.ts
import { z as z7 } from "zod";
var MenuSchema = z7.object({
  uid: z7.string(),
  name: z7.string(),
  notes: z7.string(),
  order_flag: z7.number(),
  days: z7.number()
});
var MenuItemSchema = z7.object({
  uid: z7.string(),
  name: z7.string(),
  order_flag: z7.number(),
  recipe_uid: z7.string().nullable(),
  menu_uid: z7.string(),
  type_uid: z7.string().nullable(),
  day: z7.number(),
  scale: z7.string().nullable(),
  is_ingredient: z7.boolean()
});

// src/types/bookmark.ts
import { z as z8 } from "zod";
var BookmarkSchema = z8.object({
  uid: z8.string(),
  recipe_uid: z8.string(),
  order_flag: z8.number()
});

// src/types/status.ts
import { z as z9 } from "zod";
var SyncStatusSchema = z9.object({
  categories: z9.number(),
  recipes: z9.number(),
  photos: z9.number(),
  groceries: z9.number(),
  grocerylists: z9.number(),
  groceryaisles: z9.number(),
  groceryingredients: z9.number(),
  meals: z9.number(),
  mealtypes: z9.number(),
  bookmarks: z9.number(),
  pantry: z9.number(),
  pantrylocations: z9.number(),
  menus: z9.number(),
  menuitems: z9.number()
});

// src/services/recipes.ts
import { z as z10 } from "zod";
var RecipeService = class {
  constructor(client) {
    this.client = client;
  }
  async list() {
    const response = await this.client.request({
      method: "GET",
      endpoint: "/recipes/",
      apiVersion: "v2"
    });
    return z10.array(RecipeListItemSchema).parse(response.result);
  }
  async get(uid) {
    const response = await this.client.request({
      method: "GET",
      endpoint: `/recipe/${uid}/`,
      apiVersion: "v2"
    });
    if (!response.result) {
      throw new NotFoundError("Recipe", uid);
    }
    return RecipeSchema.parse(response.result);
  }
  async save(recipe) {
    const uid = recipe.uid ?? randomUUID().toUpperCase();
    const now = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").substring(0, 19);
    const fullRecipe = {
      uid,
      name: recipe.name,
      ingredients: recipe.ingredients ?? "",
      directions: recipe.directions ?? "",
      description: recipe.description ?? "",
      notes: recipe.notes ?? "",
      nutritional_info: recipe.nutritional_info ?? "",
      servings: recipe.servings ?? "",
      prep_time: recipe.prep_time ?? "",
      cook_time: recipe.cook_time ?? "",
      total_time: recipe.total_time ?? "",
      difficulty: recipe.difficulty ?? "",
      source: recipe.source ?? "",
      source_url: recipe.source_url ?? "",
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
      deleted: false
    };
    await this.client.request({
      method: "POST",
      endpoint: `/recipe/${uid}/`,
      apiVersion: "v2",
      data: fullRecipe
    });
    return { uid };
  }
  async delete(uid, permanent = false) {
    const recipe = await this.get(uid);
    const updatedRecipe = { ...recipe };
    if (permanent || recipe.in_trash) {
      updatedRecipe.deleted = true;
      updatedRecipe.in_trash = true;
    } else {
      updatedRecipe.in_trash = true;
    }
    updatedRecipe.hash = this.computeHash(updatedRecipe);
    await this.client.request({
      method: "POST",
      endpoint: `/recipe/${uid}/`,
      apiVersion: "v2",
      data: updatedRecipe
    });
  }
  computeHash(recipe) {
    return createHash("sha256").update(JSON.stringify(recipe)).digest("hex").toUpperCase();
  }
};

// src/services/categories.ts
import { randomUUID as randomUUID2 } from "crypto";
import { z as z11 } from "zod";
var CategoryService = class {
  constructor(client) {
    this.client = client;
  }
  async list() {
    const response = await this.client.request({
      method: "GET",
      endpoint: "/categories/",
      apiVersion: "v2"
    });
    return z11.array(CategorySchema).parse(response.result);
  }
  async create(name, parentUid) {
    const existing = await this.list();
    const maxOrder = existing.reduce((max, c) => Math.max(max, c.order_flag ?? 0), 0);
    const uid = randomUUID2().toUpperCase();
    const category = {
      uid,
      name,
      parent_uid: parentUid ?? null,
      order_flag: maxOrder + 1,
      deleted: false
    };
    await this.client.request({
      method: "POST",
      endpoint: "/categories/",
      apiVersion: "v2",
      data: [category]
    });
    return { uid };
  }
  async update(uid, updates) {
    const existing = await this.list();
    const category = existing.find((c) => c.uid === uid);
    if (!category) {
      throw new NotFoundError("Category", uid);
    }
    const updated = {
      ...category,
      name: updates.name ?? category.name,
      parent_uid: updates.parent_uid !== void 0 ? updates.parent_uid : category.parent_uid
    };
    await this.client.request({
      method: "POST",
      endpoint: "/categories/",
      apiVersion: "v2",
      data: [updated]
    });
  }
  async nest(childUid, parentUid) {
    await this.update(childUid, { parent_uid: parentUid });
  }
  async rename(uid, name) {
    await this.update(uid, { name });
  }
  async delete(uid) {
    const existing = await this.list();
    const category = existing.find((c) => c.uid === uid);
    if (!category) {
      throw new NotFoundError("Category", uid);
    }
    const deleted = { ...category, deleted: true };
    await this.client.request({
      method: "POST",
      endpoint: "/categories/",
      apiVersion: "v2",
      data: [deleted]
    });
  }
};

// src/services/meals.ts
import { randomUUID as randomUUID3 } from "crypto";
import { z as z12 } from "zod";
var MealService = class {
  constructor(client) {
    this.client = client;
  }
  async list() {
    const response = await this.client.request({
      method: "GET",
      endpoint: "/meals/",
      apiVersion: "v2"
    });
    return z12.array(MealSchema).parse(response.result);
  }
  async add(recipeUid, date, type = 2 /* Dinner */, name = "") {
    const uid = randomUUID3().toUpperCase();
    const meal = {
      uid,
      recipe_uid: recipeUid,
      date: `${date} 00:00:00`,
      type,
      name,
      order_flag: 0
    };
    await this.client.request({
      method: "POST",
      endpoint: "/meals/",
      apiVersion: "v2",
      data: [meal]
    });
    return { uid };
  }
  async delete(uid) {
    await this.client.request({
      method: "POST",
      endpoint: "/meals/",
      apiVersion: "v2",
      data: [{ uid, deleted: true }]
    });
  }
};

// src/services/pantry.ts
import { randomUUID as randomUUID4 } from "crypto";
import { z as z13 } from "zod";
var PantryService = class {
  constructor(client) {
    this.client = client;
  }
  async list() {
    const response = await this.client.request({
      method: "GET",
      endpoint: "/pantry/",
      apiVersion: "v2"
    });
    return z13.array(PantryItemSchema).parse(response.result);
  }
  async add(ingredient, quantity = "", aisle = "") {
    const uid = randomUUID4().toUpperCase();
    const now = (/* @__PURE__ */ new Date()).toISOString().split("T")[0] + " 00:00:00";
    const item = {
      uid,
      ingredient,
      quantity,
      aisle,
      purchase_date: now,
      expiration_date: null,
      in_stock: true
    };
    await this.client.request({
      method: "POST",
      endpoint: "/pantry/",
      apiVersion: "v2",
      data: [item]
    });
    return { uid };
  }
  async delete(uid) {
    await this.client.request({
      method: "POST",
      endpoint: "/pantry/",
      apiVersion: "v2",
      data: [{ uid, deleted: true }]
    });
  }
};

// src/services/groceries.ts
import { z as z14 } from "zod";
var GroceryService = class {
  constructor(client) {
    this.client = client;
  }
  async list() {
    const response = await this.client.request({
      method: "GET",
      endpoint: "/groceries/",
      apiVersion: "v2"
    });
    return z14.array(GroceryItemSchema).parse(response.result);
  }
  async delete(uid) {
    await this.client.request({
      method: "POST",
      endpoint: "/groceries/",
      apiVersion: "v2",
      data: [{ uid, deleted: true }]
    });
  }
  async clear() {
    const groceries = await this.list();
    for (const g of groceries) {
      await this.delete(g.uid);
    }
    return groceries.length;
  }
};

// src/services/photos.ts
import { randomUUID as randomUUID5, createHash as createHash2 } from "crypto";
import { execSync as execSync2 } from "child_process";
import { readFileSync, unlinkSync, existsSync } from "fs";
var PhotoService = class {
  constructor(client, recipeService) {
    this.client = client;
    this.recipeService = recipeService;
  }
  async upload(recipeUid, imagePath) {
    if (!existsSync(imagePath)) {
      throw new ValidationError(`Image file not found: ${imagePath}`);
    }
    const recipe = await this.recipeService.get(recipeUid);
    const photoLargeData = readFileSync(imagePath);
    const thumbPath = `/tmp/paprika_thumb_${Date.now()}.jpg`;
    try {
      execSync2(
        `convert "${imagePath}" -gravity center -crop 1:1 -resize 500x500 -quality 85 "${thumbPath}"`,
        { stdio: "pipe" }
      );
    } catch {
      execSync2(
        `convert "${imagePath}" -resize 500x500^ -gravity center -extent 500x500 -quality 85 "${thumbPath}"`,
        { stdio: "pipe" }
      );
    }
    const photoThumbData = readFileSync(thumbPath);
    unlinkSync(thumbPath);
    const photoUid = randomUUID5().toUpperCase();
    const photoLargeUid = randomUUID5().toUpperCase();
    await this.client.request({
      method: "POST",
      endpoint: `/photo/${photoLargeUid}/`,
      apiVersion: "v2",
      data: {
        uid: photoLargeUid,
        hash: createHash2("sha256").update(photoLargeData).digest("hex").toUpperCase(),
        recipe_uid: recipeUid,
        filename: `${photoLargeUid}.jpg`,
        name: "1",
        order_flag: 0,
        deleted: false
      },
      files: [
        {
          name: "photo_upload",
          filename: `${photoLargeUid}.jpg`,
          contentType: "image/jpeg",
          data: photoLargeData
        }
      ]
    });
    const updatedRecipe = {
      ...recipe,
      photo: `${photoUid}.jpg`,
      photo_large: `${photoLargeUid}.jpg`,
      photo_hash: createHash2("sha256").update(photoThumbData).digest("hex").toUpperCase(),
      hash: ""
      // Will be recalculated
    };
    updatedRecipe.hash = createHash2("sha256").update(JSON.stringify(updatedRecipe)).digest("hex").toUpperCase();
    await this.client.request({
      method: "POST",
      endpoint: `/recipe/${recipeUid}/`,
      apiVersion: "v2",
      data: updatedRecipe,
      files: [
        {
          name: "photo_upload",
          filename: `${photoUid}.jpg`,
          contentType: "image/jpeg",
          data: photoThumbData
        }
      ]
    });
    return { photoUid, photoLargeUid };
  }
};

// src/services/grocerylists.ts
import { randomUUID as randomUUID6 } from "crypto";
import { z as z15 } from "zod";
var GroceryListService = class {
  constructor(client) {
    this.client = client;
  }
  async list() {
    const response = await this.client.request({
      method: "GET",
      endpoint: "/grocerylists/",
      apiVersion: "v2"
    });
    return z15.array(GroceryListSchema).parse(response.result);
  }
  async create(name, isDefault = false) {
    const existing = await this.list();
    const maxOrder = existing.reduce((max, l) => Math.max(max, l.order_flag ?? 0), 0);
    const uid = randomUUID6().toUpperCase();
    const list = {
      uid,
      name,
      order_flag: maxOrder + 1,
      is_default: isDefault,
      reminders_list: "Paprika"
    };
    await this.client.request({
      method: "POST",
      endpoint: "/grocerylists/",
      apiVersion: "v2",
      data: [list]
    });
    return { uid };
  }
  async delete(uid) {
    await this.client.request({
      method: "POST",
      endpoint: "/grocerylists/",
      apiVersion: "v2",
      data: [{ uid, deleted: true }]
    });
  }
};

// src/services/groceryaisles.ts
import { randomUUID as randomUUID7 } from "crypto";
import { z as z16 } from "zod";
var GroceryAisleService = class {
  constructor(client) {
    this.client = client;
  }
  async list() {
    const response = await this.client.request({
      method: "GET",
      endpoint: "/groceryaisles/",
      apiVersion: "v2"
    });
    return z16.array(GroceryAisleSchema).parse(response.result);
  }
  async create(name) {
    const existing = await this.list();
    const maxOrder = existing.reduce((max, a) => Math.max(max, a.order_flag ?? 0), 0);
    const uid = randomUUID7().toUpperCase();
    const aisle = {
      uid,
      name,
      order_flag: maxOrder + 1
    };
    await this.client.request({
      method: "POST",
      endpoint: "/groceryaisles/",
      apiVersion: "v2",
      data: [aisle]
    });
    return { uid };
  }
  async delete(uid) {
    await this.client.request({
      method: "POST",
      endpoint: "/groceryaisles/",
      apiVersion: "v2",
      data: [{ uid, deleted: true }]
    });
  }
};

// src/services/mealtypes.ts
import { randomUUID as randomUUID8 } from "crypto";
import { z as z17 } from "zod";
var MealTypeService = class {
  constructor(client) {
    this.client = client;
  }
  async list() {
    const response = await this.client.request({
      method: "GET",
      endpoint: "/mealtypes/",
      apiVersion: "v2"
    });
    return z17.array(MealTypeSchema).parse(response.result);
  }
  async create(name, color = "#000000", exportTime = 0, exportAllDay = false) {
    const existing = await this.list();
    const maxOrder = existing.reduce((max, t) => Math.max(max, t.order_flag ?? 0), 0);
    const uid = randomUUID8().toUpperCase();
    const mealType = {
      uid,
      name,
      order_flag: maxOrder + 1,
      color,
      export_all_day: exportAllDay,
      export_time: exportTime,
      original_type: 0
    };
    await this.client.request({
      method: "POST",
      endpoint: "/mealtypes/",
      apiVersion: "v2",
      data: [mealType]
    });
    return { uid };
  }
  async delete(uid) {
    await this.client.request({
      method: "POST",
      endpoint: "/mealtypes/",
      apiVersion: "v2",
      data: [{ uid, deleted: true }]
    });
  }
};

// src/services/menus.ts
import { randomUUID as randomUUID9 } from "crypto";
import { z as z18 } from "zod";
var MenuService = class {
  constructor(client) {
    this.client = client;
  }
  async list() {
    const response = await this.client.request({
      method: "GET",
      endpoint: "/menus/",
      apiVersion: "v2"
    });
    return z18.array(MenuSchema).parse(response.result);
  }
  async create(name, days = 7, notes = "") {
    const existing = await this.list();
    const maxOrder = existing.reduce((max, m) => Math.max(max, m.order_flag ?? 0), 0);
    const uid = randomUUID9().toUpperCase();
    const menu = {
      uid,
      name,
      notes,
      order_flag: maxOrder + 1,
      days
    };
    await this.client.request({
      method: "POST",
      endpoint: "/menus/",
      apiVersion: "v2",
      data: [menu]
    });
    return { uid };
  }
  async delete(uid) {
    await this.client.request({
      method: "POST",
      endpoint: "/menus/",
      apiVersion: "v2",
      data: [{ uid, deleted: true }]
    });
  }
};

// src/services/menuitems.ts
import { randomUUID as randomUUID10 } from "crypto";
import { z as z19 } from "zod";
var MenuItemService = class {
  constructor(client) {
    this.client = client;
  }
  async list() {
    const response = await this.client.request({
      method: "GET",
      endpoint: "/menuitems/",
      apiVersion: "v2"
    });
    return z19.array(MenuItemSchema).parse(response.result);
  }
  async add(menuUid, day, name, recipeUid, typeUid) {
    const uid = randomUUID10().toUpperCase();
    const item = {
      uid,
      name,
      order_flag: 0,
      recipe_uid: recipeUid ?? null,
      menu_uid: menuUid,
      type_uid: typeUid ?? null,
      day,
      scale: null,
      is_ingredient: false
    };
    await this.client.request({
      method: "POST",
      endpoint: "/menuitems/",
      apiVersion: "v2",
      data: [item]
    });
    return { uid };
  }
  async delete(uid) {
    await this.client.request({
      method: "POST",
      endpoint: "/menuitems/",
      apiVersion: "v2",
      data: [{ uid, deleted: true }]
    });
  }
};

// src/services/bookmarks.ts
import { randomUUID as randomUUID11 } from "crypto";
import { z as z20 } from "zod";
var BookmarkService = class {
  constructor(client) {
    this.client = client;
  }
  async list() {
    const response = await this.client.request({
      method: "GET",
      endpoint: "/bookmarks/",
      apiVersion: "v2"
    });
    return z20.array(BookmarkSchema).parse(response.result);
  }
  async add(recipeUid) {
    const existing = await this.list();
    const maxOrder = existing.reduce((max, b) => Math.max(max, b.order_flag ?? 0), 0);
    const uid = randomUUID11().toUpperCase();
    const bookmark = {
      uid,
      recipe_uid: recipeUid,
      order_flag: maxOrder + 1
    };
    await this.client.request({
      method: "POST",
      endpoint: "/bookmarks/",
      apiVersion: "v2",
      data: [bookmark]
    });
    return { uid };
  }
  async delete(uid) {
    await this.client.request({
      method: "POST",
      endpoint: "/bookmarks/",
      apiVersion: "v2",
      data: [{ uid, deleted: true }]
    });
  }
};

// src/services/status.ts
var StatusService = class {
  constructor(client) {
    this.client = client;
  }
  async get() {
    const response = await this.client.request({
      method: "GET",
      endpoint: "/status/",
      apiVersion: "v2"
    });
    return SyncStatusSchema.parse(response.result);
  }
};

// src/index.ts
var PaprikaClient = class {
  recipes;
  categories;
  meals;
  pantry;
  groceries;
  photos;
  groceryLists;
  groceryAisles;
  mealTypes;
  menus;
  menuItems;
  bookmarks;
  status;
  constructor(config) {
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
    this.groceryLists = new GroceryListService(httpClient);
    this.groceryAisles = new GroceryAisleService(httpClient);
    this.mealTypes = new MealTypeService(httpClient);
    this.menus = new MenuService(httpClient);
    this.menuItems = new MenuItemService(httpClient);
    this.bookmarks = new BookmarkService(httpClient);
    this.status = new StatusService(httpClient);
  }
};

export {
  PaprikaError,
  AuthError,
  NotFoundError,
  ApiError,
  NetworkError,
  ValidationError,
  PaprikaConfigSchema,
  configFromEnv,
  configFromSops,
  resolveConfig,
  RecipeSchema,
  RecipeInputSchema,
  RecipeListItemSchema,
  CategorySchema,
  MealType,
  MealSchema,
  MealTypeSchema,
  PantryItemSchema,
  GroceryItemSchema,
  GroceryListSchema,
  GroceryAisleSchema,
  GroceryIngredientSchema,
  MenuSchema,
  MenuItemSchema,
  BookmarkSchema,
  SyncStatusSchema,
  PaprikaClient
};
//# sourceMappingURL=chunk-ZGDNWPUU.js.map