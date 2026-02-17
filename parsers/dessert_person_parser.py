#!/usr/bin/env python3
"""Parse Dessert Person EPUB and extract recipes for Paprika import."""

from bs4 import BeautifulSoup
import glob
import json
import re
import sys
import os

def clean_text(text):
    """Clean up text, removing extra whitespace."""
    if not text:
        return ""
    return re.sub(r'\s+', ' ', text).strip()

def extract_recipe(soup, title_tag, epub_dir):
    """Extract a single recipe starting from its title tag."""
    recipe = {
        'name': '',
        'source': 'Dessert Person - Claire Saffitz',
        'description': '',
        'prep_time': '',
        'cook_time': '',
        'total_time': '',
        'difficulty': '',
        'servings': '',
        'notes': '',
        'ingredients': [],
        'directions': [],
        'categories': ['Dessert Person', 'Claire Saffitz'],
        'photos': []  # List of photo paths
    }
    
    # Get title
    recipe['name'] = clean_text(title_tag.get_text())
    
    # Look for images BEFORE and AFTER the title (recipe photos often precede the title)
    # Check previous siblings for project_img
    prev = title_tag.find_previous_sibling()
    while prev:
        if prev.name == 'p' and 'rt' in prev.get('class', []):
            break  # Hit previous recipe title
        if prev.name == 'div' and 'project_img' in prev.get('class', []):
            img = prev.find('img')
            if img and img.get('src'):
                img_path = img['src'].replace('../images/', '')
                full_path = os.path.join(epub_dir, 'OEBPS/images', img_path)
                if os.path.exists(full_path):
                    recipe['photos'].insert(0, full_path)
        prev = prev.find_previous_sibling()
    
    # Find siblings after this title
    current = title_tag.find_next_sibling()
    
    while current:
        classes = current.get('class', [])
        if isinstance(classes, str):
            classes = [classes]
        
        # Stop if we hit the next recipe title
        if 'rt' in classes:
            break
        
        # Check for images in project_img divs
        if current.name == 'div' and 'project_img' in classes:
            img = current.find('img')
            if img and img.get('src'):
                img_path = img['src'].replace('../images/', '')
                full_path = os.path.join(epub_dir, 'OEBPS/images', img_path)
                if os.path.exists(full_path) and full_path not in recipe['photos']:
                    recipe['photos'].append(full_path)
            current = current.find_next_sibling()
            continue
        
        # Also check caption_img divs
        if current.name == 'div' and 'caption_img' in classes:
            img = current.find('img')
            if img and img.get('src'):
                img_path = img['src'].replace('../images/', '')
                full_path = os.path.join(epub_dir, 'OEBPS/images', img_path)
                if os.path.exists(full_path) and full_path not in recipe['photos']:
                    recipe['photos'].append(full_path)
            current = current.find_next_sibling()
            continue
            
        text = clean_text(current.get_text())
        
        # Recipe metadata line (Season, Active Time, etc)
        if 'rul' in classes:
            if 'Active Time:' in text:
                match = re.search(r'Active Time:\s*([^|]+)', text)
                if match:
                    recipe['prep_time'] = match.group(1).strip()
            if 'Total Time:' in text:
                match = re.search(r'Total Time:\s*([^|,]+)', text)
                if match:
                    recipe['total_time'] = match.group(1).strip()
            if 'Difficulty:' in text:
                match = re.search(r'Difficulty:\s*(\d+[^|]*)', text)
                if match:
                    recipe['difficulty'] = match.group(1).strip()
        
        # Headnote/description
        elif 'rhnf' in classes or 'rh' in classes:
            recipe['description'] = text
        
        # Yield
        elif 'ry' in classes:
            recipe['servings'] = text.replace('Makes ', '').replace('Serves ', '')
        
        # Special equipment
        elif 'se' in classes:
            recipe['notes'] += f"Special Equipment: {text.replace('Special Equipment:', '').strip()}\n"
        
        # Ingredients
        elif any(c in classes for c in ['ril', 'rilf', 'riln']):
            ing_text = text
            ing_text = re.sub(r'[①②③④⑤⑥⑦⑧⑨⑩]', '', ing_text).strip()
            if ing_text:
                recipe['ingredients'].append(ing_text)
        
        # Directions
        elif any(c in classes for c in ['rpf', 'rp', 'rpl']):
            if text:
                recipe['directions'].append(text)
        
        # Do-ahead tips
        elif 'Do-Ahead' in classes:
            recipe['notes'] += f"\nDo Ahead: {text.replace('Do Ahead', '').strip()}"
        
        # Footnotes
        elif 'rbl' in classes:
            recipe['notes'] += f"\n{text}"
        
        current = current.find_next_sibling()
    
    # Clean up
    recipe['notes'] = recipe['notes'].strip()
    recipe['directions'] = '\n\n'.join(recipe['directions'])
    recipe['ingredients'] = '\n'.join(recipe['ingredients'])
    
    return recipe

def get_chapter_category(chapter_file):
    """Map chapter file to category."""
    categories = {
        'c01': 'Loaf Cakes and Single-Layer Cakes',
        'c02': 'Pies and Tarts',
        'c03': 'Cookies and Bars',
        'c04': 'Layer Cakes and Fancy Desserts',
        'c05': 'Breakfast and Brunch',
        'c06': 'Savory Baking',
        'c07': 'Basics and Building Blocks'
    }
    for key, cat in categories.items():
        if key in chapter_file:
            return cat
    return ''

def parse_epub(epub_dir, limit=None):
    """Parse all recipes from the extracted EPUB."""
    recipes = []
    
    for chapter in sorted(glob.glob(f'{epub_dir}/OEBPS/xhtml/c*.xhtml')):
        chapter_cat = get_chapter_category(chapter)
        
        with open(chapter) as f:
            soup = BeautifulSoup(f.read(), 'html.parser')
        
        for title_tag in soup.find_all('p', class_='rt'):
            recipe = extract_recipe(soup, title_tag, epub_dir)
            if recipe['name'] and recipe['name'] != 'VARIATION':
                if chapter_cat:
                    recipe['categories'].append(chapter_cat)
                recipes.append(recipe)
                
                if limit and len(recipes) >= limit:
                    return recipes
    
    return recipes

if __name__ == '__main__':
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else None
    recipes = parse_epub('/tmp/dessert_person', limit=limit)
    print(json.dumps(recipes, indent=2))
