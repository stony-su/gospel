"""Confirm every dish in the spec can actually be built before building it.

Two promises to check, and both are load-bearing:

  every dish has a Commons photograph      "all recipes must have images"
  every non-authored dish parses a recipe  the Cookbook title really covers it

Run:  python scripts/check_sources.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import wikimedia  # noqa: E402
from recipe_sources import check, load_all  # noqa: E402


def main() -> int:
    check()
    problems: list[str] = []
    thin: list[str] = []

    sources = load_all()
    for index, source in enumerate(sources, 1):
        page = wikimedia.wikipedia_page(source.wikipedia)
        if page is None:
            problems.append(f"{source.slug}: no Commons image on {source.wikipedia}")
            image = "-"
        else:
            credit = wikimedia.image_credit(page.image_file)
            if credit is None:
                problems.append(f"{source.slug}: no credit for {page.image_file}")
                image = "?"
            else:
                image = f"{credit.license[:12]:<12} {credit.file[:34]}"

        if source.authored:
            recipe = "authored"
        else:
            parsed = wikimedia.cookbook_recipe(source.wikibooks)
            if parsed is None:
                problems.append(f"{source.slug}: Cookbook:{source.wikibooks} has no recipe")
                recipe = "MISSING"
            else:
                recipe = f"{len(parsed.ingredients):2d} ing {len(parsed.instructions):2d} steps"
                if len(parsed.ingredients) < 3 or len(parsed.instructions) < 2:
                    thin.append(f"{source.slug}: {recipe}")

        print(f"{index:3d} {source.slug:<22} {recipe:<18} {image}", flush=True)

    print()
    if thin:
        print(f"{len(thin)} thin recipes:")
        for line in thin:
            print(f"  {line}")
    if problems:
        print(f"\n{len(problems)} PROBLEMS:")
        for line in problems:
            print(f"  {line}")
        return 1
    print(f"all {len(sources)} dishes have a photograph and a method")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
