"""Find the rest of the library in the Wikibooks Cookbook.

The first hundred dishes were chosen by hand, one row of recipe_sources.py
each. Four hundred more cannot be, so this walks the Cookbook's own
Category:Recipes - 3,792 pages - and keeps the ones that survive being asked
four questions:

  is it a recipe?      Ingredients and Procedure sections that parse into at
                       least four weighed ingredients and three steps
  is it a meal?        90-1400 g a serving, which is what separates a dish
                       from a spice rub or a bottle of cordial
  is there a picture?  a Commons file on the Cookbook page or on the dish's
                       Wikipedia article - no photograph, no recipe
  whose food is it?    the Cookbook's own origin categories first, then the
                       page's Cuisine and Recipe origin fields

The last one is why this is not simply the first four hundred pages that pass.
The brief is Japanese, Italian, American, French and Spanish with a scattering
of everything else, so those five are taken to exhaustion and the rest are
capped, which stops the 219 Nigerian recipes in the Cookbook from becoming a
fifth of the library on their own.

Servings, time and difficulty come from the page's infobox where it has one.
That is the Cookbook's answer rather than this script's, and about half of the
pages give it. The other half get an estimate from the shape of the recipe,
and `metadata_source` records which.

Run:  python scripts/discover_recipes.py [--target 400] [--limit N]
Out:  scripts/discovered.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import cookbook_index  # noqa: E402
import wikimedia  # noqa: E402
from measures import parse as parse_line  # noqa: E402
from recipe_sources import BY_SLUG, CUISINE_LABELS, SOURCES  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(__file__).resolve().parent / "discovered.json"

FOCUS = ["japanese", "italian", "american", "french", "spanish"]

# How many of each the finished library may hold, the curated hundred
# included. The five are effectively uncapped - the Cookbook does not have
# enough of them to reach these numbers - and everything else is limited so
# the scattering stays a scattering.
CAPS: dict[str, int] = {
    "japanese": 70, "italian": 95, "american": 100, "french": 80, "spanish": 45,
    "chinese": 22, "korean": 12, "southeast_asian": 26, "south_asian": 26,
    "mexican": 20, "middle_eastern": 22, "mediterranean": 18, "british": 26,
    "eastern_european": 20, "german": 18, "northern_european": 16,
    "african": 24, "latin_american": 16, "caribbean": 12, "canadian": 8,
    "hawaiian": 5, "oceanian": 8,
}

# Not a meal, whatever its category says. Drinks and flavourings pass the
# ingredient and step checks perfectly well and would be scheduled as dinner:
# the trial run put Marinara Sauce and Pesto on the plan as main courses.
NOT_A_MEAL = re.compile(
    # Drinks under a name that is not the English word for one: masala chai
    # got as far as being scheduled for dinner.
    r"\b(chai|lassi|horchata|atole|kombucha|sharbat|eggnog|boba|ayran|kvass|"
    # "Soda" only where it is the drink rather than the raising agent, which
    # is to say at the end of the name: Pepper Soda, not Soda Bread.
    r"agua fresca|hot chocolate)\b|\bsoda$|"
    r"\b(tea|coffee|cocktail|martini|liqueur|punch|smoothie|milkshake|lemonade|"
    r"cordial|syrup|wine|beer|cider|sangria|margarita|mojito|julep|toddy|"
    r"marinade|spice (?:rub|mix|blend)|seasoning (?:mix|blend|salt)|rub\b|"
    r"dressing|vinaigrette|glaze|brine|pickling liquid|extract|essence|"
    r"food colou?ring|playdough|play dough|pet |dog |cat )", re.IGNORECASE)

# A component rather than a dish. Pesto is an ingredient of a plate of trofie,
# and a plan that schedules a jar of it for dinner is wrong in a way no
# nutrition figure would reveal.
A_COMPONENT = re.compile(
    r"(?:\b(sauce|stock|broth|dough|pastry|icing|frosting|batter|paste|puree|"
    r"purée|conserve|chutney|relish|compote|curd|butter|jam|jelly|"
    r"pickles?|preserves?|marinara|mayonnaise|aioli)\s*(?:[IVX]+|\d+)?$)"
    # Named preparations that are a step in a dish rather than the dish.
    r"|^(pesto|dashi|duxelles|mirepoix|soffritto|roux|ganache|"
    r"crème\s+(?:pâtissière|anglaise|saint-honoré)|creme\s+(?:patissiere|anglaise)|"
    r"court.bouillon|garam masala|ghee|paneer|tahini|harissa|gremolata|"
    r"beurre\s+\w+)\s*(?:[IVX]+|\d+)?$",
    re.IGNORECASE)

# Bread and pastry are real, and they are not dinner.
# "Cornbread" and "Shortbread" have no word boundary before "bread", so the
# obvious \bbread\b reads them as dinner.
A_BAKE = re.compile(
    r"(\w*bread|baguette|focaccia|brioche|ciabatta|challah|naan|pita|roll|bun|"
    r"loaf|scone|crumpet|bagel|croissant|tortilla|cracker|breadstick)s?\b",
    re.IGNORECASE)

# Pages that are a technique or an index rather than a dish.
NOT_A_DISH_TITLE = re.compile(
    r"^(how to|basic|preparing|cooking|making|about|guide|tips|template|"
    r"sample|test)\b|\b(technique|method|glossary|index|table of contents)\b",
    re.IGNORECASE)

# Pages that pass every automatic check and are still not one recipe. Both of
# these list their own variants as ingredients - Cookbook:Borek's ingredient
# list is four other boreks - so they parse, weigh and photograph perfectly
# well and describe nothing a person could cook. Found by the coverage floor
# in attach_recipe_nutrition.py, which is the check that noticed their
# ingredients match no food in FoodData Central.
EXCLUDE_TITLES = {
    "Börek",
    "Börek (Turkish Filled Pastries)",
    "Pinza Mostarda Bolognese",
    # Half its mass is Korean pantry FoodData Central has never heard of,
    # so its nutrition would understate by nearly half. A side dish the
    # app cannot measure is one it should not schedule.
    "Cabbage Kimchi",
}

MIN_INGREDIENTS = 4
MIN_STEPS = 3
MIN_G_PER_SERVING = 90
MAX_G_PER_SERVING = 1400

# Slot from the dish's own name, for the pages the Cookbook did not file under
# a course. Ordered: "chicken soup" is a soup before it is a chicken dish.
SLOT_WORDS: list[tuple[str, str]] = [
    (r"\b(cake|cookie|biscuit|brownie|pie|tart|pudding|custard|ice cream|"
     r"sorbet|mousse|trifle|fudge|candy|truffle|scone|muffin|doughnut|donut|"
     r"cupcake|jelly|jam|marmalade|dessert|sweet|dip|crisps|chips|popcorn|"
     r"cracker|nuts|biscotti|macaron|meringue|bar\b)", "snack"),
    (r"\b(pancake|waffle|omelette|omelet|porridge|oatmeal|granola|cereal|"
     r"breakfast|toast|scrambled|frittata|hash brown|bacon and|congee|"
     r"smoothie bowl)\b", "breakfast"),
    (r"\b(soup|chowder|bisque|broth|salad|sandwich|wrap|roll|bun|toastie|"
     r"quesadilla|panini|baguette|slaw)\b", "lunch"),
    (r"\b(roast|stew|curry|casserole|pie|bake|grill|steak|chop|fillet|"
     r"risotto|pasta|noodle|rice|stir.fry|tagine|braise|ragout|goulash|"
     r"ravioli|lasagne|lasagna|gnocchi|tortellini|cannelloni|linguine|penne|"
     r"spaghetti|paella|schnitzel|meatball|meatloaf|donburi|katsu|kebab|"
     r"sushi|zushi|maki)\b", "dinner"),
]

# Rough time from the shape of the method, when the page does not say.
LONG_COOK = re.compile(
    r"\b(roast|bake|braise|simmer for|slow.cook|marinate overnight|rise|prove|"
    r"chill for|refrigerate|stew|reduce for)\b", re.IGNORECASE)


def slugify(title: str) -> str:
    text = unicodedata.normalize("NFKD", title)
    text = text.encode("ascii", "ignore").decode("ascii").lower()
    text = re.sub(r"\(.*?\)", " ", text)
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text[:48].strip("-")


def clean_name(title: str) -> str:
    """The Cookbook's page title, minus its parenthetical and its edition.

    The Cookbook numbers competing recipes for the same dish - "Focaccia I",
    "Focaccia II", "Pesto I", "Corn Chowder I". The number is an editorial
    detail about the wiki, not part of the dish, and a library showing both
    Focaccia I and Focaccia II looks broken.
    """
    name = re.sub(r"\s*\([^)]*\)\s*$", "", title).strip()
    name = re.sub(r"\s+(?:[IVX]{1,4}|\d{1,2})$", "", name).strip()
    return name or title


def dish_key(title: str) -> str:
    """What makes two pages the same dish, for de-duplication.

    Page titles alone are not enough: "Boeuf Bourguignon" and the curated
    "Beef Bourguignon" are one dish under two spellings, and "Pork Gyoza" is
    the gyoza already in the library.
    """
    text = unicodedata.normalize("NFKD", clean_name(title))
    text = text.encode("ascii", "ignore").decode("ascii").lower()
    text = re.sub(r"\b(recipe|homemade|classic|traditional|easy|simple|basic|"
                  r"authentic|best|quick|style)\b", " ", text)
    # Anglicisations of the same dish, so one spelling does not slip past the
    # other. Only the pairs the corpus actually collides on.
    for pattern, canonical in (
        (r"\bboeuf\b", "beef"), (r"\bbouef\b", "beef"), (r"\bpoulet\b", "chicken"),
        (r"\bpollo\b", "chicken"), (r"\bpescado\b", "fish"),
        (r"\bpotstickers?\b", "gyoza"), (r"\bjiaozi\b", "gyoza"),
        (r"\bpommes frites\b", "chips"), (r"\baubergine\b", "eggplant"),
        (r"\bcourgette\b", "zucchini"), (r"\bprawns?\b", "shrimp"),
    ):
        text = re.sub(pattern, canonical, text)
    words = [w for w in re.findall(r"[a-z]+", text) if len(w) > 2]
    # Two keys, because neither catches everything on its own. The sorted one
    # matches "Beef Bourguignon" to "Bourguignon Beef"; the run-together one
    # matches "Corn Bread" to "Cornbread", which the sorted one reads as two
    # different dishes.
    return " ".join(sorted(words)) + "|" + "".join(words)


def dish_keys(title: str) -> set[str]:
    both = dish_key(title).split("|")
    return {k for k in both if k}


def estimate_slot(name: str, index_slot: str | None) -> str:
    """The meal slot, from the Cookbook's course category or the dish's name.

    The category wins, with one exception. The Cookbook files a great deal
    under Side dish and Appetizer that is plainly a main course - risotto and
    ravioli both arrived as snacks - so when the category says snack and the
    name says otherwise, the name wins. A risotto scheduled as a snack is a
    day short of a dinner.
    """
    from_name = None
    for pattern, slot in SLOT_WORDS:
        if re.search(pattern, name, re.IGNORECASE):
            from_name = slot
            break

    if index_slot and not (index_slot == "snack" and from_name in ("dinner", "lunch")):
        return index_slot
    return from_name or index_slot or "dinner"


def estimate_minutes(recipe, steps: int) -> tuple[int, str]:
    stated = wikimedia.parse_minutes((recipe.meta or {}).get("time", ""))
    if stated:
        return max(5, min(stated, 480)), "cookbook"
    text = " ".join(recipe.instructions)
    base = 12 + 4 * steps
    if LONG_COOK.search(text):
        base += 45
    return max(10, min(base, 240)), "estimated"


def estimate_difficulty(recipe, ingredients: int, steps: int,
                        graded: int | None = None) -> tuple[int, str]:
    # The Cookbook's own grade first. It files that as a category rather than
    # in the infobox, whose Difficulty row is empty on every page checked.
    if graded:
        return graded, "cookbook"
    stated = wikimedia.parse_difficulty((recipe.meta or {}).get("difficulty", ""))
    if stated:
        return stated, "cookbook"
    score = 1
    if ingredients > 7 or steps > 5:
        score = 2
    if ingredients > 11 or steps > 8:
        score = 3
    if ingredients > 15 or steps > 12:
        score = 4
    return score, "estimated"


def weigh(lines: list[str]) -> tuple[int, float]:
    """How many lines parse, and what they weigh in total."""
    count = 0
    grams = 0.0
    for line in lines:
        measured = parse_line(line)
        if measured is None:
            continue
        count += 1
        grams += measured.grams if measured.basis != "unquantified" else measured.grams * 4
    return count, grams


def resolve(title: str, recipe, cuisine_known: bool):
    """The dish's Wikipedia article and a Commons photograph for it.

    A photograph is not negotiable - the library does not ship a recipe
    without one - and it may come from either page, with the Cookbook's own
    winning because it is a picture of this recipe rather than of the dish in
    general.

    The article is required only when nothing else has said whose food this
    is. Two thirds of the Cookbook's recipes are in no origin category, so
    the article's categories are the only honest answer for them; where the
    Cookbook has already said, a page with a picture and no encyclopaedia
    entry is still a perfectly good regional recipe.
    """
    page = wikimedia.wikipedia_page(clean_name(title))
    if page is None:
        if cuisine_known and recipe.image_file:
            return recipe.image_file, None
        return None
    image = recipe.image_file or page.image_file
    if not image:
        return None
    return image, page


# Wikipedia's own category names, which say whose food a dish is for the two
# thirds of the Cookbook that never said.
def cuisine_from_categories(categories) -> str | None:
    text = " ; ".join(categories)
    for pattern, cuisine in CUISINE_FROM_TEXT:
        if re.search(pattern, text, re.IGNORECASE):
            return cuisine
    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", type=int, default=400,
                        help="how many new recipes to find")
    parser.add_argument("--limit", type=int, default=0,
                        help="stop after examining N candidates")
    args = parser.parse_args()

    tree = cookbook_index.build()
    by_cuisine = cookbook_index.cuisine_of(tree)
    by_slot = cookbook_index.slot_of(tree)
    by_difficulty = cookbook_index.difficulty_of(tree)
    with_images = set(tree.get("Recipes with images", []))
    everything = tree.get("Recipes", [])

    # Already in the curated hundred, by page title and by slug.
    taken_titles = {s.wikibooks for s in SOURCES if s.wikibooks}
    taken_slugs = set(BY_SLUG)
    taken_dishes: set[str] = set()
    for source in SOURCES:
        taken_dishes |= dish_keys(source.name)
        if source.wikibooks:
            taken_dishes |= dish_keys(source.wikibooks)
    held = Counter(s.cuisine for s in SOURCES)

    # Focus cuisines first, then anything else with a picture, then the rest.
    # Within each band the pages that already have a photograph come first,
    # because those need one fetch rather than two and never get dropped for
    # want of an image.
    def rank(page: str) -> tuple:
        cuisine = by_cuisine.get(page)
        band = 0 if cuisine in FOCUS else (1 if cuisine else 2)
        return (band, 0 if page in with_images else 1, page)

    candidates = sorted(
        (p for p in everything if p not in taken_titles), key=rank)

    # Warm the cache before the sequential pass. The pass has to run in order
    # because the cuisine quotas depend on it, but it does not have to wait in
    # order, and one round trip at a time is what made the first attempt take
    # hours.
    horizon = min(len(candidates), max(args.target * 6, 600))
    print(f"prefetching {horizon} Cookbook pages", flush=True)
    wikimedia.prefetch(
        [wikimedia._page_url(wikimedia.WIKIBOOKS, t) for t in candidates[:horizon]],
        "cookbook")

    found: list[dict] = []
    seen_slugs = set(taken_slugs)
    seen_dishes = set(taken_dishes)
    seen_images: set[str] = set()
    counts = Counter()
    rejected = Counter()

    # Two passes over the same candidates. The first takes only the five the
    # brief is about, the second fills the rest of the quota with everything
    # else. One pass cannot do this: a dish's cuisine is often not known until
    # its Wikipedia article has been read, by which point a single ordered
    # pass has already spent the quota on whatever came first alphabetically.
    # The second pass is nearly free - every page it looks at is cached.
    examined = 0
    for focus_only in (True, False):
        print(f"\npass {'1: the five' if focus_only else '2: the scattering'}",
              flush=True)
        examined += run_pass(
            candidates, focus_only=focus_only, args=args, found=found,
            by_cuisine=by_cuisine, by_slot=by_slot, by_difficulty=by_difficulty,
            held=held, counts=counts,
            rejected=rejected, seen_slugs=seen_slugs, seen_dishes=seen_dishes,
            seen_images=seen_images)
    index = examined
    return report(found, index, rejected, counts, held, args)


def run_pass(candidates, *, focus_only, args, found, by_cuisine, by_slot,
             by_difficulty, held, counts, rejected, seen_slugs, seen_dishes,
             seen_images) -> int:
    for index, title in enumerate(candidates, 1):
        if len(found) >= args.target:
            break
        if args.limit and index > args.limit:
            break

        # Against the cleaned name, not the raw title: "Dashi (Japanese Soup
        # Stock)" is a stock, and the anchors in these patterns cannot see past
        # the Cookbook's disambiguating parenthetical.
        name = clean_name(title)
        if title in EXCLUDE_TITLES or name in EXCLUDE_TITLES:
            rejected["not a recipe"] += 1
            continue
        if (NOT_A_MEAL.search(name) or NOT_A_DISH_TITLE.search(name)
                or A_COMPONENT.search(name) or NOT_A_MEAL.search(title)):
            rejected["not a meal"] += 1
            continue

        slug = slugify(name)
        keys = dish_keys(title)
        if not slug or slug in seen_slugs or keys & seen_dishes:
            rejected["duplicate dish"] += 1
            continue

        cuisine = by_cuisine.get(title)
        # Cheap pre-filter: if the category tree already says this is a cuisine
        # that is full, do not spend a fetch on it.
        if cuisine and held[cuisine] + counts[cuisine] >= CAPS.get(cuisine, 0):
            rejected["cuisine full"] += 1
            continue

        recipe = wikimedia.cookbook_recipe(title)
        if recipe is None:
            rejected["no recipe"] += 1
            continue

        if cuisine is None:
            cuisine = cuisine_from_page(recipe)

        # The cheap checks first: they need no further fetch, and there is no
        # point asking Wikipedia about a page that is four lines long.
        parsed, grams = weigh(recipe.ingredients)
        steps = len([s for s in recipe.instructions if len(s) > 12])
        if parsed < MIN_INGREDIENTS or steps < MIN_STEPS:
            rejected["too thin"] += 1
            continue

        servings = wikimedia.parse_servings((recipe.meta or {}).get("servings", "")) or 4
        per_serving = grams / servings
        if not MIN_G_PER_SERVING <= per_serving <= MAX_G_PER_SERVING:
            rejected["not a portion"] += 1
            continue

        resolved = resolve(title, recipe, cuisine is not None)
        if resolved is None:
            rejected["no article or image"] += 1
            continue
        image, page = resolved

        # Whose food it is, in order of who actually knows: the Cookbook's own
        # origin category, then its Cuisine field, then the categories on the
        # dish's Wikipedia article.
        if cuisine is None and page is not None:
            cuisine = cuisine_from_categories(page.categories)
        if cuisine is None or cuisine not in CUISINE_LABELS:
            rejected["no cuisine"] += 1
            continue
        if focus_only and cuisine not in FOCUS:
            continue
        if held[cuisine] + counts[cuisine] >= CAPS.get(cuisine, 0):
            rejected["cuisine full"] += 1
            continue
        if image in seen_images:
            rejected["duplicate image"] += 1
            continue

        minutes, minutes_from = estimate_minutes(recipe, steps)
        difficulty, difficulty_from = estimate_difficulty(
            recipe, parsed, steps, by_difficulty.get(title))
        slot = estimate_slot(name, by_slot.get(title))
        # A loaf is not a meal, whatever category the Cookbook filed it under.
        # Breakfast is the one slot where bread on its own is the point.
        if A_BAKE.search(name) and slot != "breakfast":
            slot = "snack"

        found.append({
            "slug": slug,
            "name": name,
            "cuisine": cuisine,
            "slot": slot,
            "wikibooks": title,
            "wikipedia": name,
            "image_file": image,
            "minutes": minutes,
            "prep": max(5, min(minutes // 3, 60)),
            "servings": servings,
            "difficulty": difficulty,
            "equipment": recipe.equipment or [],
            "metadata_source": {"minutes": minutes_from, "difficulty": difficulty_from,
                                "servings": "cookbook" if (recipe.meta or {}).get("servings")
                                else "estimated"},
        })
        seen_slugs.add(slug)
        seen_dishes |= keys
        seen_images.add(image)
        counts[cuisine] += 1

        if len(found) % 25 == 0:
            print(f"  {len(found):4d} found, {index} examined", flush=True)
    return index


def report(found, index, rejected, counts, held, args) -> int:
    OUT.write_text(json.dumps(found, indent=1, ensure_ascii=False) + "\n",
                   encoding="utf-8")

    print(f"\n{len(found)} discovered, {index} candidates examined")
    print("\nrejected:")
    for reason, count in rejected.most_common():
        print(f"  {reason:<18} {count}")
    print("\nlibrary after merge:")
    for cuisine in CUISINE_LABELS:
        total = held[cuisine] + counts[cuisine]
        if total:
            mark = " *" if cuisine in FOCUS else ""
            print(f"  {cuisine:<18} {total:4d}  (+{counts[cuisine]}){mark}")
    print(f"\n  {'TOTAL':<18} {len(SOURCES) + len(found):4d}")
    print("\nslots:")
    slot_counts = Counter(s.slot for s in SOURCES) + Counter(r["slot"] for r in found)
    for slot, count in slot_counts.most_common():
        print(f"  {slot:<18} {count}")
    return 0


CUISINE_FROM_TEXT: list[tuple[str, str]] = [
    (r"\bjapan", "japanese"), (r"\bital|\bsicil|\btuscan", "italian"),
    (r"\bunited states|\bamerica|\bcajun|\bcreole|\bsouthern us|\btex.mex",
     "american"),
    (r"\bfrance\b|\bfrench\b|\bproven", "french"),
    (r"\bspain\b|\bspanish\b|\bcatal|\bbasque|\bvalencia|\bandalus", "spanish"),
    (r"\bchina\b|\bchinese\b|\bsichuan|\bcantonese|\btaiwan", "chinese"),
    (r"\bkorea", "korean"),
    (r"\bthai|\bvietnam|\bindonesi|\bmalaysi|\bfilipin|\bphilippin|\bsingapor",
     "southeast_asian"),
    (r"\bindia|\bpakistan|\bbangladesh|\bsri lanka|\bnepal", "south_asian"),
    (r"\bmexic", "mexican"),
    (r"\bleban|\bisrael|\bturk|\biran|\bpersia|\bsyria|\bjordan|\bmiddle east|"
     r"\bjewish|\barab", "middle_eastern"),
    (r"\bgreek|\bgreece|\bportug|\bmediterran", "mediterranean"),
    (r"\bbritain|\bbritish|\benglish|\bengland|\bscot|\birish|\bireland|\bwelsh|"
     r"\bwales", "british"),
    (r"\brussia|\bpoland|\bpolish|\bukrain|\bhungar|\bczech|\bromania|\bbulgar|"
     r"\bcroat|\bserbia", "eastern_european"),
    (r"\bgerman|\baustria|\bswiss|\bswitzerland|\bbavaria", "german"),
    (r"\bdutch|\bnetherlands|\bbelgi|\bsweden|\bswedish|\bnorway|\bnorwegian|"
     r"\bdenmark|\bdanish|\bfinland|\bfinnish|\bnordic|\bscandinav",
     "northern_european"),
    (r"\bnigeria|\bghana|\bethiopia|\bkenya|\bmorocc|\begypt|\bsouth africa|"
     r"\bafrica", "african"),
    (r"\bbrazil|\bargentin|\bperu|\bcolombia|\bchile\b|\bvenezuela", "latin_american"),
    (r"\bcuba|\bjamaica|\bcaribbean|\btrinidad|\bhaiti|\bpuerto ric", "caribbean"),
    (r"\bcanada|\bcanadian|\bquebec", "canadian"),
    (r"\bhawaii", "hawaiian"),
    (r"\baustralia|\bnew zealand|\bpacific", "oceanian"),
]


def cuisine_from_page(recipe) -> str | None:
    """Cuisine from the page's own Cuisine and Recipe origin fields."""
    meta = recipe.meta or {}
    text = " ".join(filter(None, [meta.get("cuisine"), meta.get("recipe origin"),
                                  meta.get("category")]))
    if not text:
        return None
    for pattern, cuisine in CUISINE_FROM_TEXT:
        if re.search(pattern, text, re.IGNORECASE):
            return cuisine
    return None


if __name__ == "__main__":
    raise SystemExit(main())
