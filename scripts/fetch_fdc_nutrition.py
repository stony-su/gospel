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
import re
import time
import unicodedata
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

# FDC turns away roughly half of all requests with a 400 and an nginx error
# page, and it does so whether they arrive one a second or one every nine.
# Measured: eight requests at a 5 s gap and eight at a 9 s gap both got three
# through. So this is not a rate limit to pace under - it is an unreliable
# endpoint to retry at.
#
# Retrying quickly is what works. Ten ingredients took twenty-three requests
# and sixty-six seconds; backing off for five minutes on each refusal took
# half an hour to resolve one.
DELAY_SECONDS = 1.5
RATE_LIMIT_BACKOFF = 60
BACKOFF_STEPS = [3, 3, 5, 5, 8, 12]

# Consecutive unanswered searches before the run stops rather than burning
# an hour of backoffs. Nothing is lost: the cache holds what did answer.
MAX_STALLED = 5

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

# Three nutrients that are not among the workbook's 48 targets but are on every
# recipe card: saturated fat, cholesterol and sugars. The old corpus published
# them per serving; this one has to compute them from the same panels as
# everything else, so they have to come down with the panel.
LABEL_ONLY: dict[str, tuple[str, float]] = {
    "606": ("saturated_fat_g", 1.0),
    "601": ("cholesterol_mg", 1.0),
    "269": ("sugar_g", 1.0),
}
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


