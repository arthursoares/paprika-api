#!/usr/bin/env node
/**
 * LLM-based recipe categorization
 * Uses Claude Haiku to assign categories with confidence scores
 */

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const taxonomyPath = path.join(__dirname, 'taxonomy.json');
const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, 'utf-8'));

// Build flat category list from taxonomy
function getCategoryList() {
  const categories = [];
  for (const [groupName, group] of Object.entries(taxonomy)) {
    if (group.categories) {
      for (const cat of group.categories) {
        categories.push({
          uid: cat.uid,
          name: cat.name,
          group: groupName
        });
      }
    }
  }
  return categories;
}

// Format categories for prompt
function formatCategoriesForPrompt(categories) {
  const grouped = {};
  for (const cat of categories) {
    if (!grouped[cat.group]) grouped[cat.group] = [];
    grouped[cat.group].push(cat.name);
  }
  
  let output = '';
  for (const [group, names] of Object.entries(grouped)) {
    output += `${group}: ${names.join(', ')}\n`;
  }
  return output;
}

async function categorizeRecipe(recipe, options = {}) {
  const { threshold = 0.7, verbose = false } = options;
  
  const client = new OpenAI();
  const categories = getCategoryList();
  const categoryNames = categories.map(c => c.name);
  
  const recipeText = `
Title: ${recipe.name || recipe.title}
Description: ${recipe.description || 'N/A'}
Ingredients: ${recipe.ingredients || 'N/A'}
Source: ${recipe.source || 'N/A'}
`.trim();

  // Get current recipe categories to preserve book/author tags
  const currentCatNames = (recipe.categories || [])
    .map(uid => categories.find(c => c.uid === uid)?.name)
    .filter(Boolean);

  const prompt = `You are a recipe categorization expert. Assign categories to this recipe.

AVAILABLE CATEGORIES (use exact names, prioritize these):
${formatCategoriesForPrompt(categories)}

RECIPE:
${recipeText}

CURRENT CATEGORIES:
${currentCatNames.length > 0 ? currentCatNames.join(', ') : 'None'}

PROTECTED CATEGORIES (never remove - these are book/author tags):
Galette!, Ottolenghi, Yotam Ottolenghi, Mezcla, Dessert Person, Claire Saffitz, Food of Sichuan, any category containing "Book", "Author", or specific cookbook names

Assign confidence 0.0-1.0 to SPECIFIC category names from the AVAILABLE list.
Use EXACT names like "French", "Vegetarian", "Mains", "Soups", etc.

JSON format:
{
  "categories": {
    "French": 0.9,
    "Vegetarian": 0.95,
    "Mains": 0.7
  },
  "remove": {
    "Desserts": 0.95
  },
  "suggested_new": {
    "Category Name That Doesn't Exist": 0.95
  },
  "reasoning": "brief explanation"
}

Rules:
- "categories": assign confidence 0.0-1.0 for categories that SHOULD be there
- "remove": flag current categories that are WRONG with confidence they should be removed
- Only include in "remove" if confidence >= 0.8 that it's incorrect
- Use EXISTING categories from the list — don't invent new ones
- If you strongly believe a NEW category is needed (>=0.9 confidence), add to "suggested_new"
- A savory dish with coconut/cream is NOT automatically a dessert
- Consider the whole dish, not individual ingredients
- NEVER remove book/author categories (Ottolenghi, Galette!, etc.)`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.choices[0].message.content;
  
  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse LLM response');
  }
  
  const result = JSON.parse(jsonMatch[0]);
  
  // Filter by threshold and map to UIDs
  const assignedCategories = [];
  for (const [name, confidence] of Object.entries(result.categories)) {
    if (confidence >= threshold) {
      const cat = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (cat) {
        assignedCategories.push({
          uid: cat.uid,
          name: cat.name,
          confidence,
          group: cat.group
        });
      }
    }
  }
  
  // Capture suggested new categories
  const suggestedNew = [];
  if (result.suggested_new) {
    for (const [name, confidence] of Object.entries(result.suggested_new)) {
      if (confidence >= 0.9) {
        suggestedNew.push({ name, confidence });
      }
    }
  }

  // Capture categories to remove
  const toRemove = [];
  if (result.remove) {
    for (const [name, confidence] of Object.entries(result.remove)) {
      if (confidence >= 0.8) {
        const cat = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
        if (cat) {
          // Never remove book/author categories
          const protectedPatterns = ['ottolenghi', 'galette', 'mezcla', 'dessert person', 'saffitz', 'sichuan', 'book', 'author'];
          const isProtected = protectedPatterns.some(p => cat.name.toLowerCase().includes(p));
          if (!isProtected) {
            toRemove.push({ uid: cat.uid, name: cat.name, confidence });
          }
        }
      }
    }
  }

  return {
    recipe: recipe.name || recipe.title,
    categories: assignedCategories,
    toRemove,
    suggestedNew,
    reasoning: result.reasoning,
    usage: response.usage ? { 
      input_tokens: response.usage.prompt_tokens, 
      output_tokens: response.usage.completion_tokens 
    } : null
  };
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.length === 0) {
    console.log(`
LLM Recipe Categorization

Usage:
  node categorize-llm.js --test "Recipe title and ingredients"
  node categorize-llm.js --recipe <uid>
  node categorize-llm.js --threshold 0.8 --recipe <uid>

Options:
  --test <text>      Test with inline recipe text
  --recipe <uid>     Categorize a recipe by UID
  --threshold <n>    Confidence threshold (default: 0.7)
  --apply            Actually apply categories (otherwise dry-run)
  --verbose          Show detailed output
`);
    return;
  }
  
  const threshold = args.includes('--threshold') 
    ? parseFloat(args[args.indexOf('--threshold') + 1]) 
    : 0.7;
  const verbose = args.includes('--verbose');
  const apply = args.includes('--apply');
  
  if (args.includes('--test')) {
    const text = args[args.indexOf('--test') + 1];
    const result = await categorizeRecipe({ name: text }, { threshold, verbose });
    
    console.log(`\n📋 ${result.recipe}`);
    console.log(`\n🏷️  Categories to ADD (threshold ${threshold}):`);
    for (const cat of result.categories) {
      console.log(`   ✅ ${cat.name} (${(cat.confidence * 100).toFixed(0)}%) — ${cat.group}`);
    }
    if (result.toRemove && result.toRemove.length > 0) {
      console.log(`\n🗑️  Categories to REMOVE:`);
      for (const cat of result.toRemove) {
        console.log(`   ❌ ${cat.name} (${(cat.confidence * 100).toFixed(0)}% confidence it's wrong)`);
      }
    }
    if (result.suggestedNew && result.suggestedNew.length > 0) {
      console.log(`\n💡 Suggested NEW categories:`);
      for (const sug of result.suggestedNew) {
        console.log(`   ⭐ ${sug.name} (${(sug.confidence * 100).toFixed(0)}%)`);
      }
    }
    console.log(`\n💭 ${result.reasoning}`);
    console.log(`\n📊 Tokens: ${result.usage.input_tokens} in / ${result.usage.output_tokens} out`);
    return;
  }
  
  if (args.includes('--recipe')) {
    const uid = args[args.indexOf('--recipe') + 1];
    const { execSync } = require('child_process');
    const paprikaDir = path.join(__dirname, '..');
    
    const recipe = JSON.parse(
      execSync(`node ${paprikaDir}/dist/cli.js get ${uid} 2>/dev/null`)
    );
    
    const result = await categorizeRecipe(recipe, { threshold, verbose });
    
    console.log(`\n📋 ${result.recipe}`);
    console.log(`\n🏷️  Categories (threshold ${threshold}):`);
    for (const cat of result.categories) {
      console.log(`   ${cat.name} (${(cat.confidence * 100).toFixed(0)}%) — ${cat.group}`);
    }
    console.log(`\n💭 ${result.reasoning}`);
    
    if (apply && (result.categories.length > 0 || result.toRemove.length > 0)) {
      console.log('\n⏳ Applying changes...');
      for (const cat of result.categories) {
        try {
          execSync(`node ${paprikaDir}/dist/cli.js assign-category "${uid}" "${cat.uid}" 2>/dev/null`);
          console.log(`   ✅ Added: ${cat.name}`);
        } catch (e) {
          console.log(`   ❌ Failed to add: ${cat.name}`);
        }
      }
      for (const cat of result.toRemove) {
        try {
          execSync(`node ${paprikaDir}/dist/cli.js remove-category "${uid}" "${cat.uid}" 2>/dev/null`);
          console.log(`   🗑️  Removed: ${cat.name}`);
        } catch (e) {
          console.log(`   ❌ Failed to remove: ${cat.name}`);
        }
      }
    }
    
    console.log(`\n📊 Tokens: ${result.usage.input_tokens} in / ${result.usage.output_tokens} out`);
  }
}

main().catch(console.error);

module.exports = { categorizeRecipe, getCategoryList };
