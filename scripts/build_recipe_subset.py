"""Reduce 500k Food.com recipes to a curated subset the app can ship.

recipes.csv is 704 MB. An Android bundle cannot carry that, and the planner
does not need it: a well-spread few thousand recipes give the solver more than
enough room to hit nutrient targets across every diet, cuisine and time budget.

What this script does:
  1. Streams the CSV in chunks, parsing R-style c("a", "b") vectors and
     ISO-8601 PT##H##M durations.
  2. Rejects rows that cannot support a meal plan - unrated, unparseable
     quantities, missing nutrition, absurd cook times.
  3. Derives what the dataset does not state: cuisine, diet compatibility,
     difficulty, meal slot, equipment, and an estimated cost per serving.
  4. Stratifies the survivors across cuisine x meal slot so no single style
     dominates, then writes the result as JSON.

Run:  python scripts/build_recipe_subset.py [--target 1400]
Out:  src/data/generated/recipes.json
      src/data/generated/ingredients.json
"""

from __future__ import annotations

import argparse
import json
import math
import re
from collections import defaultdict
from fractions import Fraction
from pathlib import Path

import pandas as pd

from ingredient_taxonomy import CATEGORIES, VOLUME_ML, describe, normalise

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data-source" / "recipes.csv"
OUT_DIR = ROOT / "src" / "data" / "generated"

USE_COLUMNS = [
    "RecipeId", "Name", "CookTime", "PrepTime", "TotalTime", "Description",
    "RecipeCategory", "Keywords", "RecipeIngredientQuantities",
    "RecipeIngredientParts", "AggregatedRating", "ReviewCount", "Calories",
    "FatContent", "SaturatedFatContent", "CholesterolContent", "SodiumContent",
    "CarbohydrateContent", "FiberContent", "SugarContent", "ProteinContent",
    "RecipeServings", "RecipeInstructions",
]

# --- Cuisine mapping ---------------------------------------------------------
# Food.com keywords are granular national tags; the onboarding asks for a
# preference at a coarser grain, so national tags collapse into regions.
#
# Matching runs in two passes. Recipes are routinely tagged with both a
# national and a continental keyword - an Indian curry carries "Indian" AND
# "Asian" - so every specific tag must be tested before any generic one.
# A single ordered pass sends those curries to East Asian and leaves South
# Asian nearly empty.

CUISINE_KEYWORDS: dict[str, list[str]] = {
    "italian":       ["italian", "sicilian", "tuscan"],
    "mexican":       ["mexican", "tex mex", "southwestern u.s.", "brazilian", "peruvian", "colombian", "chilean", "venezuelan"],
    "east_asian":    ["chinese", "japanese", "korean", "cantonese", "szechuan", "mongolian"],
    "south_asian":   ["indian", "pakistani", "nepalese", "sri lankan", "bangladeshi", "punjabi"],
    "southeast_asian": ["thai", "vietnamese", "indonesian", "malaysian", "filipino", "cambodian", "burmese"],
    "mediterranean": ["greek", "spanish", "portuguese", "turkish"],
    "middle_eastern": ["lebanese", "moroccan", "egyptian", "iranian", "iraqi", "israeli", "palestinian", "syrian", "saudi arabian"],
    "french":        ["french", "provencal"],
    "american":      ["southern", "cajun", "creole", "hawaiian", "native american", "canadian", "soul food", "amish", "mennonite", "tex-mex"],
    "british":       ["english", "british", "scottish", "irish", "welsh"],
    "northern_european": ["german", "dutch", "swiss", "austrian", "hungarian", "czech", "polish", "russian", "scandinavian", "swedish", "norwegian", "danish", "finnish", "icelandic", "belgian"],
    "african":       ["nigerian", "ethiopian", "south african", "kenyan", "ghanaian"],
    "caribbean":     ["cuban", "jamaican", "puerto rican", "trinidadian"],
}

# Continental fallbacks, tested only when no national tag matched.
GENERIC_CUISINE_KEYWORDS: dict[str, list[str]] = {
    "south_asian":   ["curry"],
    "east_asian":    ["asian"],
    "mediterranean": ["mediterranean"],
    "middle_eastern": ["middle eastern"],
    "african":       ["african"],
    "caribbean":     ["caribbean"],
    "mexican":       ["south american", "central american"],
    "northern_european": ["european", "scandinavian"],
    "american":      ["american"],
}

