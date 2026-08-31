"""Compute each recipe's per-serving nutrition from its ingredients.

The old corpus published nine nutrients per serving and the app simply
reprinted them. Nothing in this library publishes nutrition at all - a
Wikibooks Cookbook page is a method, not a label - so the figures have to be
built the same way the plan's intake already is: sum the FoodData Central
panel for each ingredient over its weight, and divide by the servings.

That is a real improvement disguised as a chore. The old numbers were a
third-party's, unverifiable and occasionally absurd; these are derived from
USDA panels by arithmetic anyone can check, using exactly the machinery in
src/domain/nutrition/intake.ts that computes what a plan delivers. Recipe
nutrition and plan nutrition can no longer disagree, because they are now the
same calculation run over different scopes.

What it cannot do is invent coverage. An ingredient FDC has no panel for
contributes nothing, so a total can understate. `coverage` records the share
of each recipe's mass that carried a value and the build refuses anything
under COVERAGE_FLOOR, which is what stops a recipe reporting 40 kcal because
only its parsley matched.

Run:  python scripts/attach_recipe_nutrition.py
In:   src/data/generated/recipes.json           (nutrition_source: "pending")
      src/data/generated/ingredient_nutrition.json
Out:  src/data/generated/recipes.json           (nutrition filled in)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GENERATED = ROOT / "src" / "data" / "generated"
RECIPES = GENERATED / "recipes.json"
PANELS = GENERATED / "ingredient_nutrition.json"

# The nine figures a recipe card shows, and the panel key each comes from.
CARD = [
    "energy_kcal", "protein_g", "fat_g", "saturated_fat_g", "cholesterol_mg",
    "sodium_mg", "carbohydrate_g", "fiber_g", "sugar_g",
]

# Below this share of a recipe's mass carrying an energy value, the total is
# not an understatement, it is wrong.
COVERAGE_FLOOR = 0.55

# Grams of carbohydrate per serving a recipe may have and still be keto.
KETO_CARB_G = 15.0

# A portion of food is somewhere between a snack and a very large dinner. Both
# ends of this catch the failure that matters: a bad FoodData Central match
# supplying another food's numbers. "Scrubbed bearded mussels" matched an oil
# once and came out at 9,265 kcal a serving, which nothing on screen would
# have questioned - the plan would simply have been built around one dish.
MIN_KCAL_PER_SERVING = 40
MAX_KCAL_PER_SERVING = 1600

# Nothing edible is denser in energy than pure fat.
MAX_KCAL_PER_100G = 900


def main() -> int:
    if not RECIPES.exists() or not PANELS.exists():
        print("run build_recipe_library.py and fetch_fdc_nutrition.py first",
              file=sys.stderr)
        return 1

    recipes = json.loads(RECIPES.read_text(encoding="utf-8"))
    panels = json.loads(PANELS.read_text(encoding="utf-8"))

    thin: list[str] = []
    implausible: list[str] = []
    unmatched: dict[str, float] = {}

    for recipe in recipes:
        servings = max(recipe["servings"], 1)
        totals = {key: 0.0 for key in CARD}
        covered = 0.0
        mass = 0.0

        for item in recipe["ingredients"]:
            grams = float(item["grams"])
            mass += grams
            panel = panels.get(item["id"])
            if not panel or not panel.get("per_100g"):
                unmatched[item["id"]] = unmatched.get(item["id"], 0.0) + grams
                continue
            per_100g = panel["per_100g"]
            if "energy_kcal" in per_100g:
                covered += grams
            for key in CARD:
                value = per_100g.get(key)
                if value is not None:
                    totals[key] += value * grams / 100.0

        coverage = covered / mass if mass else 0.0
        recipe["nutrition"] = {
            key: round(totals[key] / servings, 1) for key in CARD
        }
        recipe["nutrition_source"] = "fdc"
        recipe["nutrition_coverage"] = round(coverage, 3)
        recipe["diet"]["keto"] = recipe["nutrition"]["carbohydrate_g"] <= KETO_CARB_G

        if coverage < COVERAGE_FLOOR:
            thin.append(f"{recipe['slug']}: {coverage:.0%} of mass matched")

        kcal = recipe["nutrition"]["energy_kcal"]
        density = totals["energy_kcal"] / mass * 100 if mass else 0.0
        if not MIN_KCAL_PER_SERVING <= kcal <= MAX_KCAL_PER_SERVING:
            implausible.append(
                f"{recipe['slug']}: {kcal:.0f} kcal a serving over {servings}")
        if density > MAX_KCAL_PER_100G:
            implausible.append(
                f"{recipe['slug']}: {density:.0f} kcal per 100 g, denser than fat")

    RECIPES.write_text(
        json.dumps(recipes, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    energies = sorted(r["nutrition"]["energy_kcal"] for r in recipes)
    middle = energies[len(energies) // 2]
    print(f"{len(recipes)} recipes given nutrition from FDC panels")
    print(f"  energy per serving   min {energies[0]:.0f}  median {middle:.0f}  "
          f"max {energies[-1]:.0f} kcal")
    print(f"  mean mass coverage   "
          f"{sum(r['nutrition_coverage'] for r in recipes) / len(recipes):.0%}")
    print(f"  keto-compatible      {sum(1 for r in recipes if r['diet']['keto'])}")

    if unmatched:
        worst = sorted(unmatched.items(), key=lambda kv: -kv[1])[:15]
        print(f"\n{len(unmatched)} ingredients with no FDC panel, heaviest first:")
        for name, grams in worst:
            print(f"  {grams:8.0f} g  {name}")
    if thin:
        print(f"\n{len(thin)} recipes under the {COVERAGE_FLOOR:.0%} coverage floor:")
        for line in thin:
            print(f"  {line}")
    if implausible:
        print(f"\n{len(implausible)} implausible figures:")
        for line in implausible:
            print(f"  {line}")
    return 1 if (thin or implausible) else 0


if __name__ == "__main__":
    raise SystemExit(main())
