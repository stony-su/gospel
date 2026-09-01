"""Index the Wikibooks Cookbook by cuisine and by course.

The Cookbook cross-files every recipe under Category:Recipes by origin and
Category:Recipes by meal or course, so both labels come from the Cookbook's own
editors rather than from a scraper guessing at them from the dish name. That
matters: cuisine drives what a reader can filter the plan to, and the meal slot
decides which of the day's three meals a dish is even eligible for. Neither is
something to infer from the word "soup".

The trees are crawled once and cached to disk, because they are several hundred
category pages and they do not change between builds.

Run:  python scripts/cookbook_index.py       (prints the distribution)
Out:  cache/cookbook_index.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import wikimedia  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "cache" / "cookbook_index.json"

# Wikibooks category -> the cuisine id the app uses. Ordered most specific
# first: a page in both "Sicilian recipes" and "Italian recipes" is Italian,
# and one in both "Japanese recipes" and "Asian recipes" is Japanese, so the
# broad regional categories only apply to what the specific ones missed.
CUISINE_CATEGORIES: list[tuple[str, str]] = [
    # The five the library is built around.
    ("Japanese recipes", "japanese"),
    ("Italian recipes", "italian"),
    ("Sicilian recipes", "italian"),
    ("American recipes", "american"),
    ("United States recipes", "american"),
    ("Cajun recipes", "american"),
    ("Creole recipes", "american"),
    ("Southern US recipes", "american"),
    ("French recipes", "french"),
    ("Spanish recipes", "spanish"),
    ("Catalan recipes", "spanish"),
    ("Basque recipes", "spanish"),
    # The scattering.
    ("Chinese recipes", "chinese"),
    ("Taiwanese recipes", "chinese"),
    ("Korean recipes", "korean"),
    ("Thai recipes", "southeast_asian"),
    ("Vietnamese recipes", "southeast_asian"),
    ("Filipino recipes", "southeast_asian"),
    ("Indonesian recipes", "southeast_asian"),
    ("Malaysian recipes", "southeast_asian"),
    ("Singaporean recipes", "southeast_asian"),
    ("Indian recipes", "south_asian"),
    ("Pakistani recipes", "south_asian"),
    ("Bangladeshi recipes", "south_asian"),
    ("Sri Lankan recipes", "south_asian"),
    ("Nepalese recipes", "south_asian"),
    ("Mexican recipes", "mexican"),
    ("Middle Eastern recipes", "middle_eastern"),
    ("West Asian recipes", "middle_eastern"),
    ("Lebanese recipes", "middle_eastern"),
    ("Israeli recipes", "middle_eastern"),
    ("Turkish recipes", "middle_eastern"),
    ("Iranian recipes", "middle_eastern"),
    ("Persian recipes", "middle_eastern"),
    ("Jewish recipes", "middle_eastern"),
    ("Greek recipes", "mediterranean"),
    ("Mediterranean recipes", "mediterranean"),
    ("Portuguese recipes", "mediterranean"),
    ("British recipes", "british"),
    ("English recipes", "british"),
    ("Scottish recipes", "british"),
    ("Irish recipes", "british"),
    ("Welsh recipes", "british"),
    ("Russian recipes", "eastern_european"),
    ("Polish recipes", "eastern_european"),
    ("Ukrainian recipes", "eastern_european"),
    ("Hungarian recipes", "eastern_european"),
    ("Czech recipes", "eastern_european"),
    ("Romanian recipes", "eastern_european"),
    ("Bulgarian recipes", "eastern_european"),
    ("Croatian recipes", "eastern_european"),
    ("Serbian recipes", "eastern_european"),
    ("German recipes", "german"),
    ("Austrian recipes", "german"),
    ("Swiss recipes", "german"),
    ("Dutch recipes", "northern_european"),
    ("Belgian recipes", "northern_european"),
    ("Swedish recipes", "northern_european"),
    ("Norwegian recipes", "northern_european"),
    ("Danish recipes", "northern_european"),
    ("Finnish recipes", "northern_european"),
    ("Nigerian recipes", "african"),
    ("Ghanaian recipes", "african"),
    ("Ethiopian recipes", "african"),
    ("Kenyan recipes", "african"),
    ("Moroccan recipes", "african"),
    ("Egyptian recipes", "african"),
    ("South African recipes", "african"),
    ("African recipes", "african"),
    ("Brazilian recipes", "latin_american"),
    ("Argentine recipes", "latin_american"),
    ("Peruvian recipes", "latin_american"),
    ("Colombian recipes", "latin_american"),
    ("Cuban recipes", "caribbean"),
    ("Jamaican recipes", "caribbean"),
    ("Caribbean recipes", "caribbean"),
    ("Canadian recipes", "canadian"),
    ("Hawaiian recipes", "hawaiian"),
    ("Australian recipes", "oceanian"),
    ("New Zealand recipes", "oceanian"),
    ("Pacific recipes", "oceanian"),
]

# Wikibooks category -> meal slot. Ordered: a dessert that is also a snack is a
# snack as far as the planner is concerned, and a main course is dinner.
COURSE_CATEGORIES: list[tuple[str, str]] = [
    ("Breakfast recipes", "breakfast"),
    ("Recipes for dessert", "snack"),
    ("Snack recipes", "snack"),
    ("Appetizer recipes", "snack"),
    ("Side dish recipes", "snack"),
    ("Recipes for salad", "lunch"),
    ("Recipes for soup", "lunch"),
    ("Lunch recipes", "lunch"),
    ("Sandwich recipes", "lunch"),
    ("Main course recipes", "dinner"),
    ("Dinner recipes", "dinner"),
]

# The Cookbook grades its own recipes, and files the grade as a category
# rather than filling in the Difficulty row of the infobox - which is empty on
# every page checked. Four hundred recipes' worth of the Cookbook's judgement
# beats four hundred guesses from ingredient count.
DIFFICULTY_CATEGORIES: list[tuple[str, int]] = [
    ("Very Easy recipes", 1),
    ("Easy recipes", 2),
    ("Medium Difficulty recipes", 3),
    ("Difficult recipes", 4),
    ("Very Difficult recipes", 5),
]

ROOTS = ["Recipes by origin", "Recipes by meal or course", "Recipes by difficulty"]


def build(force: bool = False) -> dict:
    if CACHE.exists() and not force:
        return json.loads(CACHE.read_text(encoding="utf-8"))

    tree: dict[str, list[str]] = {}
    for root in ROOTS:
        print(f"crawling Category:{root}", flush=True)
        tree.update(wikimedia.category_tree(root, depth=3))
    print(f"crawling Category:Recipes with images", flush=True)
    tree.update({"Recipes with images": wikimedia.category_members("Recipes with images")[0]})
    print(f"crawling Category:Recipes", flush=True)
    tree["Recipes"] = wikimedia.category_members("Recipes")[0]

    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(tree, indent=1, ensure_ascii=False), encoding="utf-8")
    return tree


def cuisine_of(tree: dict[str, list[str]]) -> dict[str, str]:
    """Cookbook page -> cuisine id, most specific category winning."""
    out: dict[str, str] = {}
    for category, cuisine in reversed(CUISINE_CATEGORIES):
        for page in tree.get(category, []):
            out[page] = cuisine
    return out


def difficulty_of(tree: dict[str, list[str]]) -> dict[str, int]:
    """Cookbook page -> 1-5, from the Cookbook's own difficulty categories."""
    out: dict[str, int] = {}
    for category, level in DIFFICULTY_CATEGORIES:
        for page in tree.get(category, []):
            out[page] = level
    return out


