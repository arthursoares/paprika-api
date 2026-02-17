#!/usr/bin/env python3
"""Parse Galette! EPUB and extract recipes for Paprika import."""

from bs4 import BeautifulSoup
import glob
import json
import re
import os

EPUB_DIR = '/tmp/galette'

# Chapter mapping to categories
CHAPTERS = {
    'ch01': 'A Good Crust Makes All the Difference',
    'ch02': 'Stone Fruit',
    'ch03': 'Apples, Pears, and Citrus',
    'ch04': 'Black, Blue, and Red Berries',
    'ch05': 'Chocolate and Other Sweet Things',
    'ch06': 'Winter Squash and Roots',
    'ch07': 'Nightshades and Summer Squash',
    'ch08': 'Greens, Brassicas, and Alliums',
    'ch09': 'Pantry Staples',
}

def clean_text(text):
    """Clean up text, removing extra whitespace."""
    if not text:
        return ""
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def get_chapter_category(chapter_path):
    """Get the chapter category from filename."""
    basename = os.path.basename(chapter_path).replace('.xhtml', '')
    return CHAPTERS.get(basename, '')

def extract_recipes(epub_dir):
    """Extract all recipes from the EPUB."""
    recipes = []
    
    for chapter_path in sorted(glob.glob(f"{epub_dir}/OEBPS/ch*.xhtml")):
        chapter_cat = get_chapter_category(chapter_path)
        if not chapter_cat:
            continue
            
        with open(chapter_path, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')
        
        # Find all recipe titles (h2 with class RH)
        for title_tag in soup.find_all('h2', class_='RH'):
            recipe = extract_recipe(soup, title_tag, epub_dir, chapter_cat)
            if recipe and recipe.get('name'):
                recipes.append(recipe)
    
    return recipes

def extract_recipe(soup, title_tag, epub_dir, chapter_cat):
    """Extract a single recipe starting from its title tag."""
    recipe = {
        'name': '',
        'source': 'Galette! - Rebecca Firkser',
        'description': '',
        'prep_time': '',
        'cook_time': '',
        'total_time': '',
        'difficulty': '',
        'servings': '',
        'notes': '',
        'ingredients': '',
        'directions': '',
        'categories': ['Galette! (Rebecca Firkser)', chapter_cat],
        'photos': []
    }
    
    # Get title
    recipe['name'] = clean_text(title_tag.get_text())
    
    # Look for photos BEFORE the title (they usually precede)
    prev = title_tag.find_previous_sibling()
    while prev:
        if prev.name == 'h2':
            break
        if prev.name == 'figure' and 'imagefp' in prev.get('class', []):
            img = prev.find('img')
            if img and img.get('src'):
                img_path = img['src'].replace('image/', '')
                full_path = os.path.join(epub_dir, 'OEBPS/image', img_path)
                if os.path.exists(full_path) and full_path not in recipe['photos']:
                    recipe['photos'].insert(0, full_path)
        prev = prev.find_previous_sibling()
    
    # Collect content after title
    description_parts = []
    notes_parts = []
    ingredients = []
    directions = []
    in_variation = False
    
    current = title_tag.find_next_sibling()
    
    while current:
        # Stop at next recipe title
        if current.name == 'h2' and 'RH' in current.get('class', []):
            break
        
        # Check for images
        if current.name == 'figure' and 'imagefp' in current.get('class', []):
            img = current.find('img')
            if img and img.get('src'):
                img_path = img['src'].replace('image/', '')
                full_path = os.path.join(epub_dir, 'OEBPS/image', img_path)
                if os.path.exists(full_path) and full_path not in recipe['photos']:
                    recipe['photos'].append(full_path)
            current = current.find_next_sibling()
            continue
        
        classes = current.get('class', [])
        if isinstance(classes, str):
            classes = [classes]
        
        text = clean_text(current.get_text())
        
        # Variation header
        if current.name == 'h3' and 'RVH' in classes:
            in_variation = True
            current = current.find_next_sibling()
            continue
        
        # Yield/Servings
        if 'RY' in classes:
            recipe['servings'] = text.replace('Serves ', '').replace('Makes ', '')
        
        # Description/headnotes
        elif any(c in classes for c in ['RHN1', 'RHN']):
            description_parts.append(text)
        
        # Notes
        elif 'RN1' in classes:
            note_text = text
            if note_text.startswith('Note:'):
                note_text = note_text[5:].strip()
            notes_parts.append(note_text)
        
        # Special equipment, crust variations, serve with
        elif 'RS' in classes:
            notes_parts.append(text)
        
        # Ingredients list
        elif current.name == 'ul' and 'ING' in classes:
            for li in current.find_all('li', class_='RI'):
                ing = clean_text(li.get_text())
                if ing:
                    ingredients.append(ing)
        
        # Directions list
        elif current.name == 'ol':
            for li in current.find_all('li', class_='RP'):
                step = clean_text(li.get_text())
                if step:
                    directions.append(step)
        
        # Storage instructions or variation text
        elif 'RP1' in classes:
            if in_variation:
                notes_parts.append(f"Variation: {text}")
            else:
                notes_parts.append(text)
        
        # Skip asides/boxes
        elif current.name == 'aside':
            current = current.find_next_sibling()
            continue
        
        current = current.find_next_sibling()
    
    # Compile recipe
    recipe['description'] = ' '.join(description_parts[:2]) if description_parts else ''
    if len(description_parts) > 2:
        notes_parts.insert(0, ' '.join(description_parts[2:]))
    
    recipe['ingredients'] = '\n'.join(ingredients)
    recipe['directions'] = '\n\n'.join(directions)
    recipe['notes'] = '\n\n'.join(notes_parts)
    
    return recipe

if __name__ == '__main__':
    import sys
    recipes = extract_recipes(EPUB_DIR)
    
    if '--count' in sys.argv:
        print(f"Found {len(recipes)} recipes")
        for r in recipes:
            print(f"  - {r['name']} ({len(r['photos'])} photos)")
    else:
        print(json.dumps(recipes, indent=2, ensure_ascii=False))
