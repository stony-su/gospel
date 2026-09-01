"""Build the recipe library from Wikimedia pages and the authored fallbacks.

    python scripts/build_recipe_library.py

Reads   scripts/recipe_sources.py      the hundred dishes and where each is from
        en.wikibooks.org               Ingredients and Procedure, where they exist
        en.wikipedia.org               one line of description
        scripts/authored/              the twenty-eight with no scrapeable method
        src/data/generated/recipe_images.json   written by fetch_recipe_images.py

Writes  src/data/generated/recipes.json
        src/data/generated/ingredients.json

What this does not write is nutrition. The old corpus published nine nutrients
per serving and this one publishes none, so the figures are computed from
FoodData Central panels over the ingredient weights instead. That is
scripts/attach_recipe_nutrition.py, and it has to run after the FDC fetch,
which in turn needs the ingredients.json this produces. The full order is in
the README; running this alone leaves recipes.json with its nutrition zeroed
and `nutrition_source` set to "pending", which the checker will refuse.

Weights are the load-bearing part. Every ingredient line goes through
scripts/measures.py, which is what turns "3-4 tablespoons extra-virgin olive
oil" into 41 g - and 41 g is what the grocery list buys, the budget prices and
the nutrient panels get multiplied by.
"""

from __future__ import annotations

import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import wikimedia  # noqa: E402
from authored import load as load_authored  # noqa: E402
from ingredient_taxonomy import describe  # noqa: E402
from measures import parse as parse_line, quantity_text  # noqa: E402
from recipe_sources import CUISINE_LABELS, check, load_all  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
GENERATED = ROOT / "src" / "data" / "generated"
IMAGES = GENERATED / "recipe_images.json"

# Some Cookbook pages list every regional variant's ingredients in one section -
# banh mi runs to thirty-nine lines across four different sandwiches. Past this
# the list has stopped being one recipe, so it is cut and the cut is reported.
MAX_INGREDIENTS = 20

# Likewise a page that inlines its whole technique essay as numbered steps.
MAX_STEPS = 16

LICENSES = {
    "wikibooks": "CC BY-SA 4.0",
    "wikipedia": "CC BY-SA 4.0",
}


def recipe_id(slug: str) -> int:
    """A stable id for a slug.

    Derived rather than sequential so that adding a dish to the middle of the
    spec does not renumber everything after it and silently invalidate every
    saved plan.
    """
    return int(hashlib.sha1(slug.encode("utf-8")).hexdigest()[:7], 16)