# Foods FoodData Central has, under names it does not.
#
# FDC is a US database and indexes US supermarket English. A library built from
# Italian, Spanish, French and Japanese cooking is full of ingredients it holds
# a perfectly good panel for and cannot find by the name the recipe uses. Each
# of these maps to the nearest food FDC actually publishes - a substitution,
# and named as one, not a translation.
ALIASES: dict[str, str] = {
    # Pasta shapes: FDC has "pasta, dry", not the shape.
    "trofie": "pasta dry enriched",
    "tonnarelli": "pasta dry enriched",
    "bucatini": "pasta dry enriched",
    "orzo": "pasta dry enriched",
    "lasagne sheets": "pasta dry enriched",
    # Cured pork. Guanciale and pancetta are closer to streaky bacon than to
    # ham, and lacon and panceta are the Spanish equivalents.
    "guanciale": "pork cured bacon raw",
    "pancetta": "pork cured bacon raw",
    "panceta": "pork cured bacon raw",
    "lac n": "pork cured shoulder",
    "lacon": "pork cured shoulder",
    "morcilla asturiana": "blood sausage",
    "morcilla": "blood sausage",
    "chorizo": "sausage chorizo pork and beef",
    # British and Commonwealth spellings.
    "courgette": "squash summer zucchini raw",
    "courgettes": "squash summer zucchini raw",
    "aubergine": "eggplant raw",
    "yoghurt": "yogurt plain whole milk",
    "coriander leaves": "coriander cilantro leaves raw",
    "rocket": "arugula raw",
    "swede": "rutabagas raw",
    "mangetout": "peas edible-podded raw",
    "tinned chopped tomatoes": "tomatoes canned",
    "tinned tomatoes": "tomatoes canned",
    # Japanese pantry.
    "panko": "bread crumbs dry grated plain",
    "panko breadcrumbs": "bread crumbs dry grated plain",
    "dashi": "fish broth",
    "mirin": "wine rice cooking",
    "sake": "wine rice cooking",
    "shiitake": "mushrooms shiitake raw",
    "kombu": "seaweed kelp raw",
    "nori": "seaweed laver raw",
    "wakame": "seaweed wakame raw",
    "miso": "miso soybean paste",
    "gochujang": "sauce chili",
    "doubanjiang": "sauce chili",
    # Odds and ends that are a bundle rather than a food.
    "bouquet garni": "thyme dried",
    "mixed herbs": "thyme dried",
    "italian seasoning": "oregano dried",

    # --- Corrections the data audit found ---------------------------------
    # Each of these was matched by relevance to something that is not the same
    # food, and the wrong panel does not announce itself - it just supplies
    # another food's numbers. Every line here names what scripts/audit_data.py
    # caught it becoming.
    "garlic": "garlic raw",                       # was: cloves, ground spice
    "anchovies": "fish anchovy european raw",     # was: ham, minced
    "black olives": "olives ripe canned",         # was: olive loaf, pork
    "green olives": "olives pickled canned green",
    "greek olives": "olives ripe canned",         # was: Greek minestrone soup
    "artichokes": "artichokes globe french raw",  # was: Jerusalem artichoke
    "artichoke hearts": "artichokes globe french raw",
    "ice": "water bottled generic",               # was: dry beef broth cubes
    "ice cubes": "water bottled generic",
    "potatoes": "potatoes flesh and skin raw",    # was: potato bread
    "floury potatoes": "potatoes flesh and skin raw",
    "waxy potatoes": "potatoes flesh and skin raw",
    "new potatoes": "potatoes flesh and skin raw",
    "chicken stock": "soup stock chicken home-prepared",
    "chicken broth": "soup stock chicken home-prepared",
    "beef stock": "soup stock beef home-prepared",
    "beef broth": "soup stock beef home-prepared",
    "vegetable stock": "soup stock vegetable",
    "vegetable broth": "soup stock vegetable",
    "fish stock": "soup stock fish home-prepared",
    "duck fat": "fat duck",                       # was: duck liver, raw
    "chicken wingettes": "chicken wing raw",      # was: chicken spread
    "chicken wings": "chicken wing raw",
    "beef leg and marrow bones": "beef shank crosscuts raw",
    "meat": "beef ground raw",
    "beef": "beef ground raw",                    # was: canned corned beef
    "white onions": "onions raw",                 # was: small white beans
    "tomatoes": "tomatoes red ripe raw",          # was: tomato powder
    "red tomatoes": "tomatoes red ripe raw",
    "plum tomatoes": "tomatoes red ripe raw",
    "red chili pepper flakes": "spices pepper red cayenne",
    "chili flakes": "spices pepper red cayenne",
    "poultry shake": "spices poultry seasoning",
    "comte": "cheese gruyere",
    "emmental": "cheese swiss",
    "baguettes": "bread french or vienna",
    "baguette": "bread french or vienna",
    # Second pass, after the audit: FDC's relevance ranking answers a plain cut
    # of meat with the fattiest thing sharing its name, and a fish with its oil.
    "pork": "pork loin raw",                      # was: pork backfat, 812 kcal
    "pork cutlets": "pork loin raw",
    "pork chops": "pork loin raw",
    "salmon": "fish salmon atlantic raw",         # was: salmon oil, 902 kcal
    "smoked salmon": "fish salmon smoked",
    "tuna": "fish tuna yellowfin raw",
    "potato": "potatoes flesh and skin raw",      # was: potato flour
    "potato starch": "cornstarch",
    "spanish onion": "onions raw",                # was: spanish peanuts
    "mild spanish onion": "onions raw",
    "black pepper": "spices pepper black",        # was: banana pepper
    "black peppercorns": "spices pepper black",
    "white pepper": "spices pepper white",
    "duck fat": "fat goose",                      # was: duck liver
    "salt pork": "pork cured bacon raw",
    # Third pass. Every one of these was carrying real mass in the corpus.
    "prawns": "crustaceans shrimp raw",            # was: abiyuch, a fruit
    "prawn": "crustaceans shrimp raw",
    "shrimp": "crustaceans shrimp raw",
    "clams": "mollusks clam mixed species raw",    # was: ham, minced
    "chickpeas": "chickpeas garbanzo beans canned",  # was: chickpea flour
    "tinned chickpeas": "chickpeas garbanzo beans canned",
    "canned chickpeas": "chickpeas garbanzo beans canned",
    "breadcrumbs": "bread crumbs dry grated plain",  # was: dried litchis
    "fresh breadcrumbs": "bread crumbs dry grated plain",
    "bean sprouts": "mung beans sprouted raw",     # was: sprouted kidney beans
    "beansprouts": "mung beans sprouted raw",
    "fabes de la granja": "beans white mature seeds raw",   # was: dulce de leche
    "butter beans": "beans lima large mature seeds raw",
    # Fourth pass, over the heaviest ingredients the five-hundred-recipe
    # library left unmatched.
    "turkey stock": "soup stock turkey home-prepared",
    "siling labuyo": "peppers hot chili red raw",
    "stockfish": "fish cod atlantic dried salted",
    "cannellini beans": "beans white mature seeds canned",
    "white house honey": "honey",
    "seitan": "wheat gluten vital",
    "sultanas": "raisins seedless",
    "brandy": "alcoholic beverage distilled all 80 proof",
    "banana ketchup": "catsup",
    "bicarbonate of soda": "leavening agents baking soda",
    "caster sugar": "sugars granulated",
    "double cream": "cream fluid heavy whipping",
    "single cream": "cream fluid light",
    "soured cream": "cream sour cultured",
    "plain flour": "wheat flour white all-purpose enriched",
    "strong white flour": "wheat flour white bread enriched",
    "self-raising flour": "wheat flour white all-purpose self-rising",
    "cornflour": "cornstarch",
    "golden syrup": "syrups corn light",
    "mixed spice": "spices allspice ground",
    "spring onions": "onions spring or scallions raw",
    "mangetout": "peas edible-podded raw",
    "swede": "rutabagas raw",
    "gram flour": "chickpea flour besan",
    "semolina": "wheat flour semolina enriched",
    "gochugaru": "spices pepper red cayenne",
    "aekjeot": "fish sauce",
    "yufka": "phyllo dough",
    "mostarda": "conserve fruit",
    "full-fat milk": "milk whole 3.25% milkfat",     # was: acorn flour
    "full fat milk": "milk whole 3.25% milkfat",
    "whole milk": "milk whole 3.25% milkfat",
    "malt extract": "syrups malt",                   # was: vanilla extract
    "amber crystal malt": "barley malt flour",
    # The Mediterranean fish a bouillabaisse is made of are not in a US food
    # database. Scorpionfish and conger were both answered with whole-wheat
    # crackers, at 427 kcal per 100 g. Cod stands in: a lean white fish is a
    # lean white fish, and saying so is better than saying biscuit.
    "scorpionfish": "fish cod atlantic raw",
    "conger": "fish cod atlantic raw",
    "red gurnard": "fish cod atlantic raw",
    "sea robin": "fish cod atlantic raw",
    "john dory": "fish cod atlantic raw",
    "lotte": "fish monkfish raw",
    "monkfish": "fish monkfish raw",
    "sea urchins": "fish roe mixed species raw",
    "sea bream": "fish sea bass raw",
    "turbot": "fish halibut atlantic raw",
    "nori sheets": "seaweed laver raw",
    "beni shoga": "ginger root raw",
    "umeboshi": "plums raw",
    "shichimi togarashi": "spices pepper red or cayenne",
}

