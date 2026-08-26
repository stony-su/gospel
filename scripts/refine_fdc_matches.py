"""Re-match the ingredients that carry most of the corpus's weight.

Best-match-always takes whatever FDC's relevance ranking puts first, and that
ranking optimises for text relevance rather than for being the same food. It
gave us salt matched to "Butter, salted", water to "Water convolvulus", and
tomatoes - used in 181 recipes - to "Tomato powder", which is seventeen times
denser than the fresh tomato the recipe means.

The failures share a shape, so they can be scored rather than reviewed. FDC
descriptions are "PrimaryFood, qualifier, qualifier": the food is the first
comma-separated token and everything after it is detail. "Butter, salted" is
butter; "Salt, table" is salt. Ranking candidates by whether their *primary
token* matches the ingredient, and penalising concentrated forms - powder,
oil, dried, paste - fixes the whole class.

Only the ingredients that matter are re-matched. Usage is heavily skewed:
tomatoes appear in 181 recipes, garlic in 225. Correcting the few hundred that
carry most of the mass moves nearly all of the error, and a wrong match in the
long tail barely shifts a total.

The result is an override table, applied ahead of the auto-match rather than
replacing it, so the automatic path stays intact and every correction is
inspectable.

Run:  python scripts/refine_fdc_matches.py [--top N] [--dry-run]
Out:  src/data/generated/fdc_overrides.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_fdc_nutrition import (  # noqa: E402
    DELAY_SECONDS,
    RATE_LIMIT_BACKOFF,
    SEARCH_API,
    api_key,
)

ROOT = Path(__file__).resolve().parent.parent
GENERATED = ROOT / "src" / "data" / "generated"
RECIPES = GENERATED / "recipes.json"
INGREDIENTS = GENERATED / "ingredients.json"
CURRENT = GENERATED / "ingredient_nutrition.json"
OUT = GENERATED / "fdc_overrides.json"
REVIEW = ROOT / "cache" / "fdc-needs-review.txt"

CANDIDATES = 25

# Forms that are the same foodstuff at a wildly different density. A recipe
# calling for tomatoes does not mean tomato powder, and one calling for cod
# does not mean cod liver oil.
CONCENTRATED = [
    "powder", "dried", "dehydrated", "concentrate", "extract", "paste",
    "oil", "freeze-dried", "granule", "bouillon", "syrup", "puree",
    # Prepared and packaged forms, for the same reason: a recipe asking for
    # potatoes does not mean a frozen potato-and-pepper dish.
    "frozen", "canned", "roll", "battered", "breaded", "seasoned",
]

# Forms that indicate the plain, as-purchased food.
PLAIN = ["raw", "table", "plain", "unprepared", "fresh"]

# A component of a food is not the food. Eggs are not egg whites.
PARTS = ["white", "yolk", "peel", "rind", "leaves", "seed", "hull"]

# Preparation adjectives the corpus attaches to ingredient names. They are how
# a cook describes handling, not what the food is, and leaving them in the
# query is what matched "fresh lemon juice" to "Egg, white, raw, fresh".
NOISE = {
    "fresh", "boiling", "boiled", "chopped", "minced", "ground", "grated",
    "boneless", "skinless", "large", "small", "medium", "whole", "hot",
    "cold", "warm", "frozen", "cooked", "raw", "sliced", "diced", "melted",
    "softened", "beaten", "peeled", "crushed", "shredded", "prepared",
}

# Below this, no candidate answers to the ingredient well enough to trust.
MIN_SCORE = 70

# Staples where the plain default is well known and the scorer cannot infer
# it: "milk" alone gives FDC no reason to prefer cow over sheep. These are the
# few worth stating outright rather than guessing at, and they carry more of
# the corpus's mass than anything else.
STAPLE_QUERIES: dict[str, str] = {
    "milk": "milk, whole",
    "sugar": "sugars, granulated",
    "flour": "wheat flour, white, all-purpose",
    "all-purpose flour": "wheat flour, white, all-purpose",
    "brown sugar": "sugars, brown",
    "onions": "onions, raw",
    "rice": "rice, white, long-grain, regular, raw",
    "chicken breasts": "chicken, broiler, breast, meat only, raw",
    "boneless skinless chicken breasts": "chicken, broiler, breast, meat only, raw",
    "potatoes": "potatoes, flesh and skin, raw",
    "cheddar cheese": "cheese, cheddar",
    "vegetable oil": "oil, vegetable",
}


def primary_token(description: str) -> str:
    """The food itself, before FDC's qualifiers."""
    return description.split(",")[0].strip().lower()


def singularise(word: str) -> str:
    return word[:-1] if word.endswith("s") and not word.endswith("ss") else word


