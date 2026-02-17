#!/usr/bin/env python3
"""Parse Food of Sichuan EPUB and extract recipes for Paprika import."""

from bs4 import BeautifulSoup
import glob
import json
import re
import os

EPUB_DIR = '/tmp/food_of_sichuan'

def clean_text(text):
    """Clean up text, removing extra whitespace."""
    if not text:
        return ""
    # Remove page markers and clean whitespace
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def extract_recipes(epub_dir):
    """Extract all recipes from the EPUB."""
    recipes = []
    
    # Process recipe chapters (12-25 roughly)
    chapter_files = sorted(glob.glob(f"{epub_dir}/OEBPS/xhtml/*.xhtml"))
    
    for chapter_path in chapter_files:
        filename = os.path.basename(chapter_path)
        # Skip front matter and back matter
        if any(skip in filename.lower() for skip in ['cover', 'title', 'contents', 'introduction', 
                                                       'bibliography', 'acknowledg', 'glossary', 
                                                       'story', 'kitchen', 'larder', 'table',
                                                       'flavours', 'cooking_methods', 'fm', 'image']):
            continue
            
        with open(chapter_path, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')
        
        # Find all recipe title elements (C487 class)
        title_tags = soup.find_all('p', class_='C487')
        
        for title_tag in title_tags:
            title_text = clean_text(title_tag.get_text())
            
            # Skip chapter headers (contain Chinese characters or "Dishes" category headers)
            if '类' in title_text or title_text.endswith('Dishes') or not title_text:
                continue
            
            # Skip if it's just a chapter name
            chapter_keywords = ['Meat', 'Poultry', 'Eggs', 'Fish', 'Seafood', 'Tofu', 
                              'Vegetables', 'Soups', 'Rice', 'Noodles', 'Small Eats',
                              'Hotpot', 'Preserved Foods', 'Seasonings', 'Stocks']
            if title_text in chapter_keywords:
                continue
            
            recipe = extract_single_recipe(soup, title_tag, epub_dir)
            if recipe and recipe.get('name'):
                recipes.append(recipe)
    
    return recipes

def extract_single_recipe(soup, title_tag, epub_dir):
    """Extract a single recipe starting from its title tag."""
    recipe = {
        'name': '',
        'source': 'The Food of Sichuan - Fuchsia Dunlop',
        'description': '',
        'prep_time': '',
        'cook_time': '',
        'total_time': '',
        'difficulty': '',
        'servings': '',
        'notes': '',
        'ingredients': '',
        'directions': '',
        'categories': ['Food of Sichuan', 'Fuchsia Dunlop', 'Chinese', 'Sichuan'],
        'photos': []
    }
    
    # Get title
    recipe['name'] = clean_text(title_tag.get_text())
    
    # Collect content after title
    chinese_name = ''
    description_parts = []
    ingredients = []
    directions = []
    notes = []
    in_ingredients = False
    in_directions = False
    in_notes = False
    
    current = title_tag.find_next_sibling()
    
    while current:
        if current.name != 'p' and current.name != 'div':
            current = current.find_next_sibling()
            continue
            
        classes = current.get('class', [])
        if isinstance(classes, str):
            classes = [classes]
        text = clean_text(current.get_text())
        
        # Stop at next recipe title
        if 'C487' in classes and text and '类' not in text:
            # Check if this is a real recipe title (not just continuation)
            if not text.startswith(('For ', 'To ', 'The ', 'A ', 'With ')):
                break
        
        # Chinese name (pinyin)
        if 'C682' in classes:
            chinese_name = text
            
        # Chinese characters
        elif 'C532' in classes:
            if chinese_name:
                chinese_name += f' ({text})'
        
        # Description paragraph
        elif 'C764' in classes:
            if text.lower() == 'variation' or text.lower() == 'variations':
                in_notes = True
                in_directions = False
            elif not in_ingredients and not in_directions:
                description_parts.append(text)
        
        # Continuation of description
        elif 'C519' in classes or 'C519t' in classes:
            if in_notes:
                notes.append(text)
            elif not in_ingredients and not in_directions:
                description_parts.append(text)
        
        # First ingredient line
        elif 'C525' in classes:
            in_ingredients = True
            in_directions = False
            in_notes = False
            ingredients.append(text.strip('*'))
        
        # Subsequent ingredient lines
        elif 'C751' in classes:
            if in_ingredients:
                ingredients.append(text.strip('*'))
        
        # Ingredient subheadings (For the marinade, etc.)
        elif 'C770' in classes:
            if in_ingredients:
                ingredients.append('')  # blank line
                ingredients.append(text.upper())
        
        # Direction paragraphs
        elif 'C753' in classes:
            in_ingredients = False
            in_directions = True
            in_notes = False
            directions.append(text)
        
        # Check for images
        if current.name == 'div':
            img = current.find('img')
            if img and img.get('src'):
                img_path = img['src'].replace('../img/', '')
                full_path = os.path.join(epub_dir, 'OEBPS/img', img_path)
                if os.path.exists(full_path) and full_path not in recipe['photos']:
                    recipe['photos'].append(full_path)
        
        current = current.find_next_sibling()
    
    # Compile recipe
    if chinese_name:
        recipe['name'] = f"{recipe['name']} ({chinese_name})"
    
    recipe['description'] = ' '.join(description_parts[:2]) if description_parts else ''  # First 2 paragraphs
    recipe['ingredients'] = '\n'.join(ingredients)
    recipe['directions'] = '\n\n'.join(directions)
    recipe['notes'] = '\n'.join(notes) if notes else ''
    
    # Add remaining description to notes
    if len(description_parts) > 2:
        extra_desc = ' '.join(description_parts[2:])
        if recipe['notes']:
            recipe['notes'] = extra_desc + '\n\n' + recipe['notes']
        else:
            recipe['notes'] = extra_desc
    
    return recipe

if __name__ == '__main__':
    recipes = extract_recipes(EPUB_DIR)
    print(json.dumps(recipes, indent=2, ensure_ascii=False))
