"""Attach Food.com image URLs to the recipe subset already shipped.

The generated subset drops the corpus's `Images` column, so the app shows food
without ever showing food. This puts it back.

It deliberately does NOT re-run build_recipe_subset.py. That script stratifies
a random sample across cuisine x meal slot; re-running it would return a
different 1,600 recipes, invalidating every plan a user has saved and every
recipe id already referenced in their pantry ledger. This script only reads the
ids that are already there and writes one new field beside them.

The corpus stores images as an R vector - c("https://...", "https://...") -
and roughly 7% of rows have none. Those get null, and the UI draws a
placeholder rather than collapsing the layout.

Idempotent: re-running overwrites `image` with the same value.

Run:  python scripts/add_recipe_images.py
In:   data-source/recipes.csv  (704 MB, streamed in chunks)
Out:  src/data/generated/recipes.json  (rewritten in place, order preserved)
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data-source" / "recipes.csv"
RECIPES_PATH = ROOT / "src" / "data" / "generated" / "recipes.json"

CHUNK = 200_000

# The corpus wraps each URL in escaped double quotes inside an R c(...) vector.
URL_IN_VECTOR = re.compile(r'"(https?://[^"]+)"')


def first_url(value: object) -> str | None:
    """The first image URL in an R vector cell, or None."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None

    match = URL_IN_VECTOR.search(str(value))
    return match.group(1) if match else None


def main() -> None:
    if not CSV_PATH.exists():
        raise SystemExit(f"missing corpus: {CSV_PATH}")

    recipes = json.loads(RECIPES_PATH.read_text(encoding="utf-8"))
    wanted = {recipe["id"] for recipe in recipes}
    print(f"subset: {len(recipes)} recipes")

    found: dict[int, str] = {}
    scanned = 0

    for chunk in pd.read_csv(
        CSV_PATH, usecols=["RecipeId", "Images"], chunksize=CHUNK
    ):
        scanned += len(chunk)
        hits = chunk[chunk.RecipeId.isin(wanted)]
        for recipe_id, images in zip(hits.RecipeId, hits.Images):
            url = first_url(images)
            if url:
                found[int(recipe_id)] = url

        print(f"  scanned {scanned:,} rows, matched {len(found):,}", end="\r")

    print()

    for recipe in recipes:
        recipe["image"] = found.get(recipe["id"])

    RECIPES_PATH.write_text(
        json.dumps(recipes, ensure_ascii=False), encoding="utf-8"
    )

    covered = sum(1 for recipe in recipes if recipe["image"])
    print(f"images: {covered} / {len(recipes)} ({100 * covered / len(recipes):.1f}%)")


if __name__ == "__main__":
    main()
