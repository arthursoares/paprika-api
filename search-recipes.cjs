#!/usr/bin/env node
/**
 * Semantic recipe search using embeddings
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const INDEX_FILE = path.join(__dirname, 'recipes-index.json');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || execSync('sops -d --extract \'["openai_api_key"]\' ~/clawd/secrets/api-keys.enc.yaml', { encoding: 'utf8' }).trim();

function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
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
      input: text,
    }),
  });
  
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.data[0].embedding;
}

async function search(query, options = {}) {
  const { limit = 10, minScore = 0.3, filters = {} } = options;
  
  // Load index
  if (!fs.existsSync(INDEX_FILE)) {
    throw new Error('Index not found. Run build-recipe-index.js first.');
  }
  const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  
  // Get query embedding
  const queryEmbedding = await getEmbedding(query);
  
  // Score all recipes
  const results = [];
  for (const [uid, recipe] of Object.entries(index)) {
    // Apply filters
    if (filters.maxTime && recipe.meta.totalTime > filters.maxTime) continue;
    if (filters.complexity && recipe.meta.complexity !== filters.complexity) continue;
    if (filters.method && !recipe.meta.methods.includes(filters.method)) continue;
    if (filters.ingredient) {
      const hasIngredient = recipe.meta.ingredients.some(i => 
        i.includes(filters.ingredient.toLowerCase())
      );
      if (!hasIngredient) continue;
    }
    
    const score = cosineSimilarity(queryEmbedding, recipe.embedding);
    if (score >= minScore) {
      results.push({ uid, score, ...recipe });
    }
  }
  
  // Sort by score and return top results
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: search-recipes.js <query> [--limit N] [--max-time M] [--ingredient I]');
    console.log('\nExamples:');
    console.log('  search-recipes.js "quick weeknight dinner"');
    console.log('  search-recipes.js "impressive dish for guests" --limit 5');
    console.log('  search-recipes.js "comfort food" --max-time 30');
    console.log('  search-recipes.js "what can I make with chicken"');
    process.exit(0);
  }
  
  // Parse arguments
  let query = '';
  const options = { limit: 10, filters: {} };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit') {
      options.limit = parseInt(args[++i]);
    } else if (args[i] === '--max-time') {
      options.filters.maxTime = parseInt(args[++i]);
    } else if (args[i] === '--ingredient') {
      options.filters.ingredient = args[++i];
    } else if (args[i] === '--complexity') {
      options.filters.complexity = args[++i];
    } else if (args[i] === '--method') {
      options.filters.method = args[++i];
    } else {
      query += (query ? ' ' : '') + args[i];
    }
  }
  
  console.log(`🔍 Searching: "${query}"\n`);
  
  const results = await search(query, options);
  
  if (results.length === 0) {
    console.log('No matching recipes found.');
    return;
  }
  
  for (const r of results) {
    const score = (r.score * 100).toFixed(1);
    const time = r.meta.totalTime ? `${r.meta.totalTime}min` : '?';
    console.log(`[${score}%] ${r.meta.name}`);
    console.log(`       ⏱️ ${time} | 📊 ${r.meta.complexity} | 🔧 ${r.meta.methods.join(', ')}`);
    console.log(`       🥘 ${r.meta.ingredients.slice(0, 5).join(', ')}${r.meta.ingredients.length > 5 ? '...' : ''}`);
    console.log();
  }
}

main().catch(console.error);
