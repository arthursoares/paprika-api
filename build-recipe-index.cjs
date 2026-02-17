#!/usr/bin/env node
/**
 * Build recipe embeddings index for semantic search
 * Uses OpenAI text-embedding-3-small (same as memory_search)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PAPRIKA_API = path.join(__dirname, 'dist/cli.js');
const INDEX_FILE = path.join(__dirname, 'recipes-index.json');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || execSync('sops -d --extract \'["openai_api_key"]\' ~/clawd/secrets/api-keys.enc.yaml', { encoding: 'utf8' }).trim();

// Method keywords to detect
const METHOD_KEYWORDS = {
  'pan-fry': ['pan-fry', 'pan fry', 'fry in', 'frying pan', 'sauté', 'saute', 'sear'],
  'roast': ['roast', 'roasting', 'oven'],
  'grill': ['grill', 'bbq', 'barbecue', 'charred'],
  'bake': ['bake', 'baking', 'baked'],
  'braise': ['braise', 'braised', 'slow-cook', 'slow cook'],
  'steam': ['steam', 'steamed', 'steaming'],
  'boil': ['boil', 'boiled', 'blanch', 'simmer'],
  'raw': ['raw', 'no-cook', 'no cook', 'uncooked'],
  'blend': ['blend', 'blender', 'food processor', 'purée', 'puree'],
  'stir-fry': ['stir-fry', 'stir fry', 'wok'],
};

// Tool keywords to detect
const TOOL_KEYWORDS = {
  'oven': ['oven', 'bake', 'roast'],
  'stovetop': ['pan', 'pot', 'saucepan', 'frying', 'sauté', 'boil', 'simmer'],
  'grill': ['grill', 'bbq', 'barbecue'],
  'blender': ['blender', 'food processor', 'blend'],
  'stand mixer': ['stand mixer', 'mixer'],
  'wok': ['wok', 'stir-fry'],
  'slow cooker': ['slow cooker', 'crockpot'],
  'pressure cooker': ['pressure cooker', 'instant pot'],
};

// Complexity detection
function detectComplexity(recipe) {
  const steps = (recipe.directions || '').split(/\d+\./).length - 1;
  const ingredients = (recipe.ingredients || '').split('\n').filter(i => i.trim()).length;
  const totalTime = parseTime(recipe.total_time) || parseTime(recipe.cook_time) + parseTime(recipe.prep_time);
  
  if (steps <= 3 && ingredients <= 6 && totalTime <= 20) return 'very easy';
  if (steps <= 5 && ingredients <= 10 && totalTime <= 30) return 'easy';
  if (steps <= 8 && ingredients <= 15 && totalTime <= 60) return 'medium';
  if (steps <= 12 && ingredients <= 20 && totalTime <= 120) return 'complex';
  return 'advanced';
}

function parseTime(timeStr) {
  if (!timeStr) return 0;
  const hours = (timeStr.match(/(\d+)\s*h/i) || [0, 0])[1] * 60;
  const mins = (timeStr.match(/(\d+)\s*m/i) || [0, 0])[1] * 1;
  return hours + mins;
}

function detectMethods(recipe) {
  const text = `${recipe.directions} ${recipe.name}`.toLowerCase();
  const methods = [];
  for (const [method, keywords] of Object.entries(METHOD_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      methods.push(method);
    }
  }
  return methods.length ? methods : ['mixed'];
}

function detectTools(recipe) {
  const text = `${recipe.directions} ${recipe.ingredients}`.toLowerCase();
  const tools = [];
  for (const [tool, keywords] of Object.entries(TOOL_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      tools.push(tool);
    }
  }
  return tools.length ? tools : ['basic'];
}

function extractIngredients(ingredientsStr) {
  if (!ingredientsStr) return [];
  return ingredientsStr
    .split('\n')
    .map(line => {
      // Remove quantities and units, keep ingredient name
      return line
        .replace(/^\d+[\d\/\.\s]*(g|kg|ml|l|oz|lb|cup|tbsp|tsp|teaspoon|tablespoon|bunch|clove|head|piece|pinch|handful)s?\b/gi, '')
        .replace(/^[\d\/\.\s]+/, '')
        .replace(/,.*$/, '')
        .replace(/\(.*\)/, '')
        .trim()
        .toLowerCase();
    })
    .filter(i => i.length > 1);
}

function buildRecipeDocument(recipe) {
  const ingredients = extractIngredients(recipe.ingredients);
  const methods = detectMethods(recipe);
  const tools = detectTools(recipe);
  const complexity = detectComplexity(recipe);
  const totalTime = parseTime(recipe.total_time) || parseTime(recipe.cook_time) + parseTime(recipe.prep_time);
  
  // Build text document for embedding
  const doc = `
${recipe.name}
${recipe.description || ''}
Ingredients: ${ingredients.join(', ')}
Time: ${totalTime ? totalTime + ' minutes' : 'unknown'}
Complexity: ${complexity}
Methods: ${methods.join(', ')}
Tools: ${tools.join(', ')}
Categories: ${(recipe.categories || []).join(', ')}
${recipe.source || ''}
  `.trim();
  
  return {
    text: doc,
    meta: {
      name: recipe.name,
      ingredients,
      totalTime,
      complexity,
      methods,
      tools,
      source: recipe.source,
      servings: recipe.servings,
      rating: recipe.rating,
    }
  };
}

async function getEmbedding(text) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.substring(0, 8000), // Truncate if too long
    }),
  });
  
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.data[0].embedding;
}

async function main() {
  console.log('🔍 Building recipe embeddings index...\n');
  
  // Load existing index if present
  let index = {};
  if (fs.existsSync(INDEX_FILE)) {
    index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    console.log(`📂 Loaded existing index with ${Object.keys(index).length} recipes`);
  }
  
  // Get all recipe UIDs
  console.log('📋 Fetching recipe list...');
  const listOutput = execSync(`node "${PAPRIKA_API}" list`, { encoding: 'utf8' });
  const uids = JSON.parse(listOutput).map(r => r.uid);
  console.log(`   Found ${uids.length} recipes\n`);
  
  // Process each recipe
  let processed = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const uid of uids) {
    // Skip if already indexed
    if (index[uid]) {
      skipped++;
      continue;
    }
    
    try {
      // Fetch full recipe
      const recipeOutput = execSync(`node "${PAPRIKA_API}" get "${uid}"`, { encoding: 'utf8' });
      const recipe = JSON.parse(recipeOutput);
      
      if (!recipe.name) {
        skipped++;
        continue;
      }
      
      // Build document
      const doc = buildRecipeDocument(recipe);
      
      // Get embedding
      const embedding = await getEmbedding(doc.text);
      
      // Store in index
      index[uid] = {
        ...doc,
        embedding,
      };
      
      processed++;
      process.stdout.write(`\r✅ Processed: ${processed} | Skipped: ${skipped} | Errors: ${errors}`);
      
      // Save periodically
      if (processed % 20 === 0) {
        fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
      }
      
      // Rate limit
      await new Promise(r => setTimeout(r, 100));
      
    } catch (e) {
      errors++;
      console.error(`\n❌ Error processing ${uid}: ${e.message}`);
    }
  }
  
  // Final save
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
  
  console.log(`\n\n📊 Complete!`);
  console.log(`   Indexed: ${Object.keys(index).length}`);
  console.log(`   New: ${processed}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  console.log(`\n💾 Saved to: ${INDEX_FILE}`);
}

main().catch(console.error);
