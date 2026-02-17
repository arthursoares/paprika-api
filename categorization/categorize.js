#!/usr/bin/env node
/**
 * Recipe Categorization Engine
 * 
 * Applies rules from rules.yaml to categorize recipes
 * into the Paprika category taxonomy.
 * 
 * Usage:
 *   node categorize.js <recipe-uid>           # categorize single recipe
 *   node categorize.js --dry-run <uid>        # show what would be assigned
 *   node categorize.js --batch [--dry-run]    # categorize all recipes
 *   node categorize.js --test "<text>"        # test rules against text
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

// Load taxonomy and rules
const taxonomyPath = path.join(__dirname, 'taxonomy.json');
const rulesPath = path.join(__dirname, 'rules.yaml');

let taxonomy, rules;

function loadConfig() {
  taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, 'utf-8'));
  rules = yaml.parse(fs.readFileSync(rulesPath, 'utf-8'));
}

/**
 * Check if text contains any of the keywords
 */
function matchesKeywords(text, keywords, options = {}) {
  if (!text || !keywords || keywords.length === 0) return { matched: false, count: 0, words: [] };
  
  const lowerText = text.toLowerCase();
  const matchedWords = [];
  
  for (const keyword of keywords) {
    // Word boundary matching to avoid partial matches
    const regex = new RegExp(`\\b${keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(lowerText)) {
      matchedWords.push(keyword);
    }
  }
  
  const minMatches = options.minMatches || 1;
  return {
    matched: matchedWords.length >= minMatches,
    count: matchedWords.length,
    words: matchedWords
  };
}

/**
 * Check if text contains any exclude keywords
 */
function hasExcludes(text, excludes) {
  if (!text || !excludes || excludes.length === 0) return false;
  return matchesKeywords(text, excludes).matched;
}

/**
 * Get all searchable text from a recipe
 */
function getRecipeText(recipe, field = 'all') {
  const title = recipe.name || '';
  const ingredients = recipe.ingredients || '';
  const directions = recipe.directions || '';
  const notes = recipe.notes || '';
  const source = recipe.source || '';
  
  switch (field) {
    case 'title': return title;
    case 'ingredients': return ingredients;
    case 'directions': return directions;
    case 'all': return `${title} ${ingredients} ${directions} ${notes}`;
    case 'title_ingredients': return `${title} ${ingredients}`;
    default: return `${title} ${ingredients} ${directions}`;
  }
}

/**
 * Find category UID by name in taxonomy
 */
function findCategoryUid(categoryKey, taxonomySection) {
  const section = taxonomy[taxonomySection];
  if (!section) return null;
  
  const cat = section.categories?.find(c => 
    c.name.toLowerCase() === categoryKey.toLowerCase() ||
    c.name.toLowerCase().replace(/[^a-z]/g, '') === categoryKey.toLowerCase().replace(/[^a-z]/g, '')
  );
  return cat?.uid || null;
}

/**
 * Apply rules to categorize a recipe
 */
function categorizeRecipe(recipe) {
  const results = {
    recipe_uid: recipe.uid,
    recipe_name: recipe.name,
    categories: [],
    matches: {},
    existing: recipe.categories || []
  };
  
  const fullText = getRecipeText(recipe, 'all');
  const titleText = getRecipeText(recipe, 'title');
  const titleIngredients = getRecipeText(recipe, 'title_ingredients');
  const source = recipe.source || '';
  
  // Process each rule section
  for (const [section, sectionRules] of Object.entries(rules)) {
    if (!sectionRules || typeof sectionRules !== 'object') continue;
    
    for (const [categoryKey, rule] of Object.entries(sectionRules)) {
      if (!rule || typeof rule !== 'object') continue;
      
      let matched = false;
      let matchDetails = { keywords: [], source: false };
      
      // Check source matches (cookbook name)
      if (rule.sources && rule.sources.some(s => source.toLowerCase().includes(s.toLowerCase()))) {
        matched = true;
        matchDetails.source = true;
      }
      
      // Check keyword matches
      if (rule.keywords) {
        const searchText = rule.keywords_title_only ? titleText : 
                          rule.keywords_directions ? getRecipeText(recipe, 'directions') :
                          titleIngredients;
        
        const keywordMatch = matchesKeywords(searchText, rule.keywords, { minMatches: rule.min_matches });
        
        if (keywordMatch.matched) {
          // Check excludes
          if (!rule.exclude || !hasExcludes(fullText, rule.exclude)) {
            matched = true;
            matchDetails.keywords = keywordMatch.words;
          }
        }
      }
      
      // Special case: vegetarian (negative matching)
      if (section === 'tags' && categoryKey === 'vegetarian') {
        if (rule.exclude && !hasExcludes(fullText, rule.exclude)) {
          matched = true;
          matchDetails.keywords = ['no meat/fish detected'];
        } else {
          matched = false;
        }
      }
      
      if (matched) {
        // Map to taxonomy
        let uid = null;
        
        // Try direct mapping
        if (section === 'protein') {
          uid = findCategoryUid(categoryKey, 'protein');
        } else if (section === 'cuisine') {
          uid = findCategoryUid(categoryKey.replace('_', ' '), 'cuisine');
        } else if (section === 'dish_type') {
          if (categoryKey === 'soup') uid = findCategoryUid('Soups', 'dish_type');
          else if (categoryKey === 'salad') uid = findCategoryUid('Salads', 'dish_type');
          else if (categoryKey === 'curry') uid = findCategoryUid('Curry', 'dish_type');
          else if (categoryKey === 'pasta') uid = findCategoryUid('Noodles or Pasta', 'dish_type');
          else if (categoryKey === 'snacks') uid = findCategoryUid('Snacks', 'dish_type');
          else if (categoryKey === 'side_dish') uid = findCategoryUid('Side dish', 'dish_type');
        } else if (section === 'baking') {
          if (categoryKey === 'cake') uid = findCategoryUid('Cake', 'baking');
          else if (categoryKey === 'cookie') uid = findCategoryUid('Cookies', 'baking');
          else if (categoryKey === 'bread') uid = findCategoryUid('Bread', 'baking');
          else if (categoryKey === 'pie') uid = findCategoryUid('Pies & Tarts', 'baking');
          else if (categoryKey === 'pastry') uid = findCategoryUid('Pastries', 'baking');
        } else if (section === 'components') {
          if (categoryKey === 'sauce') uid = findCategoryUid('Sauces', 'components');
          else if (categoryKey === 'stock') uid = findCategoryUid('Stocks & Broths', 'components');
          else if (categoryKey === 'spice_blend') uid = findCategoryUid('Spice Blends', 'components');
          else if (categoryKey === 'dressing') uid = findCategoryUid('Dressings, Dips, and Spreads', 'components');
        } else if (section === 'meal_type') {
          if (categoryKey === 'breakfast') uid = findCategoryUid('Breakfast', 'meal_type');
          else if (categoryKey === 'dessert') uid = findCategoryUid('Desserts', 'meal_type');
          else if (categoryKey === 'mains') uid = findCategoryUid('Mains', 'meal_type');
        } else if (section === 'tags') {
          uid = findCategoryUid(categoryKey, 'tags');
          if (!uid && categoryKey === 'vegetarian') {
            uid = taxonomy.tags?.categories?.find(c => c.name === 'Vegetarian')?.uid;
          }
        }
        
        if (uid && !results.categories.includes(uid)) {
          results.categories.push(uid);
          results.matches[categoryKey] = matchDetails;
        }
      }
    }
  }
  
  // Add parent categories for nested items (Baking -> Dish Type)
  const bakingUid = taxonomy.baking?.parent_uid;
  const componentsUid = taxonomy.components?.parent_uid;
  
  if (bakingUid && results.categories.some(uid => 
    taxonomy.baking?.categories?.some(c => c.uid === uid)
  )) {
    if (!results.categories.includes(bakingUid)) {
      results.categories.push(bakingUid);
    }
  }
  
  if (componentsUid && results.categories.some(uid => 
    taxonomy.components?.categories?.some(c => c.uid === uid)
  )) {
    if (!results.categories.includes(componentsUid)) {
      results.categories.push(componentsUid);
    }
  }
  
  return results;
}

/**
 * Get human-readable category names from UIDs
 */
function getCategoryNames(uids) {
  const names = [];
  const allCategories = [];
  
  for (const section of Object.values(taxonomy)) {
    if (section.categories) {
      allCategories.push(...section.categories);
    }
  }
  
  for (const uid of uids) {
    const cat = allCategories.find(c => c.uid === uid);
    if (cat) names.push(cat.name);
    else names.push(uid);
  }
  
  return names;
}

/**
 * Log a learning when categorization is wrong
 */
function logLearning(recipe, expected, got, suggestedKeywords = {}) {
  const learningsPath = path.join(__dirname, 'learnings.yaml');
  const learnings = yaml.parse(fs.readFileSync(learningsPath, 'utf-8'));
  
  const entry = {
    recipe: recipe.name,
    recipe_uid: recipe.uid,
    expected: expected,
    got: getCategoryNames(got),
    suggested_keywords: suggestedKeywords,
    logged: new Date().toISOString().split('T')[0],
    source: 'feedback'
  };
  
  if (!learnings.pending) learnings.pending = [];
  learnings.pending.push(entry);
  learnings.stats.total_pending = learnings.pending.length;
  
  fs.writeFileSync(learningsPath, yaml.stringify(learnings));
  return entry;
}

/**
 * Review pending learnings and suggest rule updates
 */
function reviewLearnings() {
  const learningsPath = path.join(__dirname, 'learnings.yaml');
  const learnings = yaml.parse(fs.readFileSync(learningsPath, 'utf-8'));
  
  if (!learnings.pending || learnings.pending.length === 0) {
    console.log('No pending learnings to review.');
    return;
  }
  
  console.log(`\n=== ${learnings.pending.length} Pending Learnings ===\n`);
  
  // Group by missing category
  const gaps = {};
  for (const item of learnings.pending) {
    const missing = item.expected.filter(e => !item.got.includes(e));
    for (const cat of missing) {
      if (!gaps[cat]) gaps[cat] = [];
      gaps[cat].push(item.recipe);
    }
  }
  
  console.log('Category gaps:');
  for (const [cat, recipes] of Object.entries(gaps)) {
    console.log(`  ${cat}: ${recipes.length} recipes`);
    recipes.slice(0, 3).forEach(r => console.log(`    - ${r}`));
    if (recipes.length > 3) console.log(`    ... and ${recipes.length - 3} more`);
  }
  
  console.log('\nSuggested keywords to add:');
  const suggestions = {};
  for (const item of learnings.pending) {
    if (item.suggested_keywords) {
      for (const [cat, keywords] of Object.entries(item.suggested_keywords)) {
        if (!suggestions[cat]) suggestions[cat] = new Set();
        keywords.forEach(k => suggestions[cat].add(k));
      }
    }
  }
  
  for (const [cat, keywords] of Object.entries(suggestions)) {
    console.log(`  ${cat}: ${[...keywords].join(', ')}`);
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  
  // Check for yaml package
  try {
    require('yaml');
  } catch (e) {
    console.error('Missing yaml package. Run: npm install yaml');
    process.exit(1);
  }
  
  loadConfig();
  
  if (args.includes('--test')) {
    const textIdx = args.indexOf('--test') + 1;
    const testText = args[textIdx];
    
    const fakeRecipe = {
      uid: 'test',
      name: testText,
      ingredients: testText,
      directions: '',
      source: ''
    };
    
    const result = categorizeRecipe(fakeRecipe);
    console.log('Test text:', testText);
    console.log('Matched categories:', getCategoryNames(result.categories));
    console.log('Match details:', result.matches);
    return;
  }
  
  if (args.includes('--feedback')) {
    const idx = args.indexOf('--feedback');
    const recipeName = args[idx + 1];
    const expectedIdx = args.indexOf('--expected');
    
    if (!recipeName || expectedIdx === -1) {
      console.error('Usage: node categorize.js --feedback "Recipe Name" --expected "Cat1,Cat2" [--suggest "cat:keyword1,keyword2"]');
      process.exit(1);
    }
    
    const expected = args[expectedIdx + 1].split(',').map(s => s.trim());
    
    // Parse suggested keywords
    const suggestIdx = args.indexOf('--suggest');
    const suggested = {};
    if (suggestIdx !== -1) {
      const suggestStr = args[suggestIdx + 1];
      const [cat, keywords] = suggestStr.split(':');
      suggested[cat] = keywords.split(',').map(s => s.trim());
    }
    
    // Categorize and log
    const fakeRecipe = { uid: 'feedback-' + Date.now(), name: recipeName, ingredients: recipeName, directions: '', source: '' };
    const result = categorizeRecipe(fakeRecipe);
    
    const entry = logLearning(fakeRecipe, expected, result.categories, suggested);
    console.log('Logged learning:');
    console.log(`  Recipe: ${entry.recipe}`);
    console.log(`  Expected: ${entry.expected.join(', ')}`);
    console.log(`  Got: ${entry.got.join(', ')}`);
    if (Object.keys(suggested).length > 0) {
      console.log(`  Suggested: ${JSON.stringify(suggested)}`);
    }
    return;
  }
  
  if (args.includes('--review')) {
    reviewLearnings();
    return;
  }
  
  if (args.includes('--help') || args.length === 0) {
    console.log(`
Recipe Categorization Engine

Usage:
  node categorize.js --test "<text>"        Test rules against text
  node categorize.js --feedback "<recipe>" --expected "Cat1,Cat2" [--suggest "cat:kw1,kw2"]
                                            Log a categorization gap
  node categorize.js --review               Review pending learnings
  node categorize.js <recipe-uid>           Categorize single recipe (TODO)
  node categorize.js --batch [--dry-run]    Categorize all recipes (TODO)

Options:
  --dry-run    Don't apply changes, just show results
  --verbose    Show detailed match information
`);
    return;
  }
  
  // For actual recipe categorization, we'd need to import paprika-api
  console.log('Taxonomy loaded:', Object.keys(taxonomy).join(', '));
  console.log('Rules loaded:', Object.keys(rules).join(', '));
  console.log('\nUse --test "<text>" to test categorization rules');
}

main().catch(console.error);

// Export for use as module
module.exports = { categorizeRecipe, getCategoryNames, loadConfig };