def slot_of(tree: dict[str, list[str]]) -> dict[str, str]:
    out: dict[str, str] = {}
    for category, slot in reversed(COURSE_CATEGORIES):
        for page in tree.get(category, []):
            out[page] = slot
    return out


def main() -> None:
    tree = build(force="--force" in sys.argv)
    print(f"\n{len(tree)} categories, {len(tree.get('Recipes', []))} recipes total")

    cuisines = cuisine_of(tree)
    slots = slot_of(tree)
    with_images = set(tree.get("Recipes with images", []))

    from collections import Counter
    print(f"\nclassified by cuisine: {len(cuisines)}")
    for cuisine, count in Counter(cuisines.values()).most_common():
        withimg = sum(1 for p, c in cuisines.items() if c == cuisine and p in with_images)
        print(f"  {cuisine:<18} {count:5d}   {withimg:4d} with a Cookbook image")
    print(f"\nclassified by slot: {len(slots)}")
    for slot, count in Counter(slots.values()).most_common():
        print(f"  {slot:<18} {count:5d}")

    unmatched = [c for c, _ in CUISINE_CATEGORIES if c not in tree]
    if unmatched:
        print(f"\n{len(unmatched)} cuisine categories that do not exist:")
        print("  " + ", ".join(unmatched))


if __name__ == "__main__":
    main()