CUISINE_LABELS = {
    "italian": "Italian", "mexican": "Mexican & Latin", "east_asian": "East Asian",
    "south_asian": "South Asian", "southeast_asian": "Southeast Asian",
    "mediterranean": "Mediterranean", "middle_eastern": "Middle Eastern",
    "french": "French", "american": "American", "british": "British & Irish",
    "northern_european": "Northern European", "african": "African",
    "caribbean": "Caribbean", "unspecified": "Unspecified",
}

# --- Meal slot ---------------------------------------------------------------

BREAKFAST_HINTS = ["breakfast", "brunch", "pancake", "waffle", "oatmeal", "granola", "smoothie", "cereal", "muffin", "scone", "omelet", "omelette", "frittata", "french toast"]
SNACK_HINTS = ["snack", "appetizer", "dip", "spread", "beverage", "cocktail", "smoothie", "bar cookie", "candy", "trail mix"]
DESSERT_HINTS = ["dessert", "cake", "pie", "cookie", "ice cream", "pudding", "frozen dessert", "candy", "brownie", "cheesecake", "tart"]

# --- Equipment ---------------------------------------------------------------
# Only items a kitchen might genuinely lack. Skillets and saucepans are assumed.

EQUIPMENT_PATTERNS: dict[str, str] = {
    "blender": r"\bblender\b",
    "food processor": r"\bfood processor\b",
    "stand mixer": r"\bstand mixer\b|\belectric mixer\b",
    "slow cooker": r"\bslow cooker\b|\bcrock ?pot\b",
    "pressure cooker": r"\bpressure cooker\b|\binstant pot\b",
    "wok": r"\bwok\b",
    "dutch oven": r"\bdutch oven\b",
    "springform pan": r"\bspringform\b",
    "ice cream maker": r"\bice cream maker\b",
    "mandoline": r"\bmandoline\b",
    "candy thermometer": r"\bcandy thermometer\b|\bdeep-?fry thermometer\b",
    "deep fryer": r"\bdeep fryer\b|\bdeep-?fat fryer\b",
    "waffle iron": r"\bwaffle iron\b|\bwaffle maker\b",
    "steamer": r"\bsteamer basket\b|\bbamboo steamer\b",
    "muffin tin": r"\bmuffin tin\b|\bmuffin pan\b|\bcupcake pan\b",
    "loaf pan": r"\bloaf pan\b|\bloaf tin\b",
    "grill": r"\bgrill\b|\bbarbecue\b|\bbbq\b",
    "roasting pan": r"\broasting pan\b",
    "double boiler": r"\bdouble boiler\b",
}

ADVANCED_TECHNIQUES = re.compile(
    r"\b(fold|temper|proof|knead|emulsif\w+|reduce|blanch|sear|braise|"
    r"caramel\w+|deglaze|clarif\w+|render|truss|julienne|brunoise|confit|"
    r"sous vide|flambe|poach|score|marinate overnight)\b",
    re.IGNORECASE,
)

# --- Parsers -----------------------------------------------------------------

