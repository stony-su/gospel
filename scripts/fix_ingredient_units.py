"""Correct the per-unit gram assumptions behind every recipe's ingredient weights.

The Food.com corpus stores ingredient quantities as bare numbers with no
units - "1", "1/2", "2" - so build_recipe_subset.py computes a weight as
`quantity * unit_g`, and unit_g fell back to 100 g for almost every
ingredient. That makes "1 teaspoon of oregano" a hundred grams of oregano.

It went unnoticed because nothing read those weights. The app showed the
corpus's own per-serving figures for five nutrients, and the grams only fed
the grocery list. Adding FoodData Central panels is what made them matter:
dried herbs and spices are among the most nutrient-dense foods by weight, so a
hundred grams of parsley contributed 2,300 ug of vitamin K against a 120 ug
target, and every plan read as wildly over its limits.

These weights are informed defaults, not measurements. The corpus genuinely
does not record units, so a teaspoon and a tablespoon of the same spice are
indistinguishable in the source. The aim is only to be roughly right where the
current values are precisely wrong by two orders of magnitude.

Ingredients with a deliberate non-default weight - bay leaf at 0.2 g, garlic
clove at 5 g - are left alone. Only the 100 g fallback is replaced.

Weights are recomputed through the same `estimate_grams` logic the original
build used, not a simplification of it: a label containing a volume word
("1/4 cup butter") is priced by that volume and never touched the per-unit
weight at all, so recomputing those from unit_g would corrupt weights that
were right to begin with.

Costs are recomputed too: cost_per_serving is derived from these same weights,
so it has been inflated by exactly the same error.

Run:  python scripts/fix_ingredient_units.py [--dry-run]
Out:  src/data/generated/ingredients.json   (unit_g corrected)
      src/data/generated/recipes.json       (grams and cost recomputed)
"""

from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ingredient_taxonomy import VOLUME_ML, normalise  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
GENERATED = ROOT / "src" / "data" / "generated"
INGREDIENTS = GENERATED / "ingredients.json"
RECIPES = GENERATED / "recipes.json"

# The fallback this replaces. Anything else was set deliberately.
DEFAULT_UNIT_G = 100.0

# One "unit" of each category, in grams, at the scale a recipe actually uses.
CATEGORY_UNIT_G: dict[str, float] = {
    "herb_dry": 1.0,       # a teaspoon of dried herb
    "spice": 2.0,          # a teaspoon of ground spice
    "baking_agent": 4.0,   # a teaspoon of soda or powder
    "oil": 14.0,           # a tablespoon
    "vinegar": 14.0,       # a tablespoon
    "condiment": 16.0,     # a tablespoon
}


def estimate_grams(quantity: float | None, label: str, record: dict) -> float:
    """The original build's weight rule, reproduced exactly.

    A volume word in the label wins over the per-unit weight, and the result
    is capped the same way, so an ingredient whose weight this correction does
    not affect comes out byte-identical.
    """
    if quantity is None:
        quantity = 1.0

    text = normalise(label)
    for unit, grams in VOLUME_ML.items():
        if re.search(rf"\b{re.escape(unit)}\b", text):
            return min(quantity * grams, 3000.0)

    return min(quantity * float(record["unit_g"]), 3000.0)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="report without writing")
    args = parser.parse_args()

    data = json.loads(INGREDIENTS.read_text(encoding="utf-8"))
    ingredients = data["ingredients"]

    # --- Correct the per-unit weights ------------------------------------
    changed = 0
    for ingredient in ingredients:
        target = CATEGORY_UNIT_G.get(ingredient["category"])
        if target is None:
            continue
        if ingredient.get("unit_g") != DEFAULT_UNIT_G:
            continue  # deliberate value, leave it
        ingredient["unit_g"] = target
        changed += 1

    print(f"unit_g corrected: {changed} ingredients")
    for category, grams in sorted(CATEGORY_UNIT_G.items()):
        n = sum(1 for i in ingredients if i["category"] == category)
        print(f"  {category:<14} -> {grams:>5.1f} g   ({n} ingredients)")

    by_id = {i["id"]: i for i in ingredients}

    # --- Recompute recipe weights and cost --------------------------------
    recipes = json.loads(RECIPES.read_text(encoding="utf-8"))

    before: list[float] = []
    after: list[float] = []
    unexpected: list[str] = []
    touched = 0

    for recipe in recipes:
        cost = 0.0
        for ingredient in recipe["ingredients"]:
            known = by_id.get(ingredient["id"])
            if known is None:
                # No taxonomy entry: leave the weight as it stands rather than
                # inventing one, and still count it toward cost at zero.
                continue

            grams = round(
                estimate_grams(ingredient.get("quantity"), ingredient["label"], known), 1
            )
            if grams != ingredient.get("grams"):
                touched += 1
                # A weight outside the corrected categories must come out
                # identical. If it does not, this script is not reproducing
                # the original rule and would corrupt data that was right.
                if known["category"] not in CATEGORY_UNIT_G:
                    unexpected.append(
                        f"{ingredient['id']} ({known['category']}): "
                        f"{ingredient.get('grams')} -> {grams}"
                    )
            before.append(float(ingredient.get("grams") or 0))
            after.append(grams)
            ingredient["grams"] = grams

        for ingredient in recipe["ingredients"]:
            known = by_id.get(ingredient["id"])
            if known is None:
                continue
            cost += float(ingredient["grams"]) / 1000.0 * float(known["price_per_kg"])

        servings = max(int(recipe.get("servings") or 1), 1)
        recipe["cost_per_serving"] = round(cost / servings, 3)

    print()
    print(f"ingredient weights changed: {touched}")
    if before:
        print(f"  mean weight before: {statistics.mean(before):>7.1f} g")
        print(f"  mean weight after : {statistics.mean(after):>7.1f} g")

    if unexpected:
        print()
        print(f"REFUSING TO WRITE - {len(unexpected)} weights changed outside the")
        print("corrected categories, so the weight rule is not being reproduced")
        print("faithfully. First few:")
        for line in unexpected[:12]:
            print(f"  {line}")
        raise SystemExit(1)

    if args.dry_run:
        print("\ndry run — nothing written")
        return

    INGREDIENTS.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    RECIPES.write_text(json.dumps(recipes, ensure_ascii=False), encoding="utf-8")
    print("\nwritten")


if __name__ == "__main__":
    main()