def main() -> int:
    check()
    if not IMAGES.exists():
        print("run scripts/fetch_recipe_images.py first", file=sys.stderr)
        return 1
    images = json.loads(IMAGES.read_text(encoding="utf-8"))
    authored = load_authored()

    ingredient_index: dict[str, dict] = {}
    recipes: list[dict] = []
    problems: list[str] = []
    notes: list[str] = []

    sources = load_all()
    for source in sources:
        # --- method ---------------------------------------------------------
        if source.authored:
            written = authored.get(source.slug)
            if not written:
                problems.append(f"{source.slug}: no authored recipe")
                continue
            raw_ingredients = list(written["ingredients"])
            raw_steps = list(written["instructions"])
            method = {"kind": "authored", "url": None, "license": None}
        else:
            scraped = wikimedia.cookbook_recipe(source.wikibooks)
            if scraped is None:
                problems.append(f"{source.slug}: Cookbook:{source.wikibooks} has no recipe")
                continue
            raw_ingredients = scraped.ingredients
            raw_steps = scraped.instructions
            method = {"kind": "wikibooks", "url": scraped.url,
                      "license": LICENSES["wikibooks"]}

        # --- description and photograph -------------------------------------
        page = wikimedia.wikipedia_page(source.wikipedia)
        description = page.description if page else ""
        image = images.get(source.slug)
        if image is None:
            problems.append(f"{source.slug}: no image in the manifest")
            continue

        # --- ingredients ----------------------------------------------------
        if len(raw_steps) > MAX_STEPS:
            notes.append(f"{source.slug}: {len(raw_steps)} steps cut to {MAX_STEPS}")
            raw_steps = raw_steps[:MAX_STEPS]

        parsed: list[tuple[dict, dict]] = []
        dropped = 0

        for line in raw_ingredients:
            measured = parse_line(line)
            if measured is None:
                dropped += 1
                continue
            record = describe(measured.name)
            key = record["name"] or measured.name.lower()
            # A line the source did not quantify is a component, and the one
            # thing the source did say is how many people it feeds. measures.py
            # returns a per-serving figure for those; everything else is
            # already the whole recipe's amount.
            grams = measured.grams
            if measured.basis == "unquantified":
                grams = round(min(grams * source.servings, 3000.0), 1)
            parsed.append((
                {
                    "id": key,
                    "label": measured.label,
                    "quantity": measured.quantity,
                    "quantity_text": quantity_text(measured),
                    "grams": grams,
                },
                record,
            ))

        # Cut after parsing, not before: a page whose Ingredients section has
        # nine sentences of advice in it would otherwise spend most of its
        # allowance on prose and lose the ingredients underneath. Cost and diet
        # are accumulated afterwards, over what actually survives.
        if len(parsed) > MAX_INGREDIENTS:
            notes.append(f"{source.slug}: {len(parsed)} ingredients cut to {MAX_INGREDIENTS}")
            parsed = parsed[:MAX_INGREDIENTS]

        ingredients: list[dict] = []
        excludes = {"vegan": False, "vegetarian": False, "paleo": False, "carnivore": False}
        cost = 0.0

        for item, record in parsed:
            key = item["id"]
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
            ingredients.append(item)
            cost += item["grams"] / 1000.0 * record["price_per_kg"]
            for diet in excludes:
                excludes[diet] |= record[f"excludes_{diet}"]

        if len(ingredients) < 3:
            problems.append(f"{source.slug}: only {len(ingredients)} ingredients parsed")
            continue
        if len(raw_steps) < 2:
            problems.append(f"{source.slug}: only {len(raw_steps)} steps")
            continue
        if dropped:
            notes.append(f"{source.slug}: {dropped} unparseable lines dropped")

        recipes.append({
            "id": recipe_id(source.slug),
            "slug": source.slug,
            "name": source.name,
            "description": description,
            "image": {
                "file": image["file"],
                "thumb": image["thumb"],
                "author": image["author"],
                "license": image["license"],
                "license_url": image["license_url"],
                "source_url": image["source_url"],
            },
            "minutes": source.minutes,
            "prep_minutes": source.prep,
            "servings": source.servings,
            "cuisine": source.cuisine,
            "slot": source.slot,
            "difficulty": source.difficulty,
            "equipment": list(source.equipment),
            "cost_per_serving": round(cost / source.servings, 3),
            "ingredients": ingredients,
            "instructions": [s.strip() for s in raw_steps if s.strip()],
            "method_source": method,
            "reference_url": page.url if page else None,
            "diet": {
                "vegan": not excludes["vegan"],
                "vegetarian": not excludes["vegetarian"],
                "paleo": not excludes["paleo"],
                "iifym": True,
                # Set by attach_recipe_nutrition.py, which is the first step
                # that knows how much carbohydrate a serving actually has.
                "keto": False,
                "carnivore": not excludes["carnivore"],
            },
            "nutrition": {
                "energy_kcal": 0.0, "protein_g": 0.0, "fat_g": 0.0,
                "saturated_fat_g": 0.0, "cholesterol_mg": 0.0, "sodium_mg": 0.0,
                "carbohydrate_g": 0.0, "fiber_g": 0.0, "sugar_g": 0.0,
            },
            "nutrition_source": "pending",
        })

    recipes.sort(key=lambda r: (r["cuisine"], r["slug"]))
    GENERATED.mkdir(parents=True, exist_ok=True)
    (GENERATED / "recipes.json").write_text(
        json.dumps(recipes, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    used = {item["id"] for recipe in recipes for item in recipe["ingredients"]}
    payload = {
        "ingredients": [ingredient_index[key] for key in sorted(used)],
        "categories": {},
        "cuisine_labels": {
            cuisine: CUISINE_LABELS[cuisine]
            for cuisine in sorted({r["cuisine"] for r in recipes},
                                  key=list(CUISINE_LABELS).index)
        },
    }
    from ingredient_taxonomy import CATEGORIES
    payload["categories"] = {
        name: {"aisle": spec["aisle"], "staple": spec["staple"]}
        for name, spec in CATEGORIES.items()
    }
    (GENERATED / "ingredients.json").write_text(
        json.dumps(payload, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    # --- report -------------------------------------------------------------
    print(f"recipes.json      {len(recipes)} recipes")
    print(f"ingredients.json  {len(payload['ingredients'])} distinct ingredients")
    print()
    print("  method:")
    for kind, count in Counter(r["method_source"]["kind"] for r in recipes).most_common():
        print(f"    {kind:<12} {count}")
    print("  cuisine:")
    for cuisine, count in Counter(r["cuisine"] for r in recipes).most_common():
        print(f"    {cuisine:<18} {count}")
    print("  slot:")
    for slot, count in Counter(r["slot"] for r in recipes).most_common():
        print(f"    {slot:<18} {count}")
    print("  diet:")
    for diet in ("vegan", "vegetarian", "paleo", "carnivore"):
        print(f"    {diet:<18} {sum(1 for r in recipes if r['diet'][diet])}")

    if notes:
        print(f"\n{len(notes)} notes:")
        for line in notes:
            print(f"  {line}")
    if problems:
        print(f"\n{len(problems)} PROBLEMS:")
        for line in problems:
            print(f"  {line}")
        return 1
    if len(recipes) != len(sources):
        print(f"\nbuilt {len(recipes)} of {len(sources)}")
        return 1
    print("\nnext: scripts/fetch_fdc_nutrition.py, then scripts/attach_recipe_nutrition.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
