#!/usr/bin/env node
/**
 * Paprika Recipe Manager API Client
 * 
 * Unofficial, reverse-engineered API client for Paprika Recipe Manager.
 * 
 * ## Architecture
 * 
 * Paprika uses TWO different API versions:
 * - v1 (/api/v1/sync/): HTTP Basic Auth, used for reading and simple writes
 * - v2 (/api/v2/sync/): JWT Bearer Token, used for photos, categories, complex writes
 * 
 * ## Key Protocol Details
 * 
 * 1. All payloads are gzipped - Both requests and responses use gzip compression
 * 2. Multipart form uploads - Data sent as multipart/form-data with gzipped JSON
 * 3. UUIDs are uppercase - All identifiers use uppercase UUID format
 * 4. Categories use collection endpoint - POST to /categories/ not /category/{uid}/
 * 5. Two-stage deletion - Recipes: in_trash:true first, then deleted:true
 * 
 * ## Credentials
 * 
 * Loaded from SOPS-encrypted YAML at PAPRIKA_SECRETS or ~/clawd/secrets/api-keys.enc.yaml
 * Required keys: paprika.email, paprika.password
 */

const { execSync } = require('child_process');
const https = require('https');
const zlib = require('zlib');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SECRETS_PATH = process.env.PAPRIKA_SECRETS || `${process.env.HOME}/clawd/secrets/api-keys.enc.yaml`;
const API_BASE = 'https://www.paprikaapp.com/api/v1/sync';
const API_V2_BASE = 'https://www.paprikaapp.com/api/v2/sync';

// Cache JWT token
let cachedJwt = null;

function getCredentials() {
  const email = execSync(`sops -d --extract '["paprika"]["email"]' "${SECRETS_PATH}"`, { encoding: 'utf8' }).trim();
  const password = execSync(`sops -d --extract '["paprika"]["password"]' "${SECRETS_PATH}"`, { encoding: 'utf8' }).trim();
  return { email, password };
}

function generateUUID() {
  return crypto.randomUUID().toUpperCase();
}

/**
 * Get JWT token for v2 API authentication.
 * 
 * The v2 API requires Bearer token auth instead of Basic Auth.
 * Token is cached for the session to avoid repeated logins.
 * 
 * @returns {Promise<string>} JWT token
 */
