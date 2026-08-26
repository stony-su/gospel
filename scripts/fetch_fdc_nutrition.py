"""Attach USDA FoodData Central nutrient panels to the ingredient taxonomy.

The recipe corpus publishes nine nutrients per serving, and only five of them
map to one of the workbook's 48 targets. Everything else - every vitamin, every
mineral, every amino acid - has been resolved as a target and left blank on the
intake side. This is what fills that in.

FDC's SR Legacy foods carry ~120 nutrients each, covering 43 of the 48. The
five it does not routinely measure - iodine, chromium, molybdenum, biotin and
chloride - stay null, and the app keeps reporting them as unmeasured. That is
the honest outcome, not a gap to paper over.

Matching policy is best-match-always: whatever FDC's search ranks first for an
ingredient name is what gets used. That guarantees full coverage and accepts
some wrong matches in exchange. Every record therefore carries `match_score`
and `match_description`, so the error rate is auditable after the fact even
though nothing on screen exposes it.

The API allows 1,000 requests an hour. Every response is cached to disk, so a
run that is rate-limited or interrupted can simply be run again and will pick
up where it stopped. Re-running costs nothing.

Run:  python scripts/fetch_fdc_nutrition.py [--limit N]
Env:  FDC_API_KEY, read from .env (which is gitignored)
Out:  src/data/generated/ingredient_nutrition.json
      cache/fdc/<id>.json   (gitignored)
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INGREDIENTS = ROOT / "src" / "data" / "generated" / "ingredients.json"
OUT = ROOT / "src" / "data" / "generated" / "ingredient_nutrition.json"
OVERRIDES = ROOT / "src" / "data" / "generated" / "fdc_overrides.json"
CACHE = ROOT / "cache" / "fdc"
DETAIL_CACHE = ROOT / "cache" / "fdc-detail"

SEARCH_API = "https://api.nal.usda.gov/fdc/v1/foods/search"
DETAIL_API = "https://api.nal.usda.gov/fdc/v1/foods"

# The search endpoint returns an abridged panel that varies by food - 29
# nutrients for one, 40 for another, and no amino acids at all for most. The
# detail endpoint returns the full ~120. Fetching details in batches of 20
# costs ~56 requests for the whole taxonomy rather than another 1,104.
DETAIL_BATCH = 20

# Pace under 1,000/hour without crawling. A 429 backs off hard; the cache means
# an interrupted run loses nothing.
DELAY_SECONDS = 1.0
RATE_LIMIT_BACKOFF = 300

# Searched in order, stopping at the first that has anything.
#
# This is not cosmetic. SR Legacy carries the amino acid panel and Survey
# (FNDDS) does not, so a Survey match silently loses nine of the 48 targets.
# Asking FDC for all three at once lets its relevance ranking pick the thinner
# dataset, which it does often enough to matter - so ask the good one first
# and only widen when it genuinely has no match.
DATA_TYPE_TIERS = [["SR Legacy"], ["Foundation"], ["Survey (FNDDS)"]]

# --- Nutrient mapping --------------------------------------------------------
# FDC nutrient number -> (our nutrient id, factor applied to FDC's value).
#
# Factors convert FDC's reported unit to the workbook's. Water is the one
# approximation: FDC reports grams and the target is millilitres, which are
# equal for water at kitchen temperatures.
DIRECT: dict[str, tuple[str, float]] = {
    "255": ("water_ml", 1.0),
    "203": ("protein_g", 1.0),
    "205": ("carbohydrate_g", 1.0),
    "291": ("fiber_g", 1.0),
    "618": ("linoleic_acid_g", 1.0),
    "320": ("vitamin_a_ug_rae", 1.0),
    "323": ("vitamin_e_mg", 1.0),
    "430": ("vitamin_k_ug", 1.0),
    "401": ("vitamin_c_mg", 1.0),
    "404": ("thiamin_mg", 1.0),
    "405": ("riboflavin_mg", 1.0),
    "406": ("niacin_mg_ne", 1.0),
    "415": ("vitamin_b6_mg", 1.0),
    "435": ("folate_ug_dfe", 1.0),
    "418": ("vitamin_b12_ug", 1.0),
    "410": ("pantothenic_acid_mg", 1.0),
    "421": ("choline_mg", 1.0),
    "301": ("calcium_mg", 1.0),
    "305": ("phosphorus_mg", 1.0),
    "304": ("magnesium_mg", 1.0),
    "307": ("sodium_mg", 1.0),
    "306": ("potassium_mg", 1.0),
    "303": ("iron_mg", 1.0),
    "309": ("zinc_mg", 1.0),
    "312": ("copper_ug", 1000.0),      # FDC mg -> ug
    "315": ("manganese_mg", 1.0),
    "317": ("selenium_ug", 1.0),
    "313": ("fluoride_mg", 0.001),     # FDC ug -> mg
    # Amino acids: FDC reports grams, the workbook targets milligrams.
    "512": ("aa_histidine_mg", 1000.0),
    "503": ("aa_isoleucine_mg", 1000.0),
    "504": ("aa_leucine_mg", 1000.0),
    "505": ("aa_lysine_mg", 1000.0),
    "502": ("aa_threonine_mg", 1000.0),
    "501": ("aa_tryptophan_mg", 1000.0),
    "510": ("aa_valine_mg", 1000.0),
}

# Targets with more than one possible source, in order of preference. 851 is
# the precise ALA measurement but only some foods carry it; 619 is the broader
# 18:3 figure, present on nearly all.
ALTERNATES: dict[str, tuple[list[str], float]] = {
    "ala_g": (["851", "619"], 1.0),
    # Vitamin D in micrograms, falling back to nothing rather than to the IU
    # figure, which would be forty times too large if mistaken for micrograms.
    "vitamin_d_ug": (["328"], 1.0),
}

# Targets that are the sum of two FDC nutrients.
SUMMED: dict[str, tuple[list[str], float]] = {
    "aa_met_cys_mg": (["506", "507"], 1000.0),   # methionine + cystine
    "aa_phe_tyr_mg": (["508", "509"], 1000.0),   # phenylalanine + tyrosine
    "epa_dha_mg": (["629", "621"], 1000.0),      # EPA + DHA
}

# Kept out of the mapping deliberately: FDC does not routinely measure these,
# so they stay null and the app goes on reporting them as unmeasured.
UNAVAILABLE = ["iodine_ug", "chromium_ug", "molybdenum_ug", "biotin_ug", "chloride_mg"]

# Fat is stored raw because the target is a share of energy, computed later.
FAT = "204"
ENERGY_KCAL_UNITS = {"KCAL", "kcal"}


def slug(ingredient_id: str) -> str:
    """Filesystem-safe cache name for an ingredient id."""
    return "".join(c if c.isalnum() or c in "-_" else "_" for c in ingredient_id)


def api_key() -> str:
    env = ROOT / ".env"
    if not env.exists():
        raise SystemExit("missing .env with FDC_API_KEY")
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        if name.strip() == "FDC_API_KEY":
            return value.strip()
    raise SystemExit("FDC_API_KEY not found in .env")


def search(term: str, key: str) -> dict | None:
    """Best match for a term, preferring the datasets with fuller panels."""
    for tier in DATA_TYPE_TIERS:
        hit = search_tier(term, tier, key)
        if hit:
            return hit
        time.sleep(DELAY_SECONDS)
    return None


def search_tier(term: str, data_types: list[str], key: str) -> dict | None:
    params = {
        "query": term,
        "dataType": ",".join(data_types),
        "pageSize": 1,
        "api_key": key,
    }
    url = f"{SEARCH_API}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers={"User-Agent": "gospel/1.0"})

    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                payload = json.load(response)
            foods = payload.get("foods") or []
            return foods[0] if foods else None
        except urllib.error.HTTPError as error:
            if error.code == 429:
                print(f"  rate limited, waiting {RATE_LIMIT_BACKOFF}s", flush=True)
                time.sleep(RATE_LIMIT_BACKOFF)
                continue
            if error.code >= 500:
                time.sleep(5 * (attempt + 1))
                continue
            # Anything else is a request the API refused. Say what and why
            # rather than surfacing a bare HTTPError from inside urllib.
            body = error.read()[:300].decode("utf-8", errors="replace")
            print(f"  HTTP {error.code} for {term!r}: {body}", flush=True)
            return None
        except (urllib.error.URLError, TimeoutError):
            time.sleep(5 * (attempt + 1))

    return None


def fetch_details(fdc_ids: list[int], key: str) -> list[dict]:
    """Full nutrient panels for up to DETAIL_BATCH foods in one request."""
    url = f"{DETAIL_API}?{urllib.parse.urlencode({'api_key': key})}"
    body = json.dumps({"fdcIds": fdc_ids, "format": "full"}).encode("utf-8")

    for attempt in range(4):
        request = urllib.request.Request(
            url,
            data=body,
            headers={"Content-Type": "application/json", "User-Agent": "gospel/1.0"},
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code == 429:
                print(f"  rate limited, waiting {RATE_LIMIT_BACKOFF}s", flush=True)
                time.sleep(RATE_LIMIT_BACKOFF)
                continue
            if error.code >= 500:
                time.sleep(5 * (attempt + 1))
                continue
            detail = error.read()[:300].decode("utf-8", errors="replace")
            print(f"  HTTP {error.code} on detail batch: {detail}", flush=True)
            return []
        except (urllib.error.URLError, TimeoutError):
            time.sleep(5 * (attempt + 1))

    return []


def panel(food: dict) -> dict[str, float]:
    """FDC's nutrient list, reduced to the workbook's ids and units."""
    by_number: dict[str, float] = {}
    energy_kcal: float | None = None

    for entry in food.get("foodNutrients") or []:
        # Search results are flat; detail results nest the descriptor under
        # `nutrient` and the value under `amount`.
        nested = entry.get("nutrient") or {}
        number = str(nested.get("number") or entry.get("nutrientNumber") or "")
        value = entry.get("amount") if entry.get("amount") is not None else entry.get("value")
        if value is None:
            continue

        unit = str(nested.get("unitName") or entry.get("unitName") or "")
        name = str(nested.get("name") or entry.get("nutrientName") or "")

        # Energy appears twice, in kcal and kJ. Take the kcal one by unit
        # rather than by number, which differs across FDC data types.
        if name.lower().startswith("energy") and unit in ENERGY_KCAL_UNITS:
            energy_kcal = float(value)

        by_number[number] = float(value)

    out: dict[str, float] = {}
    if energy_kcal is not None:
        out["energy_kcal"] = energy_kcal

    for number, (nutrient_id, factor) in DIRECT.items():
        if number in by_number:
            out[nutrient_id] = round(by_number[number] * factor, 6)

    for nutrient_id, (numbers, factor) in ALTERNATES.items():
        for number in numbers:
            if number in by_number:
                out[nutrient_id] = round(by_number[number] * factor, 6)
                break

    for nutrient_id, (numbers, factor) in SUMMED.items():
        parts = [by_number[n] for n in numbers if n in by_number]
        if parts:
            out[nutrient_id] = round(sum(parts) * factor, 6)

    if FAT in by_number:
        out["fat_g"] = round(by_number[FAT], 6)

    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="stop after N searches")
    args = parser.parse_args()

    key = api_key()
    CACHE.mkdir(parents=True, exist_ok=True)
    DETAIL_CACHE.mkdir(parents=True, exist_ok=True)

    ingredients = json.loads(INGREDIENTS.read_text(encoding="utf-8"))["ingredients"]
    print(f"ingredients: {len(ingredients)}", flush=True)

    # --- Phase 1: one search per ingredient, to find its fdcId --------------
    fetched = 0
    for index, ingredient in enumerate(ingredients):
        path = CACHE / f"{slug(ingredient['id'])}.json"
        if path.exists():
            continue
        if args.limit and fetched >= args.limit:
            break

        # The display name searches better than the id, which is normalised
        # and often truncated.
        food = search(ingredient["name"], key)
        path.write_text(json.dumps(food or {}, ensure_ascii=False), encoding="utf-8")
        fetched += 1

        if fetched % 50 == 0:
            print(f"  search {index + 1}/{len(ingredients)}", flush=True)
        time.sleep(DELAY_SECONDS)

    print(f"searched: {len(list(CACHE.glob('*.json')))} / {len(ingredients)}", flush=True)

    # --- Phase 2: full panels, in batches ----------------------------------
    #
    # Overrides are loaded here, not at assembly, because their fdcIds need
    # queueing like any other. An override pointing at a food whose panel was
    # never fetched yields no nutrients at all, which is worse than the wrong
    # match it replaced.
    overrides = (
        json.loads(OVERRIDES.read_text(encoding="utf-8")) if OVERRIDES.exists() else {}
    )
    if overrides:
        print(f"overrides: {len(overrides)}", flush=True)

    wanted: list[int] = []
    for override in overrides.values():
        fdc_id = override.get("fdc_id")
        if fdc_id and not (DETAIL_CACHE / f"{fdc_id}.json").exists():
            wanted.append(int(fdc_id))
    for ingredient in ingredients:
        path = CACHE / f"{slug(ingredient['id'])}.json"
        if not path.exists():
            continue
        hit = json.loads(path.read_text(encoding="utf-8"))
        fdc_id = hit.get("fdcId")
        if fdc_id and not (DETAIL_CACHE / f"{fdc_id}.json").exists():
            wanted.append(int(fdc_id))

    wanted = sorted(set(wanted))
    if wanted:
        print(f"details to fetch: {len(wanted)}", flush=True)

    for offset in range(0, len(wanted), DETAIL_BATCH):
        batch = wanted[offset : offset + DETAIL_BATCH]
        for food in fetch_details(batch, key):
            fdc_id = food.get("fdcId")
            if fdc_id:
                (DETAIL_CACHE / f"{fdc_id}.json").write_text(
                    json.dumps(food, ensure_ascii=False), encoding="utf-8"
                )
        print(f"  detail {offset + len(batch)}/{len(wanted)}", flush=True)
        time.sleep(DELAY_SECONDS)

    # --- Phase 3: assemble whatever the caches hold ------------------------
    #
    # Overrides are applied ahead of the auto-match, not instead of it. FDC's
    # relevance ranking optimises for text similarity rather than for being the
    # same food, and refine_fdc_matches.py re-ranks the ingredients carrying
    # most of the corpus's weight. The automatic path still covers the tail.
    result: dict[str, dict] = {}
    for ingredient in ingredients:
        path = CACHE / f"{slug(ingredient['id'])}.json"
        if not path.exists():
            continue

        hit = json.loads(path.read_text(encoding="utf-8"))

        override = overrides.get(ingredient["id"])
        if override and override.get("fdc_id"):
            hit = {
                "fdcId": override["fdc_id"],
                "description": override.get("match_description"),
                "dataType": override.get("data_type"),
                "score": override.get("rank_score"),
            }

        fdc_id = hit.get("fdcId")
        if not fdc_id:
            continue

        # Prefer the full panel; fall back to the abridged search hit so this
        # produces something useful before phase 2 has finished.
        detail_path = DETAIL_CACHE / f"{fdc_id}.json"
        source = json.loads(detail_path.read_text(encoding="utf-8")) if detail_path.exists() else hit

        nutrients = panel(source)
        if not nutrients and override:
            # The override's panel never arrived. Fall back to the automatic
            # match rather than leaving the ingredient with nothing.
            auto = json.loads(path.read_text(encoding="utf-8"))
            auto_id = auto.get("fdcId")
            auto_path = DETAIL_CACHE / f"{auto_id}.json" if auto_id else None
            if auto_path and auto_path.exists():
                source = json.loads(auto_path.read_text(encoding="utf-8"))
                hit = auto
                nutrients = panel(source)

        if not nutrients:
            continue

        result[ingredient["id"]] = {
            "fdc_id": fdc_id,
            # Recorded so a best-match-always policy stays auditable: nothing
            # on screen uses these, but the error rate is knowable.
            "match_description": hit.get("description"),
            "match_score": round(float(hit.get("score") or 0), 3),
            "data_type": hit.get("dataType"),
            "overridden": bool(override and override.get("fdc_id")),
            "full_panel": detail_path.exists(),
            "per_100g": nutrients,
        }

    OUT.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")

    full = sum(1 for r in result.values() if r["full_panel"])
    print(f"matched: {len(result)} / {len(ingredients)}  ({full} with full panels)")
    print(f"unavailable by design: {', '.join(UNAVAILABLE)}")


if __name__ == "__main__":
    main()