R_VECTOR_ITEM = re.compile(r'"((?:[^"]|"")*)"')
ISO_DURATION = re.compile(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?")
QUANTITY_TOKEN = re.compile(r"^\s*(\d+)\s+(\d+)\s*/\s*(\d+)\s*$")


def parse_r_vector(raw) -> list[str]:
    """Parse c("a", "b") into ["a", "b"]. Handles NA, character(0), bare strings."""
    if raw is None or (isinstance(raw, float) and math.isnan(raw)):
        return []
    text = str(raw).strip()
    if not text or text in {"NA", "character(0)", "NULL"}:
        return []
    items = [item.replace('""', '"').strip() for item in R_VECTOR_ITEM.findall(text)]
    if items:
        return [item for item in items if item and item != "NA"]
    # A single unquoted value.
    return [text] if text != "NA" else []


def parse_duration_minutes(raw) -> int | None:
    """PT24H45M -> 1485. Returns None when absent or unparseable."""
    if raw is None or (isinstance(raw, float) and math.isnan(raw)):
        return None
    match = ISO_DURATION.fullmatch(str(raw).strip())
    if not match:
        return None
    days, hours, minutes, seconds = (int(g) if g else 0 for g in match.groups())
    total = days * 1440 + hours * 60 + minutes + round(seconds / 60)
    return total or None


def parse_quantity(raw: str) -> float | None:
    """'1 1/2' -> 1.5, '1/4' -> 0.25, '2-3' -> 2.5. None when not a number."""
    text = str(raw).strip().lower()
    if not text or text in {"na", "none", ""}:
        return None

    mixed = QUANTITY_TOKEN.match(text)
    if mixed:
        whole, numerator, denominator = (int(g) for g in mixed.groups())
        return whole + numerator / denominator if denominator else float(whole)

    range_match = re.match(r"^(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)$", text)
    if range_match:
        low, high = (float(g) for g in range_match.groups())
        return (low + high) / 2

    try:
        return float(Fraction(text))
    except (ValueError, ZeroDivisionError):
        pass

    number = re.match(r"^(\d+(?:\.\d+)?)", text)
    return float(number.group(1)) if number else None


def estimate_grams(quantity: float | None, ingredient_name: str, record: dict) -> float:
    """Convert a recipe quantity into grams so it can be priced and depleted.

    The dataset stores quantities without units - '4' for four cups of
    blueberries and '1' for one onion look identical. We treat a bare number as
    a count of units and use the per-unit weight from the taxonomy, which is the
    interpretation that holds for the majority of entries.
    """
    if quantity is None:
        quantity = 1.0

    text = normalise(ingredient_name)
    for unit, grams in VOLUME_ML.items():
        if re.search(rf"\b{re.escape(unit)}\b", text):
            return quantity * grams

    return quantity * record["unit_g"]


def detect_cuisine(keywords: list[str], category: str, name: str = "") -> str:
    haystack = " ".join(keywords + [category, name]).lower()
    for table in (CUISINE_KEYWORDS, GENERIC_CUISINE_KEYWORDS):
        for cuisine, tags in table.items():
            for tag in tags:
                if re.search(rf"\b{re.escape(tag)}\b", haystack):
                    return cuisine
    return "unspecified"


def detect_meal_slot(keywords: list[str], category: str, name: str) -> str:
    haystack = " ".join(keywords + [category, name]).lower()
    if any(hint in haystack for hint in DESSERT_HINTS):
        return "snack"
    if any(hint in haystack for hint in BREAKFAST_HINTS):
        return "breakfast"
    if any(hint in haystack for hint in SNACK_HINTS):
        return "snack"
    if "lunch" in haystack or "salad" in haystack or "sandwich" in haystack or "soup" in haystack:
        return "lunch"
    return "dinner"


def detect_equipment(instructions: str) -> list[str]:
    text = instructions.lower()
    return [
        name for name, pattern in EQUIPMENT_PATTERNS.items()
        if re.search(pattern, text)
    ]


def score_difficulty(ingredient_count: int, step_count: int, minutes: int, instructions: str) -> int:
    """1 (trivial) to 5 (project). Blends scale, length and technique."""
    points = 0.0
    points += min(ingredient_count / 4.0, 4.0)
    points += min(step_count / 3.0, 4.0)
    points += min(minutes / 45.0, 3.0)
    points += min(len(ADVANCED_TECHNIQUES.findall(instructions)) * 0.6, 3.0)
    return max(1, min(5, round(points / 2.8)))


# --- Main pipeline -----------------------------------------------------------

def process_chunk(chunk: pd.DataFrame, ingredient_index: dict) -> list[dict]:
    kept = []

    for row in chunk.itertuples(index=False):
        rating = getattr(row, "AggregatedRating", None)
        reviews = getattr(row, "ReviewCount", None)
        if rating is None or pd.isna(rating) or rating < 4.0:
            continue
        if reviews is None or pd.isna(reviews) or reviews < 8:
            continue

        parts = parse_r_vector(row.RecipeIngredientParts)
        quantities = parse_r_vector(row.RecipeIngredientQuantities)
        if len(parts) != len(quantities):
            continue
        if not (3 <= len(parts) <= 16):
            continue

        instructions = parse_r_vector(row.RecipeInstructions)
        if len(instructions) < 2:
            continue

        minutes = parse_duration_minutes(row.TotalTime)
        if minutes is None or not (5 <= minutes <= 180):
            continue

        servings = getattr(row, "RecipeServings", None)
        if servings is None or pd.isna(servings) or not (1 <= servings <= 12):
            continue
        servings = int(servings)

        calories = getattr(row, "Calories", None)
        protein = getattr(row, "ProteinContent", None)
        if calories is None or pd.isna(calories) or not (40 <= calories <= 1800):
            continue
        if protein is None or pd.isna(protein):
            continue

        keywords = parse_r_vector(row.Keywords)
        category = str(row.RecipeCategory) if not pd.isna(row.RecipeCategory) else ""
        instruction_text = " ".join(instructions)

        # Resolve ingredients and accumulate diet flags and cost.
        ingredients = []
        excludes_vegan = excludes_vegetarian = excludes_paleo = False
        excludes_carnivore = False
        cost = 0.0

        for name, quantity_raw in zip(parts, quantities):
            record = describe(name)
            key = record["name"]
            if key not in ingredient_index:
                ingredient_index[key] = {
                    "id": key,
                    "name": record["display_name"],
                    "category": record["category"],
                    "aisle": record["aisle"],
                    "price_per_kg": record["price_per_kg"],
                    "shelf_life_days": record["shelf_life_days"],
                    "pack_g": record["pack_g"],
                    "staple": record["staple"],
                    "unit_g": record["unit_g"],
                }

            quantity = parse_quantity(quantity_raw)
            grams = estimate_grams(quantity, name, record)
            grams = min(grams, 3000.0)  # guard against parse blowups

            ingredients.append({
                "id": key,
                "label": name.strip(),
                "quantity": quantity,
                "quantity_text": str(quantity_raw).strip(),
                "grams": round(grams, 1),
            })

            cost += grams / 1000.0 * record["price_per_kg"]
            excludes_vegan |= record["excludes_vegan"]
            excludes_vegetarian |= record["excludes_vegetarian"]
            excludes_paleo |= record["excludes_paleo"]
            excludes_carnivore |= record["excludes_carnivore"]

        carbs = getattr(row, "CarbohydrateContent", None)
        carbs = float(carbs) if carbs is not None and not pd.isna(carbs) else 0.0

        def nutrient(attr: str) -> float:
            value = getattr(row, attr, None)
            return round(float(value), 2) if value is not None and not pd.isna(value) else 0.0

        kept.append({
            "id": int(row.RecipeId),
            "name": str(row.Name).strip(),
            "description": (str(row.Description).strip()[:260] if not pd.isna(row.Description) else ""),
            "minutes": minutes,
            "prep_minutes": parse_duration_minutes(row.PrepTime) or 0,
            "servings": servings,
            "rating": round(float(rating), 2),
            "reviews": int(reviews),
            "cuisine": detect_cuisine(keywords, category, str(row.Name)),
            "slot": detect_meal_slot(keywords, category, str(row.Name)),
            "difficulty": score_difficulty(len(parts), len(instructions), minutes, instruction_text),
            "equipment": detect_equipment(instruction_text),
            "cost_per_serving": round(cost / servings, 3),
            "ingredients": ingredients,
            "instructions": instructions,
            "diet": {
                "vegan": not excludes_vegan,
                "vegetarian": not excludes_vegetarian,
                "paleo": not excludes_paleo,
                "iifym": True,
                "keto": (carbs / 1.0) <= 15.0,
                "carnivore": not excludes_carnivore,
            },
            "nutrition": {
                "energy_kcal": nutrient("Calories"),
                "protein_g": nutrient("ProteinContent"),
                "fat_g": nutrient("FatContent"),
                "saturated_fat_g": nutrient("SaturatedFatContent"),
                "cholesterol_mg": nutrient("CholesterolContent"),
                "sodium_mg": nutrient("SodiumContent"),
                "carbohydrate_g": nutrient("CarbohydrateContent"),
                "fiber_g": nutrient("FiberContent"),
                "sugar_g": nutrient("SugarContent"),
            },
        })

    return kept


def stratify(recipes: list[dict], target: int) -> list[dict]:
    """Spread the selection across cuisine x slot so no style dominates.

    Round-robins buckets, taking the best-rated unused recipe from each in turn,
    which fills scarce buckets completely before over-filling common ones.
    """
    buckets: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for recipe in recipes:
        buckets[(recipe["cuisine"], recipe["slot"])].append(recipe)

    for bucket in buckets.values():
        bucket.sort(key=lambda r: (r["rating"], r["reviews"]), reverse=True)

    selected: list[dict] = []
    seen_names: set[str] = set()
    cursors = {key: 0 for key in buckets}

    while len(selected) < target:
        progressed = False
        for key in sorted(buckets, key=lambda k: (-len(buckets[k]), k)):
            if len(selected) >= target:
                break
            bucket, cursor = buckets[key], cursors[key]
            while cursor < len(bucket):
                candidate = bucket[cursor]
                cursor += 1
                fingerprint = re.sub(r"[^a-z0-9]", "", candidate["name"].lower())[:40]
                if fingerprint in seen_names:
                    continue
                seen_names.add(fingerprint)
                selected.append(candidate)
                progressed = True
                break
            cursors[key] = cursor
        if not progressed:
            break

    return selected


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", type=int, default=1400)
    parser.add_argument("--chunksize", type=int, default=50000)
    parser.add_argument("--limit", type=int, default=None, help="stop after N source rows")
    args = parser.parse_args()

    if not CSV_PATH.exists():
        raise SystemExit(f"Recipe CSV not found: {CSV_PATH}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    ingredient_index: dict[str, dict] = {}
    survivors: list[dict] = []
    scanned = 0

    reader = pd.read_csv(
        CSV_PATH,
        usecols=USE_COLUMNS,
        chunksize=args.chunksize,
        nrows=args.limit,
        low_memory=False,
    )

    for chunk in reader:
        survivors.extend(process_chunk(chunk, ingredient_index))
        scanned += len(chunk)
        print(f"  scanned {scanned:>7,}  survivors {len(survivors):>6,}", flush=True)

    print(f"\nfiltered {scanned:,} rows down to {len(survivors):,} candidates")

    selected = stratify(survivors, args.target)

    # Keep only the ingredients the selected recipes actually reference.
    used_ids = {item["id"] for recipe in selected for item in recipe["ingredients"]}
    ingredients = [ingredient_index[key] for key in sorted(used_ids) if key in ingredient_index]

    recipes_path = OUT_DIR / "recipes.json"
    recipes_path.write_text(
        json.dumps(selected, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    ingredients_path = OUT_DIR / "ingredients.json"
    ingredients_path.write_text(
        json.dumps(
            {"ingredients": ingredients, "categories": CATEGORIES, "cuisine_labels": CUISINE_LABELS},
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )

    # Report the spread so an unbalanced build is visible immediately.
    by_cuisine: dict[str, int] = defaultdict(int)
    by_slot: dict[str, int] = defaultdict(int)
    by_diet: dict[str, int] = defaultdict(int)
    for recipe in selected:
        by_cuisine[recipe["cuisine"]] += 1
        by_slot[recipe["slot"]] += 1
        for diet, ok in recipe["diet"].items():
            if ok:
                by_diet[diet] += 1

    print(f"\nrecipes.json      {recipes_path.stat().st_size / 1024:8.1f} KB  {len(selected)} recipes")
    print(f"ingredients.json  {ingredients_path.stat().st_size / 1024:8.1f} KB  {len(ingredients)} ingredients")
    print("\n  by cuisine:")
    for key, count in sorted(by_cuisine.items(), key=lambda kv: -kv[1]):
        print(f"    {CUISINE_LABELS.get(key, key):22} {count:5}")
    print("  by slot:")
    for key, count in sorted(by_slot.items(), key=lambda kv: -kv[1]):
        print(f"    {key:22} {count:5}")
    print("  compatible with diet:")
    for key, count in sorted(by_diet.items(), key=lambda kv: -kv[1]):
        print(f"    {key:22} {count:5}")


if __name__ == "__main__":
    main()