_ALIAS_KEYS = sorted(ALIASES, key=len, reverse=True)


def search_term(name: str) -> str:
    """An ingredient name FDC's search endpoint will accept.

    The API answers 400 rather than "no results" to a query it cannot parse -
    non-ASCII characters and stray punctuation both do it, so "Beni shoga" and
    "minced/ground beef" fail as requests rather than as searches. Folding to
    plain ASCII words costs nothing: FDC's own descriptions are ASCII, so a
    character it would have to transliterate anyway was never going to match.
    """
    folded = unicodedata.normalize("NFKD", name)
    folded = folded.encode("ascii", "ignore").decode("ascii")
    folded = re.sub(r"[^A-Za-z0-9 ]+", " ", folded)
    folded = re.sub(r"\s+", " ", folded).strip()
    lowered = folded.lower()
    if lowered in ALIASES:
        return ALIASES[lowered][:120]
    # Otherwise look for an alias inside the name, longest key first, so
    # "unsweetened yoghurt" and "nori sheets" find "yoghurt" and "nori".
    for alias in _ALIAS_KEYS:
        # The trailing s? is what makes "aubergines" find the "aubergine"
        # alias. Without it the plural falls through to FDC, which has never
        # heard the word.
        if re.search(rf"\b{re.escape(alias)}s?\b", lowered):
            return ALIASES[alias][:120]
    return folded[:120]


