#!/usr/bin/env python3
"""
Parser for "Linger" by Hetty Lui McKinnon
EPUB structure: xhtml files with recipe content
"""

import json
import os
import re
import sys
from bs4 import BeautifulSoup
from pathlib import Path
import uuid

EPUB_DIR = "/tmp/linger/epub/OEBPS"
OUTPUT_DIR = "/tmp/linger/recipes"

def extract_text(element):
    """Extract text from element, handling None"""
    if element is None:
        return ""
    return element.get_text(strip=True)

def parse_recipe(xhtml_path):
    """Parse a single recipe xhtml file"""
    with open(xhtml_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')
    
    # Get title from h2 with class rt-supb-pg or similar
    title_elem = soup.find('h2', class_=re.compile(r'rt-supb|rchtit'))
    if not title_elem:
        title_elem = soup.find('h2')
    if not title_elem:
        return None
    
    title = extract_text(title_elem)
    if not title or len(title) < 3:
        return None
    
    # Skip non-recipe pages
    skip_patterns = ['chapter', 'contents', 'copyright', 'dedication', 'index', 'acknowledgments', 'introduction', 'playlist']
    if any(p in title.lower() for p in skip_patterns):
        return None
    
    # Get description (first paragraph with class rhnf or rctx)
    desc_elem = soup.find('p', class_=re.compile(r'rhnf|rctx|rnf'))
    description = extract_text(desc_elem) if desc_elem else ""
    
    # Get servings (class ry)
    servings_elem = soup.find('p', class_='ry')
    servings = extract_text(servings_elem) if servings_elem else ""
    
    # Get dietary notes (class rni)
    notes_elem = soup.find('p', class_='rni')
    dietary_notes = extract_text(notes_elem) if notes_elem else ""
    
    # Get ingredients (classes ril, rilf, r1bl)
    ingredients = []
    for ing in soup.find_all('p', class_=re.compile(r'^ril|r1bl')):
        text = extract_text(ing)
        if text and not text.startswith('•'):
            ingredients.append(text)
        elif text and text.startswith('•'):
            ingredients.append(text[1:].strip())
    
    # Get sub-headers for ingredients
    for header in soup.find_all('h3', class_=re.compile(r'rilh')):
        header_text = extract_text(header)
        if header_text:
            ingredients.append(f"\n**{header_text}**")
    
    # Get directions (classes rp, rpf, rpf-alt)
    directions = []
    for step in soup.find_all('p', class_=re.compile(r'^rp|rpf')):
        text = extract_text(step)
        if text:
            directions.append(text)
    
    # Get notes (class rn)
    notes = []
    for note in soup.find_all('p', class_='rn'):
        text = extract_text(note)
        if text:
            notes.append(text)
    
    # Get image
    img_elem = soup.find('img', class_='fill')
    image_src = img_elem.get('src', '') if img_elem else ""
    if image_src and image_src.startswith('../'):
        image_src = image_src.replace('../', '')
    
    if not ingredients and not directions:
        return None
    
    return {
        'name': title,
        'description': description,
        'servings': servings,
        'dietary_notes': dietary_notes,
        'ingredients': '\n'.join(ingredients),
        'directions': '\n\n'.join(directions),
        'notes': '\n'.join(notes),
        'image_path': os.path.join(EPUB_DIR, image_src) if image_src else None,
        'source': 'Linger by Hetty Lui McKinnon',
        'uid': str(uuid.uuid4()).upper()
    }

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    xhtml_dir = Path(EPUB_DIR) / "xhtml"
    recipes = []
    
    for xhtml_file in sorted(xhtml_dir.glob("*.xhtml")):
        recipe = parse_recipe(xhtml_file)
        if recipe:
            recipes.append(recipe)
            print(f"✅ {recipe['name'][:50]}")
    
    # Save all recipes
    output_path = os.path.join(OUTPUT_DIR, "linger_recipes.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(recipes, f, indent=2, ensure_ascii=False)
    
    print(f"\n📚 Parsed {len(recipes)} recipes")
    print(f"📁 Saved to {output_path}")

if __name__ == "__main__":
    main()