async function getJwt() {
  if (cachedJwt) return cachedJwt;
  
  const { email, password } = getCredentials();
  
  return new Promise((resolve, reject) => {
    const postData = `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
    
    const options = {
      hostname: 'www.paprikaapp.com',
      path: '/api/v2/account/login/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Paprika Recipe Manager 3/3.8.4 (com.hindsightlabs.paprika.mac.v3; build:41; macOS 15.5.0) Alamofire/5.2.2',
        'Accept': '*/*',
        'Accept-Language': 'en-US;q=1.0, de-DE;q=0.9',
        'Accept-Encoding': 'br;q=1.0, gzip;q=0.9, deflate;q=0.8',
      }
    };

    const req = https.request(options, (res) => {
      let chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          let buffer = Buffer.concat(chunks);
          // Handle gzip/deflate
          if (res.headers['content-encoding'] === 'gzip') {
            buffer = zlib.gunzipSync(buffer);
          } else if (res.headers['content-encoding'] === 'deflate') {
            buffer = zlib.inflateSync(buffer);
          } else if (res.headers['content-encoding'] === 'br') {
            buffer = zlib.brotliDecompressSync(buffer);
          }
          const data = JSON.parse(buffer.toString());
          if (data.result && data.result.token) {
            cachedJwt = data.result.token;
            resolve(cachedJwt);
          } else {
            reject(new Error('No token in response: ' + JSON.stringify(data)));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Make a request to the v2 API with JWT authentication.
 * 
 * V2 API is used for:
 * - Photo uploads (multipart with photo_upload field)
 * - Category CRUD (uses collection endpoint /categories/)
 * - Complex recipe updates
 * 
 * @param {string} endpoint - API endpoint path (e.g., '/recipe/{uid}/')
 * @param {string} method - HTTP method (GET, POST)
 * @param {Array|null} parts - Multipart form parts [{name, filename, contentType, data}]
 * @returns {Promise<{status: number, data: any}>}
 */
async function apiRequestV2(endpoint, method = 'GET', parts = null) {
  const jwt = await getJwt();
  
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_V2_BASE}${endpoint}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method,
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'User-Agent': 'Paprika Recipe Manager 3/3.8.4 (com.hindsightlabs.paprika.mac.v3; build:41; macOS 15.5.0) Alamofire/5.2.2',
        'Accept': '*/*',
      }
    };

    let body = null;
    if (parts) {
      const boundary = 'alamofire.boundary.' + crypto.randomBytes(8).toString('hex');
      options.headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
      
      const bodyParts = [];
      for (const part of parts) {
        bodyParts.push(Buffer.from(`--${boundary}\r\n`));
        bodyParts.push(Buffer.from(`Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n`));
        bodyParts.push(Buffer.from(`Content-Type: ${part.contentType}\r\n\r\n`));
        bodyParts.push(Buffer.isBuffer(part.data) ? part.data : Buffer.from(part.data));
        bodyParts.push(Buffer.from('\r\n'));
      }
      bodyParts.push(Buffer.from(`--${boundary}--\r\n`));
      body = Buffer.concat(bodyParts);
      options.headers['Content-Length'] = body.length;
    }

    const req = https.request(options, (res) => {
      let chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          let buffer = Buffer.concat(chunks);
          // Handle compression
          if (res.headers['content-encoding'] === 'gzip') {
            buffer = zlib.gunzipSync(buffer);
          } else if (res.headers['content-encoding'] === 'deflate') {
            buffer = zlib.inflateSync(buffer);
          } else if (res.headers['content-encoding'] === 'br') {
            buffer = zlib.brotliDecompressSync(buffer);
          }
          resolve({ status: res.statusCode, data: JSON.parse(buffer.toString()) });
        } catch (e) {
          resolve({ status: res.statusCode, data: Buffer.concat(chunks).toString(), error: e.message });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Make a request to the v1 API with Basic Auth.
 * 
 * V1 API is simpler and used for most read operations and basic writes.
 * 
 * @param {string} endpoint - API endpoint path (e.g., '/recipes/')
 * @param {string} method - HTTP method
 * @param {Object|null} formData - Form data for POST requests
 * @returns {Promise<any>} Parsed JSON response
 */
function apiRequest(endpoint, method = 'GET', formData = null) {
  return new Promise((resolve, reject) => {
    const { email, password } = getCredentials();
    const auth = Buffer.from(`${email}:${password}`).toString('base64');
    
    const url = new URL(`${API_BASE}${endpoint}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'User-Agent': 'Paprika/3.0',
      }
    };

    let body = null;
    if (formData) {
      const boundary = '----PaprikaFormBoundary' + crypto.randomBytes(8).toString('hex');
      options.headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
      
      // Build multipart body properly handling binary data
      const buffers = [];
      for (const [key, value] of Object.entries(formData)) {
        let header = `--${boundary}\r\n`;
        if (value.filename) {
          header += `Content-Disposition: form-data; name="${key}"; filename="${value.filename}"\r\n`;
          header += `Content-Type: ${value.contentType || 'application/octet-stream'}\r\n\r\n`;
          buffers.push(Buffer.from(header));
          buffers.push(Buffer.isBuffer(value.data) ? value.data : Buffer.from(value.data));
          buffers.push(Buffer.from('\r\n'));
        } else {
          header += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
          buffers.push(Buffer.from(header));
          buffers.push(Buffer.from(String(value)));
          buffers.push(Buffer.from('\r\n'));
        }
      }
      buffers.push(Buffer.from(`--${boundary}--\r\n`));
      body = Buffer.concat(buffers);
      options.headers['Content-Length'] = body.length;
    }

    const req = https.request(options, (res) => {
      let chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const text = Buffer.concat(chunks).toString();
          resolve(JSON.parse(text));
        } catch (e) {
          resolve(Buffer.concat(chunks).toString());
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function listRecipes() {
  const result = await apiRequest('/recipes/');
  return result.result || [];
}

async function getRecipe(uid) {
  const result = await apiRequest(`/recipe/${uid}/`);
  return result.result || null;
}

/**
 * Save (create or update) a recipe.
 * 
 * Recipe data is gzipped and sent as multipart form data.
 * A new UUID is generated if not provided.
 * Hash is computed from recipe content for sync detection.
 * 
 * @param {Object} recipe - Recipe object with name, ingredients, directions, etc.
 * @returns {Promise<{uid: string, result: any}>}
 */
async function saveRecipe(recipe) {
  const uid = recipe.uid || generateUUID();
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  const fullRecipe = {
    uid,
    name: recipe.name || '',
    ingredients: recipe.ingredients || '',
    directions: recipe.directions || '',
    description: recipe.description || '',
    notes: recipe.notes || '',
    nutritional_info: recipe.nutritional_info || '',
    servings: recipe.servings || '',
    difficulty: recipe.difficulty || '',
    prep_time: recipe.prep_time || '',
    cook_time: recipe.cook_time || '',
    total_time: recipe.total_time || '',
    source: recipe.source || '',
    source_url: recipe.source_url || '',
    image_url: recipe.image_url || null,
    photo: recipe.photo || null,
    photo_hash: recipe.photo_hash || null,
    scale: recipe.scale || null,
    categories: recipe.categories || [],
    rating: recipe.rating || 0,
    in_trash: false,
    is_pinned: false,
    on_favorites: recipe.on_favorites || false,
    on_grocery_list: recipe.on_grocery_list || null,
    created: recipe.created || now,
    hash: crypto.createHash('sha256').update(JSON.stringify(recipe)).digest('hex').toUpperCase(),
  };

  // Gzip the recipe data
  const gzipped = zlib.gzipSync(JSON.stringify(fullRecipe));
  
  const result = await apiRequest(`/recipe/${uid}/`, 'POST', {
    data: {
      filename: 'data',
      contentType: 'application/octet-stream',
      data: gzipped
    }
  });
  
  return { uid, result };
}

async function listCategories() {
  const result = await apiRequest('/categories/');
  return result.result || [];
}

async function listGroceries() {
  const result = await apiRequest('/groceries/');
  return result.result || [];
}

async function deleteGrocery(uid) {
  const grocery = {
    uid,
    deleted: true,
  };
  const gzipped = zlib.gzipSync(JSON.stringify(grocery));
  
  return await apiRequest(`/grocery/${uid}/`, 'POST', {
    data: {
      filename: 'data',
      contentType: 'application/octet-stream',
      data: gzipped
    }
  });
}

async function clearGroceries() {
  const groceries = await listGroceries();
  const results = [];
  for (const g of groceries) {
    const r = await deleteGrocery(g.uid);
    results.push({ uid: g.uid, result: r });
  }
  return results;
}

async function listMeals() {
  const result = await apiRequest('/meals/');
  return result.result || [];
}

async function listPantry() {
  const result = await apiRequest('/pantry/');
  return result.result || [];
}

async function addPantryItem(ingredient, quantity = '', aisle = '') {
  const uid = generateUUID();
  const now = new Date().toISOString().split('T')[0] + ' 00:00:00';
  
  const item = {
    uid,
    ingredient,
    quantity,
    aisle,
    purchase_date: now,
    expiration_date: null,
    in_stock: true,
  };
  
  // v2 API expects array
  const gzipped = zlib.gzipSync(JSON.stringify([item]));
  
  const result = await apiRequestV2(`/pantry/`, 'POST', [
    {
      name: 'data',
      filename: 'file',
      contentType: 'application/octet-stream',
      data: gzipped
    }
  ]);
  
  return result;
}

async function assignCategory(recipeUid, categoryUid) {
  // Get current recipe
  const recipe = await getRecipe(recipeUid);
  if (!recipe) {
    throw new Error(`Recipe ${recipeUid} not found`);
  }
  
  // Add category if not already present
  if (!recipe.categories) {
    recipe.categories = [];
  }
  if (!recipe.categories.includes(categoryUid)) {
    recipe.categories.push(categoryUid);
  }
  
  // Update hash
  recipe.hash = crypto.createHash('sha256').update(JSON.stringify(recipe)).digest('hex').toUpperCase();
  
  // Save via v2 API
  const gzipped = zlib.gzipSync(JSON.stringify(recipe));
  
  const result = await apiRequestV2(`/recipe/${recipeUid}/`, 'POST', [
    {
      name: 'data',
      filename: 'file',
      contentType: 'application/octet-stream',
      data: gzipped
    }
  ]);
  
  return result;
}

async function removeCategory(recipeUid, categoryUid) {
  // Get current recipe
  const recipe = await getRecipe(recipeUid);
  if (!recipe) {
    throw new Error(`Recipe ${recipeUid} not found`);
  }
  
  // Remove category
  if (recipe.categories) {
    recipe.categories = recipe.categories.filter(c => c !== categoryUid);
  }
  
  // Update hash
  recipe.hash = crypto.createHash('sha256').update(JSON.stringify(recipe)).digest('hex').toUpperCase();
  
  // Save via v2 API
  const gzipped = zlib.gzipSync(JSON.stringify(recipe));
  
  const result = await apiRequestV2(`/recipe/${recipeUid}/`, 'POST', [
    {
      name: 'data',
      filename: 'file',
      contentType: 'application/octet-stream',
      data: gzipped
    }
  ]);
  
  return result;
}

async function searchCategories(query) {
  const categories = await listCategories();
  const q = query.toLowerCase();
  return categories.filter(c => c.name.toLowerCase().includes(q));
}

async function deletePantryItem(itemUid) {
  const item = {
    uid: itemUid,
    deleted: true,
  };
  
  const gzipped = zlib.gzipSync(JSON.stringify([item]));
  
  const result = await apiRequestV2(`/pantry/`, 'POST', [
    {
      name: 'data',
      filename: 'file',
      contentType: 'application/octet-stream',
      data: gzipped
    }
  ]);
  
  return result;
}

// Delete a photo by syncing with deleted: true
async function deletePhoto(photoUuid) {
  const photoMeta = {
    uid: photoUuid,
    deleted: true,
  };
  
  const gzippedMeta = zlib.gzipSync(JSON.stringify(photoMeta));
  
  return await apiRequestV2(`/photo/${photoUuid}/`, 'POST', [
    {
      name: 'data',
      filename: 'file',
      contentType: 'application/octet-stream',
      data: gzippedMeta
    }
  ]);
}

// Upload photo to dedicated photo endpoint (not bundled with recipe)
async function uploadPhotoToEndpoint(photoUuid, photoData, recipeUid, isFullSize = false) {
  // Photo metadata - full fields as sent by official app
  const photoMeta = {
    uid: photoUuid,
    hash: crypto.createHash('sha256').update(photoData).digest('hex').toUpperCase(),
    recipe_uid: recipeUid,
    filename: `${photoUuid}.jpg`,
    name: isFullSize ? '1' : '0',  // "1" for full-size, "0" for thumbnail
    order_flag: 0,
    deleted: false,
  };
  
  const gzippedMeta = zlib.gzipSync(JSON.stringify(photoMeta));
  
  return await apiRequestV2(`/photo/${photoUuid}/`, 'POST', [
    {
      name: 'data',
      filename: 'file',
      contentType: 'application/octet-stream',
      data: gzippedMeta
    },
    {
      name: 'photo_upload',
      filename: `${photoUuid}.jpg`,
      contentType: 'image/jpeg',
      data: photoData
    }
  ]);
}

/**
 * Upload a photo to a recipe.
 * 
 * This is a complex multi-step process that matches the official app behavior:
 * 
 * 1. Create 500x500 thumbnail using ImageMagick (center crop)
 * 2. Upload full-size image to /photo/{uuid}/ endpoint with recipe_uid
 * 3. Sync recipe with thumbnail bundled in multipart request
 * 4. Final sync with photo_large hash reference
 * 
 * Paprika stores both a thumbnail (photo) and full-size (photo_large) image.
 * The thumbnail is bundled with the recipe sync, while full-size goes to /photo/.
 * 
 * @param {string} recipeUid - Recipe UUID to attach photo to
 * @param {string} photoPath - Local path to image file (JPG recommended)
 * @returns {Promise<{photoUuid: string, photoLargeUuid: string, result: any}>}
 */
async function uploadPhoto(recipeUid, photoPath) {
  // First get the current recipe data via v1
  const recipe = await getRecipe(recipeUid);
  if (!recipe) {
    throw new Error(`Recipe ${recipeUid} not found`);
  }
  
  // Read the original photo (for photo_large)
  const photoLargeData = fs.readFileSync(photoPath);
  
  // Create 500x500 thumbnail for photo (center crop)
  const thumbPath = `/tmp/paprika_thumb_${Date.now()}.jpg`;
  try {
    execSync(`convert "${photoPath}" -gravity center -crop 1:1 -resize 500x500 -quality 85 "${thumbPath}"`, { stdio: 'pipe' });
  } catch (e) {
    // Fallback: just resize without crop if ImageMagick fails
    execSync(`convert "${photoPath}" -resize 500x500^ -gravity center -extent 500x500 -quality 85 "${thumbPath}"`, { stdio: 'pipe' });
  }
  const photoThumbData = fs.readFileSync(thumbPath);
  fs.unlinkSync(thumbPath); // Clean up temp file
  
  // Generate UUIDs for both photos
  const photoUuid = crypto.randomUUID().toUpperCase();
  const photoLargeUuid = crypto.randomUUID().toUpperCase();
  
  // Step 1: Upload ONLY full-size to /photo/ endpoint with recipe_uid
  console.log(`Uploading full-size to /photo/${photoLargeUuid}/...`);
  await uploadPhotoToEndpoint(photoLargeUuid, photoLargeData, recipeUid, true);
  
  // Step 2: Sync recipe with thumbnail bundled in multipart + photo_large reference
  recipe.photo = `${photoUuid}.jpg`;
  recipe.photo_large = `${photoLargeUuid}.jpg`;
  recipe.photo_hash = crypto.createHash('sha256').update(photoThumbData).digest('hex').toUpperCase();
  recipe.hash = crypto.createHash('sha256').update(JSON.stringify(recipe)).digest('hex').toUpperCase();
  
  const gzippedRecipe = zlib.gzipSync(JSON.stringify(recipe));
  
  console.log(`Syncing recipe ${recipeUid} with thumbnail bundled...`);
  await apiRequestV2(`/recipe/${recipeUid}/`, 'POST', [
    {
      name: 'data',
      filename: 'file',
      contentType: 'application/octet-stream',
      data: gzippedRecipe
    },
    {
      name: 'photo_upload',
      filename: `${photoUuid}.jpg`,
      contentType: 'image/jpeg',
      data: photoThumbData
    }
  ]);
  
  // Step 3: Second sync with photo_large hash
  recipe.photo_hash = crypto.createHash('sha256').update(photoLargeData).digest('hex').toUpperCase();
  recipe.hash = crypto.createHash('sha256').update(JSON.stringify(recipe)).digest('hex').toUpperCase();
  
  const gzippedRecipe2 = zlib.gzipSync(JSON.stringify(recipe));
  
  console.log(`Syncing recipe ${recipeUid} with photo_large reference...`);
  const result = await apiRequestV2(`/recipe/${recipeUid}/`, 'POST', [
    {
      name: 'data',
      filename: 'file',
      contentType: 'application/octet-stream',
      data: gzippedRecipe2
    }
  ]);
  
  return { photoUuid, photoLargeUuid, result };
}

async function addMeal(recipeUid, date, mealType = 0, name = '') {
  const uid = generateUUID();
  
  // Minimal meal object - meals in list response don't have hash
  const meal = {
    uid,
    recipe_uid: recipeUid,
    date: `${date} 00:00:00`, // YYYY-MM-DD 00:00:00 format
    type: mealType, // 0=breakfast, 1=lunch, 2=dinner, 3+=snacks
    name: name,
    order_flag: 0,
  };
  
  // v2 API expects an ARRAY of meals, not a single object!
  const gzipped = zlib.gzipSync(JSON.stringify([meal]));
  
  const result = await apiRequestV2(`/meals/`, 'POST', [
    {
      name: 'data',
      filename: 'file',
      contentType: 'application/octet-stream',
      data: gzipped
    }
  ]);
  
  return result;
}

async function deleteMeal(mealUid) {
  // Delete by sending meal with deleted: true (v2 API expects array)
  const meal = {
    uid: mealUid,
    deleted: true,
  };
  
  const gzipped = zlib.gzipSync(JSON.stringify([meal]));
  
  const result = await apiRequestV2(`/meals/`, 'POST', [
    {
      name: 'data',
      filename: 'file',
      contentType: 'application/octet-stream',
      data: gzipped
    }
  ]);
  
  return result;
}

// Delete a recipe using two-stage deletion (matches official app behavior)
// Stage 1: Move to trash (in_trash: true)
// Stage 2: Permanent delete (deleted: true)
async function deleteRecipe(recipeUid, permanent = false) {
  // First get the full recipe data
  const recipe = await getRecipe(recipeUid);
  if (!recipe) {
    throw new Error(`Recipe ${recipeUid} not found`);
  }
  
  if (!permanent && recipe.in_trash) {
    // Already in trash, do permanent delete
    permanent = true;
  }
  
  if (permanent) {
    // Stage 2: Permanent delete
    recipe.deleted = true;
    recipe.in_trash = true;
  } else {
    // Stage 1: Move to trash
    recipe.in_trash = true;
    recipe.deleted = false;
  }
  
  // Update hash
  recipe.hash = crypto.createHash('sha256').update(JSON.stringify(recipe)).digest('hex').toUpperCase();
  
  const gzipped = zlib.gzipSync(JSON.stringify(recipe));
  
  const result = await apiRequestV2(`/recipe/${recipeUid}/`, 'POST', [
    {
      name: 'data',
      filename: 'file',
      contentType: 'application/octet-stream',
      data: gzipped
    }
  ]);
  
  return { 
    success: true, 
    action: permanent ? 'permanently_deleted' : 'moved_to_trash',
    recipe_uid: recipeUid 
  };
}

// CLI
async function main() {
  const [,, command, ...args] = process.argv;
  
  try {
    switch (command) {
      case 'list':
      case 'recipes':
        const recipes = await listRecipes();
        console.log(JSON.stringify(recipes, null, 2));
        break;
        
      case 'get':
        if (!args[0]) {
          console.error('Usage: paprika-api.js get <uid>');
          process.exit(1);
        }
        const recipe = await getRecipe(args[0]);
        console.log(JSON.stringify(recipe, null, 2));
        break;
        
      case 'add':
        // Read recipe JSON from stdin
        let input = '';
        process.stdin.setEncoding('utf8');
        for await (const chunk of process.stdin) {
          input += chunk;
        }
        const newRecipe = JSON.parse(input);
        const saved = await saveRecipe(newRecipe);
        console.log(JSON.stringify(saved, null, 2));
        break;
        
      case 'categories':
        const cats = await listCategories();
        console.log(JSON.stringify(cats, null, 2));
        break;
        
      case 'search-category':
        if (!args[0]) {
          console.error('Usage: paprika-api.js search-category <query>');
          process.exit(1);
        }
        const matches = await searchCategories(args.join(' '));
        console.log(JSON.stringify(matches, null, 2));
        break;
        
      case 'assign-category':
        if (args.length < 2) {
          console.error('Usage: paprika-api.js assign-category <recipe-uid> <category-uid>');
          process.exit(1);
        }
        const assignResult = await assignCategory(args[0], args[1]);
        console.log(JSON.stringify(assignResult, null, 2));
        break;
        
      case 'remove-category':
        if (args.length < 2) {
          console.error('Usage: paprika-api.js remove-category <recipe-uid> <category-uid>');
          process.exit(1);
        }
        const removeResult = await removeCategory(args[0], args[1]);
        console.log(JSON.stringify(removeResult, null, 2));
        break;
      
      case 'add-category':
        if (!args[0]) {
          console.error('Usage: paprika-api.js add-category <name> [--parent <parent-uid>]');
          process.exit(1);
        }
        const parentIdx = args.indexOf('--parent');
        let catParentUid = null;
        let catName = args.join(' ');
        if (parentIdx !== -1) {
          catParentUid = args[parentIdx + 1];
          catName = args.slice(0, parentIdx).join(' ');
        }
        const newCat = await createCategory(catName, catParentUid);
        console.log(JSON.stringify(newCat, null, 2));
        break;
      
      case 'nest-category':
        if (args.length < 2) {
          console.error('Usage: paprika-api.js nest-category <child-uid> <parent-uid>');
          process.exit(1);
        }
        const nestResult = await nestCategory(args[0], args[1]);
        console.log(JSON.stringify(nestResult, null, 2));
        break;
      
      case 'delete-category':
        if (!args[0]) {
          console.error('Usage: paprika-api.js delete-category <uid>');
          process.exit(1);
        }
        const delCatResult = await deleteCategory(args[0]);
        console.log(JSON.stringify(delCatResult, null, 2));
        break;
      
      case 'rename-category':
        if (args.length < 2) {
          console.error('Usage: paprika-api.js rename-category <uid> <new-name>');
          process.exit(1);
        }
        const renameUid = args[0];
        const newName = args.slice(1).join(' ');
        const renameResult = await updateCategory(renameUid, { name: newName });
        console.log(JSON.stringify(renameResult, null, 2));
        break;
        
      case 'groceries':
        const groceries = await listGroceries();
        console.log(JSON.stringify(groceries, null, 2));
        break;
        
      case 'clear-groceries':
        const cleared = await clearGroceries();
        console.log(`Cleared ${cleared.length} grocery items`);
        break;
        
      case 'meals':
        const meals = await listMeals();
        console.log(JSON.stringify(meals, null, 2));
        break;
        
      case 'pantry':
        const pantry = await listPantry();
        console.log(JSON.stringify(pantry, null, 2));
        break;
        
      case 'add-pantry':
        if (!args[0]) {
          console.error('Usage: paprika-api.js add-pantry <ingredient> [quantity] [aisle]');
          process.exit(1);
        }
        const pantryResult = await addPantryItem(args[0], args[1] || '', args[2] || '');
        console.log(JSON.stringify(pantryResult, null, 2));
        break;
        
      case 'delete-pantry':
        if (!args[0]) {
          console.error('Usage: paprika-api.js delete-pantry <item-uid>');
          process.exit(1);
        }
        const deletePantryResult = await deletePantryItem(args[0]);
        console.log(JSON.stringify(deletePantryResult, null, 2));
        break;
        
      case 'add-meal':
        if (args.length < 2) {
          console.error('Usage: paprika-api.js add-meal <recipe-uid> <date> [type] [name]');
          console.error('  type: 0=unspecified, 1=breakfast, 2=lunch, 3=dinner, 4=snack');
          process.exit(1);
        }
        const mealResult = await addMeal(args[0], args[1], parseInt(args[2]) || 0, args[3] || '');
        console.log(JSON.stringify(mealResult, null, 2));
        break;
        
      case 'upload-photo':
        if (args.length < 2) {
          console.error('Usage: paprika-api.js upload-photo <recipe-uid> <photo-path>');
          process.exit(1);
        }
        const photoResult = await uploadPhoto(args[0], args[1]);
        console.log(JSON.stringify(photoResult, null, 2));
        break;
      
      case 'delete-photo':
        if (!args[0]) {
          console.error('Usage: paprika-api.js delete-photo <photo-uuid>');
          process.exit(1);
        }
        const delPhotoResult = await deletePhoto(args[0]);
        console.log(JSON.stringify(delPhotoResult, null, 2));
        break;
        
      case 'login':
        // Test v2 login
        const jwt = await getJwt();
        console.log('JWT obtained:', jwt.substring(0, 50) + '...');
        break;
        
      case 'delete-meal':
        if (!args[0]) {
          console.error('Usage: paprika-api.js delete-meal <meal-uid>');
          process.exit(1);
        }
        const deleteResult = await deleteMeal(args[0]);
        console.log(JSON.stringify(deleteResult, null, 2));
        break;
      
      case 'delete-recipe':
      case 'trash-recipe':
        if (!args[0]) {
          console.error('Usage: paprika-api.js delete-recipe <recipe-uid> [--permanent]');
          console.error('  Without --permanent: moves to trash');
          console.error('  With --permanent: permanently deletes (or if already in trash)');
          process.exit(1);
        }
        const permanentDelete = args.includes('--permanent');
        const deleteRecipeResult = await deleteRecipe(args[0], permanentDelete);
        console.log(JSON.stringify(deleteRecipeResult, null, 2));
        break;
        
      default:
        console.log(`Paprika Recipe Manager CLI

Commands:
  list / recipes      List all recipe UIDs
  get <uid>           Get full recipe details
  add                 Add recipe (JSON from stdin)
  categories          List all categories
  search-category <query>
                      Search categories by name
  assign-category <recipe-uid> <category-uid>
                      Add category to recipe
  remove-category <recipe-uid> <category-uid>
                      Remove category from recipe
  groceries           List grocery items
  clear-groceries     Delete all grocery items
  meals               List meal plan
  add-meal <uid> <date> [type] [name]
                      Add meal to plan (date: YYYY-MM-DD)
                      type: 0=breakfast, 1=lunch, 2=dinner, 3=snack
  delete-meal <uid>   Delete a meal from plan
  delete-recipe <uid> [--permanent]
                      Delete recipe (moves to trash, or permanent with flag)
  pantry              List pantry items
  add-pantry <ingredient> [quantity] [aisle]
                      Add item to pantry
  delete-pantry <uid> Delete item from pantry
  upload-photo <uid> <photo-path>
                      Upload photo to recipe (uses v2 API)
  login               Test v2 JWT login
`);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();

/**
 * Create a new category.
 * 
 * IMPORTANT: Categories use a DIFFERENT API pattern than recipes!
 * - Endpoint: POST /api/v2/sync/categories/ (NO uid in path)
 * - Body: Array of category objects, not single object
 * - Same endpoint for create, update, nest, and delete
 * 
 * @param {string} name - Category name
 * @param {string|null} parentUid - Parent category UID for nesting
 * @returns {Promise<{uid: string, name: string, result: any}>}
 */
async function createCategory(name, parentUid = null) {
  const uid = crypto.randomUUID().toUpperCase();
  
  // Get current categories to determine order_flag
  const existing = await listCategories();
  const maxOrder = existing.reduce((max, c) => Math.max(max, c.order_flag || 0), 0);
  
  // API expects array of category objects
  const categories = [{
    uid,
    name,
    deleted: false,
    parent_uid: parentUid,
    order_flag: maxOrder + 1,
  }];
  
  const gzipped = zlib.gzipSync(JSON.stringify(categories));
  
  // POST to /categories/ (no uid in path), using V2 API
  const result = await apiRequestV2('/categories/', 'POST', [
    {
      name: 'data',
      filename: 'file',
      contentType: 'application/octet-stream',
      data: gzipped
    }
  ]);
  
  return { uid, name, result };
}

async function updateCategory(uid, updates) {
  // Get existing category
  const existing = await listCategories();
  const category = existing.find(c => c.uid === uid);
  if (!category) {
    throw new Error(`Category not found: ${uid}`);
  }
  
  // Merge updates
  const updated = {
    uid: category.uid,
    name: updates.name ?? category.name,
    deleted: updates.deleted ?? category.deleted ?? false,
    parent_uid: updates.parent_uid !== undefined ? updates.parent_uid : category.parent_uid,
    order_flag: updates.order_flag ?? category.order_flag ?? 0,
  };
  
  const gzipped = zlib.gzipSync(JSON.stringify([updated]));
  
  const result = await apiRequestV2('/categories/', 'POST', [
    {
      name: 'data',
      filename: 'file',
      contentType: 'application/octet-stream',
      data: gzipped
    }
  ]);
  
  return { uid, updates, result };
}

async function nestCategory(childUid, parentUid) {
  return updateCategory(childUid, { parent_uid: parentUid });
}

async function deleteCategory(uid) {
  return updateCategory(uid, { deleted: true });
}