def search(term: str, key: str) -> dict | None:
    """Best match for a term, preferring the datasets with fuller panels.

    One request, not three. Asking each tier in turn cost an extra request for
    every ingredient SR Legacy did not have, and at five hundred recipes the
    API's thousand-an-hour ceiling is what the build waits on rather than the
    network. Asking for all three data types at once and picking the tier
    afterwards keeps exactly the same preference order for a third of the
    requests.

    The preference is not cosmetic: SR Legacy carries the amino acid panel and
    Survey does not, so letting FDC's relevance ranking choose between them
    silently loses nine of the forty-eight targets.
    """
    term = search_term(term)
    if not term:
        return []
    foods = search_all_tiers(term, key)
    if foods is None:
        return None                      # unknown, not "no match"
    for tier in DATA_TYPE_TIERS:
        for food in foods:
            if food.get("dataType") in tier:
                return food
    return foods[0] if foods else []


def search_all_tiers(term: str, key: str) -> list[dict] | None:
    """One search across every tier, ranked by FDC's own relevance.

    None means the API never answered; an empty list means it answered with
    nothing. The difference decides whether the miss gets cached.
    """
    types = [t for tier in DATA_TYPE_TIERS for t in tier]
    return search_tier(term, types, key, page_size=10)


def search_tier(term: str, data_types: list[str], key: str,
                page_size: int = 1) -> list[dict] | None:
    params = {
        "query": term,
        "dataType": ",".join(data_types),
        "pageSize": page_size,
        "api_key": key,
    }
    url = f"{SEARCH_API}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers={"User-Agent": "gospel/1.0"})

    for attempt in range(len(BACKOFF_STEPS)):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                payload = json.load(response)
            return payload.get("foods") or []
        except urllib.error.HTTPError as error:
            if error.code == 429:
                print(f"  rate limited, waiting {RATE_LIMIT_BACKOFF}s", flush=True)
                time.sleep(RATE_LIMIT_BACKOFF)
                continue
            if error.code >= 500:
                time.sleep(5 * (attempt + 1))
                continue
            body = error.read()[:300].decode("utf-8", errors="replace")
            # FDC answers a rate limit with 400 and an nginx error page as
            # often as it does with 429. Treating that as "this food does not
            # exist" is how a burst of throttling turns into a few hundred
            # ingredients permanently marked unmatched.
            if error.code == 400 and "<html" in body.lower():
                wait = BACKOFF_STEPS[min(attempt, len(BACKOFF_STEPS) - 1)]
                if attempt >= 3:
                    print(f"  retrying {term!r} ({attempt + 1})", flush=True)
                time.sleep(wait)
                continue
            # Anything else is a request the API genuinely refused. Say what
            # and why rather than surfacing a bare HTTPError from urllib.
            print(f"  HTTP {error.code} for {term!r}: {body}", flush=True)
            return []
        except (urllib.error.URLError, TimeoutError):
            time.sleep(5 * (attempt + 1))

    # Out of attempts without an answer either way. None means "do not know",
    # which the caller must not cache as "no match".
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

    for number, (nutrient_id, factor) in LABEL_ONLY.items():
        if number in by_number:
            out[nutrient_id] = round(by_number[number] * factor, 6)

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
    stalled = 0
    for index, ingredient in enumerate(ingredients):
        path = CACHE / f"{slug(ingredient['id'])}.json"
        if path.exists():
            continue
        if args.limit and fetched >= args.limit:
            break

        # The display name searches better than the id, which is normalised
        # and often truncated.
        food = search(ingredient["name"], key)
        if food is None:
            # The API never answered. Leave no cache entry, so the next run
            # asks again rather than treating a throttle as a verdict.
            stalled += 1
            if stalled >= MAX_STALLED:
                print(f"  giving up after {stalled} unanswered searches; "
                      f"re-run to continue", flush=True)
                break
            continue
        stalled = 0
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
