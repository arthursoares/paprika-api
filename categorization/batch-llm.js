#!/usr/bin/env node
/**
 * Batch LLM categorization with vector index rebuild
 * Usage: node batch-llm.js [--filter <category-uid>] [--threshold 0.7] [--dry-run]
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const paprikaDir = path.join(__dirname, '..');
const { categorizeRecipe, getCategoryList } = require('./categorize-llm.js');

async function getRecipeUids(filterCategoryUid) {
  const rawList = JSON.parse(execSync(`node ${paprikaDir}/dist/cli.js list 2>/dev/null`));
  // Handle both formats: array of strings or array of {uid, hash}
  const uids = rawList.map(item => typeof item === 'string' ? item : item.uid);
  
  if (!filterCategoryUid) return uids;
  
  // Filter by category
  const filtered = [];
  console.log(`Filtering recipes by category ${filterCategoryUid}...`);
  
  for (const uid of uids) {
    try {
      const recipe = JSON.parse(execSync(`node ${paprikaDir}/dist/cli.js get ${uid} 2>/dev/null`));
      if (recipe.categories && recipe.categories.includes(filterCategoryUid)) {
        filtered.push(uid);
      }
    } catch (e) {}
  }
  
  return filtered;
}

async function main() {
  const args = process.argv.slice(2);
  const threshold = args.includes('--threshold') 
    ? parseFloat(args[args.indexOf('--threshold') + 1]) 
    : 0.7;
  const dryRun = args.includes('--dry-run');
  const filterUid = args.includes('--filter') 
    ? args[args.indexOf('--filter') + 1] 
    : null;
  const limit = args.includes('--limit')
    ? parseInt(args[args.indexOf('--limit') + 1])
    : null;
  const skipIndex = args.includes('--skip-index');
  
  console.log('🤖 LLM Batch Categorization');
  console.log(`   Threshold: ${threshold}`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (filterUid) console.log(`   Filter: ${filterUid}`);
  if (limit) console.log(`   Limit: ${limit}`);
  console.log('');
  
  // Get recipe UIDs
  let uids = await getRecipeUids(filterUid);
  if (limit) uids = uids.slice(0, limit);
  
  console.log(`📋 Processing ${uids.length} recipes\n`);
  
  const categoryList = getCategoryList();
  let totalCategories = 0;
  let totalTokens = 0;
  let processed = 0;
  let errors = 0;
  const allSuggestedNew = {}; // Track suggested new categories
  
  for (let i = 0; i < uids.length; i++) {
    const uid = uids[i];
    
    try {
      // Get recipe
      const recipe = JSON.parse(execSync(`node ${paprikaDir}/dist/cli.js get ${uid} 2>/dev/null`));
      const currentCats = recipe.categories || [];
      
      // Categorize with LLM
      const result = await categorizeRecipe(recipe, { threshold });
      
      // Find new categories (not already assigned)
      const newCats = result.categories.filter(c => !currentCats.includes(c.uid));
      
      if (newCats.length > 0) {
        const catNames = newCats.map(c => `${c.name} (${Math.round(c.confidence * 100)}%)`).join(', ');
        console.log(`✅ ${recipe.name.substring(0, 45).padEnd(45)} +${newCats.length} (${catNames})`);
        
        if (!dryRun) {
          for (const cat of newCats) {
            try {
              execSync(`node ${paprikaDir}/dist/cli.js assign-category "${uid}" "${cat.uid}" 2>/dev/null`);
            } catch (e) {
              console.log(`   ⚠️ Failed to assign ${cat.name}`);
            }
          }
        }
        
        totalCategories += newCats.length;
      }
      
      // Track suggested new categories
      if (result.suggestedNew && result.suggestedNew.length > 0) {
        for (const sug of result.suggestedNew) {
          if (!allSuggestedNew[sug.name]) {
            allSuggestedNew[sug.name] = { count: 0, examples: [] };
          }
          allSuggestedNew[sug.name].count++;
          if (allSuggestedNew[sug.name].examples.length < 3) {
            allSuggestedNew[sug.name].examples.push(recipe.name);
          }
        }
      }
      
      if (result.usage) {
        totalTokens += (result.usage.input_tokens || 0) + (result.usage.output_tokens || 0);
      }
      
      processed++;
      
      // Progress every 25
      if ((i + 1) % 25 === 0) {
        const cost = (totalTokens / 1000000) * 0.15; // GPT-4o-mini pricing approx
        console.log(`\n📊 Progress: ${i + 1}/${uids.length} | +${totalCategories} cats | ~$${cost.toFixed(4)}\n`);
      }
      
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 100));
      
    } catch (e) {
      errors++;
      console.log(`❌ ${uid.substring(0, 8)}... — ${e.message}`);
    }
  }
  
  const totalCost = (totalTokens / 1000000) * 0.15;
  
  console.log('\n' + '='.repeat(60));
  console.log(`✅ Complete: ${processed} recipes, +${totalCategories} categories`);
  console.log(`📊 Tokens: ${totalTokens.toLocaleString()} (~$${totalCost.toFixed(4)})`);
  if (errors > 0) console.log(`⚠️ Errors: ${errors}`);
  
  // Report suggested new categories
  const suggestedEntries = Object.entries(allSuggestedNew).sort((a, b) => b[1].count - a[1].count);
  if (suggestedEntries.length > 0) {
    console.log('\n💡 SUGGESTED NEW CATEGORIES (for review):');
    for (const [name, data] of suggestedEntries) {
      console.log(`   ⭐ "${name}" — ${data.count} recipes`);
      console.log(`      Examples: ${data.examples.join(', ')}`);
    }
  }
  
  // Rebuild vector index
  if (!dryRun && !skipIndex) {
    console.log('\n🔄 Rebuilding vector index...');
    try {
      execSync(`node ${paprikaDir}/build-index.js`, { stdio: 'inherit' });
      console.log('✅ Index rebuilt');
    } catch (e) {
      console.log('⚠️ Index rebuild failed — run manually: node build-index.js');
    }
  }
}

main().catch(console.error);
