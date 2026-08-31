"""Recipes written here because no permitted source publishes one.

Twenty-nine of the hundred dishes have a Wikipedia article - so a description
and a photograph - but no Wikibooks Cookbook page with a real Ingredients and
Procedure section. Ramen, pho, shawarma, pizza margherita and pan con tomate
are all in that position: famous enough that an app about everyday cooking
looks broken without them, and absent from the one recipe source whose licence
allows reuse.

The alternative was to scrape a food site that forbids it, or to drop the
dish. Writing the method is the honest third option, and the recipe carries
``method_source: "authored"`` so the app can say which of the two it is
showing.

Format
------
Ingredient lines are written the way the Cookbook writes them, because
``measures.parse`` reads both and there is no reason for two dialects:

    "450 g spaghetti"          mass, exact
    "3 tablespoons olive oil"  volume, converted through a density
    "4 cloves garlic"          count, converted through a per-item weight
    "Salt"                     no quantity, resolved as a seasoning

Metric first. Where a range is genuinely the recipe ("2-3 tablespoons"), write
the range; the parser takes the midpoint. Put anything that is a restatement
rather than an ingredient - "(1 pound)" - in parentheses, which are dropped.

Quantities must be for the serving count declared in ``recipe_sources.py``,
because that is what every per-serving figure in the app divides by.
"""

from __future__ import annotations

from importlib import import_module

MODULES = [
    "american",
    "french",
    "italian",
    "japanese",
    "spanish",
    "world",
]


def load() -> dict[str, dict]:
    """Every authored recipe, keyed by slug."""
    recipes: dict[str, dict] = {}
    for name in MODULES:
        try:
            module = import_module(f"authored.{name}")
        except ModuleNotFoundError:
            continue
        for slug, recipe in getattr(module, "RECIPES", {}).items():
            if slug in recipes:
                raise ValueError(f"{slug} is authored in two modules")
            recipes[slug] = recipe
    return recipes
