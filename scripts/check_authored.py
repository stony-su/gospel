"""Check the authored recipes before the build trusts them.

Every line has to survive `measures.parse`, because an unparseable line is
silently dropped by the builder and the recipe quietly loses an ingredient.
The weight checks catch the other failure mode: quantities written for a
different serving count than recipe_sources.py declares, which would put every
per-serving figure in the app out by that ratio.

Run:  python scripts/check_authored.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from authored import load  # noqa: E402
from measures import parse  # noqa: E402
from recipe_sources import BY_SLUG, SOURCES  # noqa: E402

# A cooked portion is somewhere between a snack and a large dinner. Outside
# this range the quantities are almost certainly for a different serving count.
MIN_G_PER_SERVING = 90
MAX_G_PER_SERVING = 1400


def main() -> int:
    recipes = load()
    wanted = {s.slug for s in SOURCES if s.authored}
    problems: list[str] = []

    for slug in sorted(wanted - set(recipes)):
        problems.append(f"{slug}: not written yet")
    for slug in sorted(set(recipes) - wanted):
        problems.append(f"{slug}: authored but the spec does not ask for it")

    for slug in sorted(wanted & set(recipes)):
        source = BY_SLUG[slug]
        recipe = recipes[slug]
        lines = recipe.get("ingredients") or []
        steps = recipe.get("instructions") or []

        if not 3 <= len(lines) <= 22:
            problems.append(f"{slug}: {len(lines)} ingredients")
        if not 3 <= len(steps) <= 16:
            problems.append(f"{slug}: {len(steps)} steps")

        total = 0.0
        for line in lines:
            measured = parse(line)
            if measured is None:
                problems.append(f"{slug}: unparseable line {line!r}")
                continue
            total += measured.grams

        per_serving = total / max(source.servings, 1)
        if not MIN_G_PER_SERVING <= per_serving <= MAX_G_PER_SERVING:
            problems.append(
                f"{slug}: {total:.0f} g over {source.servings} servings "
                f"= {per_serving:.0f} g each"
            )

        for step in steps:
            if len(step) < 10:
                problems.append(f"{slug}: step too short {step!r}")

        print(f"  {slug:<22} {len(lines):2d} ing  {len(steps):2d} steps  "
              f"{total:5.0f} g  {per_serving:4.0f} g/serving")

    print()
    if problems:
        print(f"{len(problems)} problems:")
        for line in problems:
            print(f"  {line}")
        return 1
    print(f"all {len(wanted)} authored recipes parse")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