def score(name: str, description: str) -> int:
    """How well an FDC food answers to an ingredient name."""
    name = name.lower().strip()
    primary = primary_token(description)
    lowered = description.lower()

    if primary == name:
        points = 100
    elif singularise(primary) == singularise(name):
        points = 90
    elif name in primary.split() or primary in name.split():
        points = 70
    elif name in lowered:
        points = 40
    else:
        points = 0

    # A concentrated form is only right when the ingredient asked for it.
    for form in CONCENTRATED:
        if form in lowered and form not in name:
            points -= 45

    for form in PLAIN:
        if form in lowered:
            points += 8

    # Credit the rest of the ingredient name, not just its head noun. Without
    # this every oil scores identically on "Oil" and the shortest description
    # wins, which is how olive oil became canola.
    head = set(primary.split())
    for word in name.split():
        if word not in head and re.search(rf"\b{re.escape(word)}\b", lowered):
            points += 18

    for part in PARTS:
        if re.search(rf"\b{part}s?\b", lowered) and part not in name:
            points -= 55

    # A mild preference for less-qualified descriptions. Deliberately mild:
    # tuning it harder started trading one wrong answer for another, which is
    # the point where a heuristic is being asked to do a judgement's job.
    points -= min(len(description) // 20, 4)

    return points


def query_for(name: str) -> str:
    """The ingredient name with preparation adjectives stripped."""
    words = [w for w in re.split(r"[^a-z]+", name.lower()) if w and w not in NOISE]
    return " ".join(words) or name


def search_candidates(term: str, key: str) -> list[dict]:
    params = {
        "query": term,
        "dataType": "SR Legacy,Foundation",
        "pageSize": CANDIDATES,
        "api_key": key,
    }
    url = f"{SEARCH_API}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers={"User-Agent": "gospel/1.0"})

    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return json.load(response).get("foods") or []
        except urllib.error.HTTPError as error:
            if error.code == 429:
                time.sleep(RATE_LIMIT_BACKOFF)
                continue
            return []
        except (urllib.error.URLError, TimeoutError):
            time.sleep(5 * (attempt + 1))

    return []


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--top", type=int, default=250, help="ingredients to re-match")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    recipes = json.loads(RECIPES.read_text(encoding="utf-8"))
    names = {
        i["id"]: i["name"]
        for i in json.loads(INGREDIENTS.read_text(encoding="utf-8"))["ingredients"]
    }
    current = json.loads(CURRENT.read_text(encoding="utf-8")) if CURRENT.exists() else {}

    # Rank by the mass an ingredient contributes across the whole corpus:
    # that is exactly the weight it carries in any plan's nutrition.
    mass: dict[str, float] = {}
    for recipe in recipes:
        for ingredient in recipe["ingredients"]:
            mass[ingredient["id"]] = mass.get(ingredient["id"], 0.0) + float(
                ingredient.get("grams") or 0
            )

    ranked = sorted(mass.items(), key=lambda kv: -kv[1])[: args.top]
    print(f"re-matching the top {len(ranked)} ingredients by corpus mass")

    key = api_key()
    overrides: dict[str, dict] = {}
    rejected: list[str] = []
    improved = 0

    for index, (ingredient_id, grams) in enumerate(ranked):
        name = names.get(ingredient_id, ingredient_id)
        # A staple query is a precise FDC-style description used to *find*
        # the right food. Scoring still runs against the plain ingredient
        # name - scoring against the query itself compares a description to a
        # description and rejects the very match it was written to select.
        plain = query_for(name)
        query = STAPLE_QUERIES.get(ingredient_id) or STAPLE_QUERIES.get(name) or plain
        foods = search_candidates(query, key)
        if not foods:
            time.sleep(DELAY_SECONDS)
            continue

        best = max(foods, key=lambda f: score(plain, f.get("description", "")))
        best_score = score(plain, best.get("description", ""))

        # Below the floor, no candidate is a confident answer. Leaving the
        # auto-match in place is better than replacing one wrong food with
        # another and calling it a correction.
        if best_score < MIN_SCORE:
            rejected.append(f"{name} (best {best_score}: {best.get('description', '')[:40]})")
            time.sleep(DELAY_SECONDS)
            continue

        was = (current.get(ingredient_id) or {}).get("match_description")
        if was != best.get("description"):
            improved += 1
            print(f"  {name:<24} {str(was)[:34]!r}")
            print(f"  {'':<24}   -> {best.get('description', '')[:44]!r}  ({best_score})")

        overrides[ingredient_id] = {
            "fdc_id": best.get("fdcId"),
            "match_description": best.get("description"),
            "data_type": best.get("dataType"),
            "rank_score": best_score,
            "corpus_grams": round(grams, 1),
        }

        if (index + 1) % 50 == 0:
            print(f"  ... {index + 1}/{len(ranked)}", flush=True)
        time.sleep(DELAY_SECONDS)

    print()
    print(f"overrides: {len(overrides)}  ({improved} differ from the auto-match)")
    print(f"left to the auto-match, no confident candidate: {len(rejected)}")
    for line in rejected[:15]:
        print(f"  {line}")

    # The scorer settles whether a candidate is the same foodstuff. It does not
    # settle which variety, and tuning it to try started trading one wrong
    # answer for another. Anything it declined is written out so it can be
    # decided by hand if it ever matters enough.
    if rejected and not args.dry_run:
        REVIEW.parent.mkdir(parents=True, exist_ok=True)
        REVIEW.write_text("\n".join(rejected) + "\n", encoding="utf-8")
        print(f"  ...written to {REVIEW.relative_to(ROOT)}")

    if args.dry_run:
        print("dry run - nothing written")
        return

    OUT.write_text(json.dumps(overrides, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"written to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
