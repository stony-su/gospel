"""Audit the generated datasets for values that cannot be right.

Matching a thousand ingredient names to a food database automatically will get
some of them wrong, and a wrong match does not announce itself - it just
quietly supplies another food's numbers. Reading 1,104 rows is not a check;
testing them against things that must be true is.

Most of this is physics and arithmetic rather than nutrition. Nothing has more
than 900 kcal per 100 g, because pure fat is 900. Protein, carbohydrate and
fat cannot sum past 100 g in 100 g of food. Energy has to agree with the
Atwater sum of those three, or one of the four is wrong. A vegetable does not
have 700 kcal per 100 g - if it appears to, it has been matched to an oil or a
powder.

Every finding names the ingredient, the FDC food behind it, and what the
value would have to be to make sense, so each one can be checked at
fdc.nal.usda.gov rather than taken on faith.

Run:  python scripts/audit_data.py [--verbose]
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GENERATED = ROOT / "src" / "data" / "generated"

# Pure fat is 900 kcal/100 g and nothing edible exceeds it.
MAX_KCAL_PER_100G = 902

# Atwater: 4 kcal/g protein and carbohydrate, 9 kcal/g fat. Real foods diverge
# somewhat - fibre, alcohol, sugar alcohols, rounding - so only a wide miss is
# reported.
ATWATER_TOLERANCE = 0.40

# What a category cannot plausibly exceed, in kcal per 100 g. A vegetable
# reading 700 has been matched to an oil or a dried powder.
CATEGORY_MAX_KCAL: dict[str, int] = {
    "produce_veg": 200,
    "produce_leafy": 150,
    "produce_root": 200,
    "produce_fruit": 350,
    "herb_dry": 400,
    "broth": 100,
    "vinegar": 150,
    "alcohol": 400,
    "dairy_milk": 200,
    "seafood": 400,
    "meat_poultry": 500,
    "meat_red": 600,
}

# Categories where a check does not apply, with the reason. An exemption is
# only legitimate when the value is genuinely correct for that food, not when
# it is merely common - otherwise the audit is being taught to agree.
#
# Spices and dried herbs are mostly fibre, and Atwater counts fibre as
# carbohydrate at 4 kcal/g when the body gets almost nothing from it, so the
# macro sum runs well above the measured energy. That is the formula being
# wrong about fibre, not the data being wrong about the spice.
NO_ATWATER = {"spice", "herb_dry", "baking_agent", "alcohol"}

# Sodium bicarbonate really is 27,000 mg of sodium per 100 g, and table salt
# is 38,000. The check is for foods that should not be mostly sodium.
HIGH_SODIUM_OK = {"spice", "baking_agent", "condiment"}

# Dried spices and herbs are genuinely among the most mineral-dense foods by
# weight - cumin is 66 mg of iron per 100 g, marjoram 83 - because drying
# removes the water everything else is measured against. They are eaten by the
# gram, which is why the weight correction mattered more than this ceiling.
HIGH_MINERAL_OK = {"spice", "herb_dry"}

# Upper bounds per 100 g, well above any ordinary food. Exceeding one means
# the match is an organ meat, a fortified powder, or a supplement.
EXTREME: dict[str, tuple[float, str]] = {
    "vitamin_a_ug_rae": (6000, "liver or cod liver oil territory"),
    "vitamin_d_ug": (100, "fortified or fish liver oil"),
    "iron_mg": (50, "fortified cereal or organ meat"),
    "sodium_mg": (20000, "above pure salt"),
    "vitamin_c_mg": (1000, "concentrate or supplement"),
    "zinc_mg": (60, "oysters or fortified"),
    "selenium_ug": (1500, "brazil nuts or organ meat"),
}


def similarity(name: str, description: str) -> float:
    """Share of the ingredient's words that appear in the FDC description."""
    words = {w for w in re.split(r"[^a-z]+", name.lower()) if len(w) > 2}
    if not words:
        return 1.0
    lowered = description.lower()
    hits = sum(1 for w in words if w in lowered)
    return hits / len(words)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    panels = json.loads((GENERATED / "ingredient_nutrition.json").read_text("utf-8"))
    taxonomy = json.loads((GENERATED / "ingredients.json").read_text("utf-8"))
    recipes = json.loads((GENERATED / "recipes.json").read_text("utf-8"))
    ingredients = {i["id"]: i for i in taxonomy["ingredients"]}

    findings: dict[str, list[str]] = defaultdict(list)

    # --- Ingredient panels ------------------------------------------------
    for key, record in panels.items():
        per100 = record["per_100g"]
        food = record.get("match_description") or "?"
        category = (ingredients.get(key) or {}).get("category", "?")
        energy = per100.get("energy_kcal")

        if energy is not None and energy > MAX_KCAL_PER_100G:
            findings["impossible energy"].append(
                f"{key} = {energy:.0f} kcal/100g  [{food}]"
            )

        protein = per100.get("protein_g", 0.0)
        carb = per100.get("carbohydrate_g", 0.0)
        fat = per100.get("fat_g", 0.0)

        if protein + carb + fat > 105:
            findings["macros exceed 100g"].append(
                f"{key} = {protein + carb + fat:.0f} g/100g  [{food}]"
            )

        # Alcohol carries 7 kcal/g and Atwater counts none of it, so a
        # liqueur legitimately shows more energy than its macros explain.
        # Keyed off the matched food rather than the category, because the
        # taxonomy files creme de cacao under "chocolate" and sake under
        # "other" - the categories are not reliable enough to check against.
        alcoholic = "alcoholic beverage" in food.lower()
        if energy and energy > 50 and category not in NO_ATWATER and not alcoholic:
            atwater = 4 * protein + 4 * carb + 9 * fat
            if atwater > 0 and abs(atwater - energy) / energy > ATWATER_TOLERANCE:
                findings["energy disagrees with macros"].append(
                    f"{key}: stated {energy:.0f} vs macros {atwater:.0f} kcal  [{food}]"
                )

        water = per100.get("water_ml")
        if water is not None and water > 100:
            findings["water over 100g"].append(f"{key} = {water:.0f} g/100g  [{food}]")

        ceiling = CATEGORY_MAX_KCAL.get(category)
        if ceiling and energy and energy > ceiling:
            findings["implausible for its category"].append(
                f"{key} ({category}) = {energy:.0f} kcal, expected < {ceiling}  [{food}]"
            )

        for nutrient, (limit, why) in EXTREME.items():
            if nutrient == "sodium_mg" and category in HIGH_SODIUM_OK:
                continue
            if nutrient in {"iron_mg", "zinc_mg"} and category in HIGH_MINERAL_OK:
                continue
            value = per100.get(nutrient)
            if value is not None and value > limit:
                findings["extreme nutrient"].append(
                    f"{key}: {nutrient} = {value:.0f} (> {limit}, {why})  [{food}]"
                )

        name = (ingredients.get(key) or {}).get("name", key)
        if similarity(name, food) < 0.34:
            findings["match barely resembles the ingredient"].append(
                f"{key!r} -> {food!r}"
            )

    # --- Recipes -----------------------------------------------------------
    capped = 0
    for recipe in recipes:
        servings = recipe.get("servings")
        if not servings or servings <= 0:
            findings["bad serving count"].append(f"recipe {recipe['id']}: {servings}")

        for ingredient in recipe["ingredients"]:
            grams = ingredient.get("grams")
            if grams is None or grams < 0:
                findings["bad weight"].append(
                    f"recipe {recipe['id']}: {ingredient['id']} = {grams}"
                )
            elif grams >= 3000:
                capped += 1

            if ingredient["id"] not in ingredients:
                findings["ingredient missing from taxonomy"].append(
                    f"recipe {recipe['id']}: {ingredient['id']}"
                )

    if capped:
        findings["weight hit the 3000g parse guard"].append(
            f"{capped} ingredient uses across the corpus"
        )

    # --- Coverage ----------------------------------------------------------
    unmatched = [i["id"] for i in taxonomy["ingredients"] if i["id"] not in panels]

    # --- Report ------------------------------------------------------------
    print(f"ingredients:   {len(ingredients)}")
    print(f"with panels:   {len(panels)}")
    print(f"unmatched:     {len(unmatched)}")
    print(f"recipes:       {len(recipes)}")
    print()

    total = 0
    for heading in sorted(findings, key=lambda h: -len(findings[h])):
        rows = findings[heading]
        total += len(rows)
        print(f"{heading.upper()}  ({len(rows)})")
        for row in rows[: (len(rows) if args.verbose else 8)]:
            print(f"  {row}")
        if not args.verbose and len(rows) > 8:
            print(f"  ... and {len(rows) - 8} more")
        print()

    print(f"total findings: {total}")


if __name__ == "__main__":
    main()
