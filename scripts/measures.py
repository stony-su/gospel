"""Turn a written ingredient line into a quantity, a name and a weight in grams.

The Cookbook writes ingredients the way a cook says them - "450 g (1 pound)
spaghetti", "3-4 tablespoons extra-virgin olive oil", "4 cloves of garlic,
minced", "Salt". Gospel needs grams, because grams are what the grocery list
buys, the budget prices and the FoodData Central panels are stated per 100 g
of.

Three routes to a weight, in order of how much the source actually told us:

  mass    "450 g", "1 lb"          exact, nothing to estimate
  volume  "2 tbsp", "¾ cup"        millilitres times a density
  count   "4 cloves", "2 onions"   a per-item weight

Only the first is measurement. The other two are estimates and the tables
below are the assumptions, written down: DENSITY is grams per millilitre for
the forms an ingredient is actually measured in - grated cheese packs at 0.40,
not at the 1.0 that treating every volume as water would give - and COUNT_G is
one typical item.

Getting this wrong is not cosmetic. Dried herbs and spices are among the most
nutrient-dense foods by weight, so reading "1 teaspoon oregano" as 100 g puts
a plan thousands of percent over its vitamin K limit. The previous corpus did
exactly that.

Where the line gives both metric and imperial - "450 g (1 pound)" - the metric
figure outside the parentheses wins and the parenthetical is dropped. Where it
gives a range - "225-500 g" - the midpoint is used, because a plan has to
commit to one number and the midpoint is the least wrong single choice.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

# --- Vulgar fractions --------------------------------------------------------

FRACTIONS = {
    "¼": 0.25, "½": 0.5, "¾": 0.75, "⅐": 1 / 7, "⅑": 1 / 9, "⅒": 0.1,
    "⅓": 1 / 3, "⅔": 2 / 3, "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8,
    "⅙": 1 / 6, "⅚": 5 / 6, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
}

# Every dash-like character a recipe might use for a range.
DASHES = "‐‑‒–—―−"

# --- Units -------------------------------------------------------------------

MASS_G = {
    "g": 1.0, "gram": 1.0, "grams": 1.0, "gr": 1.0,
    "kg": 1000.0, "kilogram": 1000.0, "kilograms": 1000.0,
    "mg": 0.001,
    "oz": 28.35, "ounce": 28.35, "ounces": 28.35,
    "lb": 453.6, "lbs": 453.6, "pound": 453.6, "pounds": 453.6,
}

VOLUME_ML = {
    "ml": 1.0, "millilitre": 1.0, "millilitres": 1.0, "milliliter": 1.0,
    "milliliters": 1.0, "cc": 1.0,
    "l": 1000.0, "litre": 1000.0, "litres": 1000.0, "liter": 1000.0,
    "liters": 1000.0,
    "tsp": 5.0, "teaspoon": 5.0, "teaspoons": 5.0, "t": 5.0,
    "tbsp": 15.0, "tbs": 15.0, "tablespoon": 15.0, "tablespoons": 15.0,
    "dsp": 10.0, "dessertspoon": 10.0,
    "cup": 237.0, "cups": 237.0,
    "pint": 473.0, "pints": 473.0,
    "quart": 946.0, "quarts": 946.0,
    "gallon": 3785.0,
    "fl oz": 29.6, "fluid ounce": 29.6, "fluid ounces": 29.6,
}

# Units that count things rather than measure them. The value is a multiplier
# on the per-item weight, so a "clove" is resolved by COUNT_G and a "bunch" is
# roughly ten items of whatever it is a bunch of.
COUNT_UNITS = {
    "clove": 1.0, "cloves": 1.0,
    "piece": 1.0, "pieces": 1.0,
    "slice": 1.0, "slices": 1.0,
    "sprig": 0.2, "sprigs": 0.2,
    "stalk": 1.0, "stalks": 1.0, "stick": 1.0, "sticks": 1.0,
    "bunch": 8.0, "bunches": 8.0,
    "head": 6.0, "heads": 6.0,
    "can": 1.0, "cans": 1.0, "tin": 1.0, "tins": 1.0, "jar": 1.0,
    "packet": 1.0, "package": 1.0, "pack": 1.0,
    "sheet": 1.0, "sheets": 1.0,
    "fillet": 1.0, "fillets": 1.0,
    "rasher": 1.0, "rashers": 1.0,
    "leaf": 1.0, "leaves": 1.0,
    "pinch": 0.05, "pinches": 0.05, "dash": 0.05, "handful": 2.0,
    # "1/2-1 ea. lime" - "ea." for "each", which the Cookbook uses.
    "ea": 1.0, "each": 1.0,
}

# --- Density, grams per millilitre -------------------------------------------
# Keyed by a word in the ingredient name, most specific first. These are the
# forms recipes actually measure by volume, not the bulk material: "grated
# parmesan" is airy, "olive oil" is not.

DENSITY: list[tuple[str, float]] = [
    (r"\bhoney\b|\bmolasses\b|\bgolden syrup\b|\btreacle\b|\bcorn syrup\b", 1.42),
    (r"\bmaple syrup\b", 1.32),
    (r"\bsalt\b", 1.20),
    (r"\bsoy sauce\b|\bfish sauce\b|\btamari\b|\bmirin\b", 1.15),
    (r"\btomato paste\b|\bmiso\b|\btahini\b|\bbean paste\b|\bgochujang\b", 1.10),
    (r"\bcondensed milk\b|\bsour cream\b|\byogurt\b|\byoghurt\b", 1.05),
    (r"\bwater\b|\bstock\b|\bbroth\b|\bdashi\b|\bjuice\b|\bwine\b|\bvinegar\b"
     r"|\bmilk\b|\bcream\b|\bsake\b|\bbeer\b|\bpassata\b", 1.00),
    (r"\bbutter\b|\blard\b|\bshortening\b", 0.91),
    (r"\boil\b", 0.92),
    (r"\brice\b|\blentil|\bbarley\b|\bcouscous\b|\bquinoa\b|\bbulgur\b", 0.85),
    (r"\bbrown sugar\b", 0.93),
    (r"\bicing sugar\b|\bpowdered sugar\b|\bconfectioners\b", 0.56),
    (r"\bsugar\b", 0.85),
    (r"\bcocoa\b|\bcornstarch\b|\bcornflour\b|\bcorn starch\b", 0.45),
    (r"\bflour\b|\bcornmeal\b|\bpolenta\b|\bsemolina\b", 0.53),
    (r"\bbreadcrumb|\bpanko\b", 0.35),
    (r"\bgrated\b|\bshredded\b|\bparmesan\b|\bpecorino\b|\bcheese\b", 0.40),
    (r"\boat|\bcereal\b|\bcornflake", 0.40),
    (r"\bnut\b|\bnuts\b|\balmond|\bwalnut|\bpecan|\bcashew|\bpeanut|\bsesame", 0.55),
    # Herbs and spices before the generic preparation words: "chopped fresh
    # parsley" is a herb that happens to be chopped, and reading it at the
    # chopped-vegetable density makes a tablespoon twice its real weight.
    (r"\bherb|\bparsley\b|\bcilantro\b|\bcoriander leaf|\bbasil\b|\bthyme\b"
     r"|\boregano\b|\brosemary\b|\bdill\b|\bsage\b|\bmint\b|\bchives\b", 0.25),
    (r"\bpepper\b|\bpeppercorn|\bpaprika\b|\bcumin\b|\bcinnamon\b|\bturmeric\b"
     r"|\bcurry powder\b|\bspice\b|\bcayenne\b|\bchili powder\b|\bnutmeg\b"
     r"|\bcoriander\b", 0.50),
    (r"\bchopped\b|\bdiced\b|\bsliced\b|\bminced\b", 0.60),
]

DEFAULT_DENSITY = 0.70

# --- Per-item weights, grams -------------------------------------------------

COUNT_G: list[tuple[str, float]] = [
    (r"\bgarlic\b", 5.0),
    (r"\bbay lea|\bkaffir lime lea", 0.2),
    (r"\bstar anise\b|\bcardamom pod|\bpeppercorn|\bclove\b", 0.3),
    # Whole aromatics. Without their own row these fall to DEFAULT_COUNT_G and
    # a single vanilla pod is read as ninety grams of vanilla.
    (r"\bvanilla (pod|bean)", 4.0),
    (r"\bcinnamon stick|\bcassia bark", 2.5),
    (r"\bcurry lea|\bpandan lea", 0.3),
    # A bundle of herbs, tied, simmered and fished back out.
    (r"\bbouquet garni", 8.0),
    (r"\bdried (chilli|chili|chile)", 2.0),
    (r"\bsaffron\b", 0.05),
    (r"\bspring onion|\bgreen onion|\bscallion", 15.0),
    (r"\bshallot", 30.0),
    (r"\bchile|\bchilli|\bchili pepper|\bjalapeno|\bjalapeño|\bbird.s eye", 8.0),
    (r"\banchov", 4.0),
    (r"\bnori\b|\bseaweed\b", 3.0),
    (r"\begg yolk", 18.0),
    (r"\begg white", 33.0),
    (r"\begg", 55.0),
    (r"\bbacon\b|\brasher", 25.0),
    # A wingette is a joint, not a bird. At the ninety-gram default "48
    # chicken wingettes" came to four kilos, hit the parse guard, and put a
    # plate of wings at 1,885 kcal a serving.
    (r"\bwingette|\bdrumette|\bchicken wing", 30.0),
    (r"\bsausage", 60.0),
    (r"\btortilla|\bwrap\b", 40.0),
    (r"\bbread\b|\btoast\b|\bslice of bread", 35.0),
    (r"\bbun\b|\broll\b|\bbaguette\b|\bpita\b|\bnaan\b", 70.0),
    (r"\blasagne sheet|\bwonton|\bdumpling wrapper|\bgyoza wrapper", 8.0),
    (r"\bcelery\b", 40.0),
    (r"\bcarrot", 70.0),
    (r"\bonion", 150.0),
    (r"\bleek", 120.0),
    (r"\bpotato", 180.0),
    (r"\bsweet potato|\byam\b", 200.0),
    (r"\btomato", 120.0),
    (r"\bbell pepper|\bcapsicum|\bred pepper\b|\bgreen pepper\b", 160.0),
    (r"\bcucumber", 300.0),
    (r"\bcourgette|\bzucchini|\baubergine|\beggplant", 220.0),
    (r"\bmushroom", 20.0),
    (r"\blemons?\b|\blimes?\b", 85.0),
    (r"\boranges?\b", 150.0),
    (r"\bapples?\b|\bpears?\b", 180.0),
    (r"\bbanana", 120.0),
    (r"\bavocado|\bflatbread|\bpancake", 90.0),
    (r"\bginger\b", 15.0),
    (r"\blemongrass\b", 12.0),
    (r"\bchicken breast|\bchicken thigh|\bchicken fillet", 160.0),
    (r"\bchicken wing|\bdrumstick", 90.0),
    (r"\bpork chop|\bsteak\b|\bcutlet|\bfillet", 180.0),
    (r"\bprawn|\bshrimp", 15.0),
    (r"\bscallop|\bmussel|\bclam|\boyster", 12.0),
    (r"\bcan\b|\btin\b", 400.0),
    (r"\bsheet\b", 20.0),
    (r"\brind\b|\bzest\b", 20.0),
    # "8 basil leaves" does not put a unit where the parser looks for one, so
    # it arrives here as a bare count. Without these it is eight items at the
    # default weight - most of a kilo of basil.
    (r"\bbasil lea|\bsage lea|\bmint lea|\bshiso|\bcoriander lea|\bparsley lea", 0.5),
    (r"\blettuce lea|\bcabbage lea|\bvine lea|\bcollard", 14.0),
    (r"\blea(f|ves)\b", 1.0),
]

DEFAULT_COUNT_G = 90.0

# Lines with no quantity at all - "Salt", "Pepper to taste", "Oil for frying".
# A seasoning is real mass and real sodium, so it cannot be zero, but it is a
# pinch rather than a portion.
TO_TASTE_G: list[tuple[str, float]] = [
    # A tied bundle of herbs, simmered and fished back out.
    (r"\bbouquet garni\b", 8.0),
    (r"\bsalt\b|\bpepper\b|\bseasoning\b|\bspice\b|\bherb", 1.5),
    (r"\bgarnish\b|\bto serve\b|\bto taste\b", 5.0),
    (r"\bfor frying\b|\bfor deep.frying\b|\bfor greasing\b|\bfor dusting\b", 15.0),
    (r"\bwater\b", 250.0),
]

# A line with no quantity that is not a seasoning is not "a pinch of" - it is
# a component the source simply did not weigh. The Cookbook's Greek salad
# lists "Tomatoes", "Cucumber", "Red onion" and no amounts at all; read as
# eight grams each, a salad for four came out at 16 kcal a serving.
#
# These are per serving, and the builder multiplies by the recipe's serving
# count, because that is the one thing the source did say.
#
# One number for all of them does not work either. An unquantified line is a
# butter, a syrup or a jam about as often as it is a vegetable, and at seventy
# grams a serving those put French toast for two at 2,389 kcal each. What a
# cook actually puts on is a smear of the rich things and a portion of the
# plain ones, so the table splits on roughly that.
UNQUANTIFIED_G: list[tuple[str, float]] = [
    (r"\bwater\b|\bstock\b|\bbroth\b|\bdashi\b", 150.0),
    (r"\bbutter\b|\boil\b|\blard\b|\bcream\b|\bsyrup\b|\bhoney\b|\bjam\b"
     r"|\bsugar\b|\bsauce\b|\bdressing\b|\bmayonnaise\b|\bmustard\b|\bvinegar\b"
     r"|\bpaste\b|\bpickle|\brelish\b|\bzest\b|\bextract\b", 12.0),
    (r"\bcheese\b|\bparmesan\b|\bpecorino\b|\bnori\b|\bseaweed\b", 20.0),
    (r"\brice\b|\bpasta\b|\bnoodle|\bbread\b|\bpotato|\bflour\b|\btortilla", 60.0),
    (r"\bchicken\b|\bbeef\b|\bpork\b|\blamb\b|\bfish\b|\bprawn|\bshrimp\b"
     r"|\btofu\b|\begg\b|\beggs\b|\bbacon\b|\bsausage", 70.0),
]

# Everything else: a vegetable, a fruit, a leaf. A portion, not a garnish.
DEFAULT_UNQUANTIFIED_G = 45.0

# Bones go into the pot and come out of it. What a stock keeps is gelatin and
# fat, not the 1.2 kg of beef leg the recipe called for - counted whole, pho
# reported 3,400 kcal a serving.
STOCK_MEDIUM = re.compile(r"\bbones?\b|\bcarcass\b|\bmarrow bone", re.IGNORECASE)
STOCK_RETAINED_G = 60.0

# Oil a dish is fried *in* is a medium, not an ingredient. A recipe that says
# "1 litre vegetable oil for deep-frying" is describing the pan, and counting
# it would put nine hundred grams of fat into a portion of four. What the food
# actually keeps is roughly a tenth of its own weight, so the line is resolved
# to a plausible absorbed amount instead of the amount poured.
FRYING_MEDIUM = re.compile(
    r"\bfor (?:deep[- ]?|shallow[- ]?|pan[- ]?|stir[- ]?)?fry(?:ing)?\b"
    r"|\bfor the fryer\b|\bto deep[- ]?fry\b|\bfor frying\b", re.IGNORECASE)
FAT = re.compile(r"\boil\b|\blard\b|\bshortening\b|\bdripping\b|\btallow\b", re.IGNORECASE)
FRYING_ABSORBED_G = 35.0

# No domestic recipe eats this much fat, so a fat above it is a frying medium
# whether or not the line bothered to say so.
FRYING_IMPLIED_G = 400.0

# Preparation words that belong to the line but not to the ingredient's
# identity. Stripped from the name used for matching, kept in the label.
PREP_TAIL = re.compile(
    r"\s*,\s*(?:finely |roughly |thinly |coarsely |freshly )?"
    r"(?:chopped|minced|diced|sliced|grated|shredded|crushed|beaten|melted|"
    r"softened|peeled|deseeded|seeded|drained|rinsed|trimmed|cubed|julienned|"
    r"halved|quartered|torn|separated|divided|plus more.*|or .*|to taste.*|"
    r"optional.*|for .*)\s*$",
    re.IGNORECASE,
)

LEADING_NOISE = re.compile(
    r"^(?:about|approximately|approx\.?|roughly|around|a|an|some|of|each of|"
    r"per pound of|per lb of|per kg of|assorted)\s+", re.IGNORECASE
)

# A measurement of size rather than of amount: "1/2-inch cubed pork butt",
# "8-inch soft taco-size flour tortillas". It sits where the ingredient name
# should start, and the taxonomy turns the fraction into digits - which is how
# "1/2 tsp nutmeg" ends up as an ingredient called "1 2 tsp nutmeg".
DIMENSION = re.compile(
    r"^(?:[\d\s/" + "".join(FRACTIONS) + r"-]{1,8}"
    r"(?:inch|inches|in\.|cm|mm|centimetres?|centimeters?|millimetres?)\b[\s-]*)+",
    re.IGNORECASE,
)

# A line that is a heading or an instruction rather than an ingredient.
NOT_AN_INGREDIENT = re.compile(
    r"^(?:for the\b|to serve\b|to garnish\b|optional\b|note[s]?\b|"
    r"see also\b|ingredients?\b|equipment\b|variations?\b|"
    r"aromatics?$|seasonings?$|toppings?$|fillings?$|garnish(?:es)?$|"
    r"as needed$|as required$|to taste$|optional extras?$|"
    r"vegetables?$|spices?$|sauce$|marinade$|dressing$|batter$|dough$)",
    re.IGNORECASE,
)

# A recipe offering a choice - "guanciale or pancetta", "butter or margarine",
# "minced/ground beef or lamb" - is naming one ingredient with alternatives.
# The plan has to buy one of them, so it takes the first and drops the rest.
# Left whole, these become their own taxonomy entries and match nothing in
# FoodData Central, because no food is called "minced/ground beef or lamb".
#
# The two forms need different treatment. "or" separates whole alternatives,
# so everything after it goes. A slash usually separates two words for the
# same thing - "minced/ground beef" - so only the second word goes, or the
# noun they both modify would go with it.
OR_CHOICE = re.compile(r"\s+(?:or|and/or)\s+", re.IGNORECASE)
SLASH_CHOICE = re.compile(r"(\S+)\s*/\s*\S+")

PARTICIPLES = (
    r"cut|sliced|chopped|diced|torn|broken|halved|quartered|cored|peeled|"
    r"trimmed|shelled|deveined|julienned|grated|crushed|beaten|cleaned|"
    r"scrubbed|bearded|rinsed|drained|soaked|toasted|roasted|juiced|zested|"
    r"mixed|seasoned|flavored|flavoured|separated|crisped|bashed|baked|cubed|"
    r"shredded|minced|melted|softened|whisked|sifted"
)

# A participial clause describing what to do to the ingredient, written without
# the comma that PREP_TAIL keys on.
#
# The participle has to be doing the work of a verb, not an adjective, and word
# order is what tells them apart: "cut into chunks" and "cored and quartered"
# are clauses, but the "chopped" in "tinned chopped tomatoes" describes the
# tomatoes and the food noun comes after it. Stripping that one leaves
# "tinned", which is not a food and matches nothing in FoodData Central.
TRAILING_CLAUSE = re.compile(
    r"\s+(?:" + PARTICIPLES + r")"
    r"(?:\s+(?:into|in|to|as|for|with|on|off|and|until|from|over|through|"
    r"down|up|about|around|by|lengthwise|crosswise|thinly|finely|roughly)\b.*|$)"
    r"|\s+(?:such as|including|suitable for|preferably|to personal preference|"
    r"in diameter|to taste|with some|of personal choice|of your choice|"
    r"of choice)\b.*$",
    re.IGNORECASE,
)

# The same words in front of the food rather than behind it: "scrubbed,
# bearded mussels". Left in, the FoodData Central search is asked for a food
# by an adjective it has never heard of and answers with whatever it ranks
# first - which for that line was an oil, at eight hundred kcal per 100 g.
LEADING_PREP = re.compile(
    r"^(?:(?:freshly|finely|roughly|thinly|coarsely)\s+)?(?:" + PARTICIPLES + r")\b[,\s]+",
    re.IGNORECASE,
)

# Nothing but adjectives - no food in it at all.
ADJECTIVES_ONLY = re.compile(
    r"^(?:(?:" + PARTICIPLES + r"|freshly|finely|roughly|thinly|coarsely|large|"
    r"small|medium|whole|fresh|dried|dry|plain|fine|coarse|thin|thick|skimmed|"
    r"semi-skimmed|low-fat|full-fat|canned|tinned|frozen)[\s,]*)+$",
    re.IGNORECASE,
)


def _resolve_choice(name: str) -> str:
    """Pick one option out of "a or b".

    Usually the first: "guanciale or pancetta" is guanciale. But the two are
    sometimes adjectives sharing one noun - "skimmed or whole milk", "diced or
    grated tomatoes" - and taking the first there leaves "skimmed", which is
    not a food. When what precedes the "or" is nothing but adjectives, the
    noun is on the other side, so take that instead.
    """
    match = OR_CHOICE.search(name)
    if not match:
        return name
    head = name[: match.start()].strip()
    tail = name[match.end():].strip()
    if head and not ADJECTIVES_ONLY.match(head):
        return head
    return _resolve_choice(tail) if tail else head

# What is left after all that has to still look like a food.
LOOKS_LIKE_A_NAME = re.compile(r"[a-z]{3}", re.IGNORECASE)


@dataclass(frozen=True)
class Measured:
    """One ingredient line, resolved."""

    label: str
    """The line as written, tidied but not reinterpreted."""
    name: str
    """Just the ingredient, for taxonomy and FDC matching."""
    quantity: float | None
    unit: str | None
    grams: float
    basis: str
    """How the weight was reached: mass, volume, count or to-taste."""


def _clean(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    text = re.sub(r"\[\d+\]|\[note \d+\]", "", text)          # footnote markers
    text = re.sub(r"[" + DASHES + r"]", "-", text)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s+([,;:.])", r"\1", text)                 # scraped spacing
    return text.strip()


def _strip_parentheticals(text: str) -> str:
    """Drop "(1 pound)" and friends - the metric outside them is what we use."""
    previous = None
    while previous != text:
        previous = text
        text = re.sub(r"\s*\([^()]*\)", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _fraction_value(token: str) -> float | None:
    """A number, a fraction, a mixed number or a range - as one float."""
    token = token.strip()
    if not token:
        return None

    # Range: take the midpoint.
    if "-" in token[1:]:
        low, _, high = token[1:].partition("-")
        left = _fraction_value(token[0] + low)
        right = _fraction_value(high)
        if left is not None and right is not None:
            return (left + right) / 2
        return left if left is not None else right

    total = 0.0
    seen = False
    for part in token.split():
        if part in FRACTIONS:
            total += FRACTIONS[part]
            seen = True
            continue
        if match := re.fullmatch(r"(\d+)\s*/\s*(\d+)", part):
            total += int(match.group(1)) / int(match.group(2))
            seen = True
            continue
        if match := re.fullmatch(r"(\d+(?:\.\d+)?)([" + "".join(FRACTIONS) + r"])", part):
            total += float(match.group(1)) + FRACTIONS[match.group(2)]
            seen = True
            continue
        if re.fullmatch(r"\d+(?:\.\d+)?", part):
            total += float(part)
            seen = True
            continue
        return None
    return total if seen else None


_FRAC = "".join(FRACTIONS)

# One amount: a number, a vulgar fraction, a written fraction, or a number
# with either glued on - "3", "½", "1/2", "3½", "1 1/2".
_VALUE = (
    r"(?:\d+(?:\.\d+)?(?:\s*/\s*\d+)?(?:\s*[" + _FRAC + r"])?(?:\s+\d+\s*/\s*\d+)?"
    r"|[" + _FRAC + r"])"
)

# A range is two of those. Built this way round rather than as an optional
# tail on a bare number, because "3½-4 cups" has its dash after the fraction:
# consuming only "3½" left "-4 cups chicken broth" as the ingredient name.
QUANTITY_HEAD = re.compile(
    r"^(?P<qty>" + _VALUE + r"(?:\s*-\s*" + _VALUE + r")?)\s*"
)

# Size words sit between the amount and the unit often enough to matter:
# "4 large cloves of garlic" parsed as four items called "cloves of garlic",
# which FoodData Central answered with ground clove spice.
SIZE_WORDS = re.compile(
    r"^(?:large|small|medium|big|fat|whole|heaped|heaping|level|generous|"
    r"scant|ripe|good|rounded)\s+",
    re.IGNORECASE,
)

# "1/4 cup and 1 tablespoon palm sugar" states one amount as two. Stripping
# the conjunction lets the head-parse run again and take the second.
CONJOINED = re.compile(r"^(?:and|plus)\s+", re.IGNORECASE)

UNIT_WORDS = {**{u: "mass" for u in MASS_G},
              **{u: "volume" for u in VOLUME_ML},
              **{u: "count" for u in COUNT_UNITS}}

UNIT_HEAD = re.compile(
    r"^(?P<unit>fl\s*oz|fluid ounces?|" + "|".join(
        sorted((re.escape(u) for u in UNIT_WORDS if " " not in u), key=len, reverse=True)
    ) + r")\b\.?\s*(?:of\s+)?",
    re.IGNORECASE,
)


def _lookup(table: list[tuple[str, float]], name: str, default: float) -> float:
    for pattern, value in table:
        if re.search(pattern, name, re.IGNORECASE):
            return value
    return default


def density_for(name: str) -> float:
    return _lookup(DENSITY, name, DEFAULT_DENSITY)


def count_grams_for(name: str) -> float:
    return _lookup(COUNT_G, name, DEFAULT_COUNT_G)


# Words that belong to a sentence about cooking rather than to a thing being
# cooked. Cookbook pages routinely run their tips into the ingredient list -
# "Do not over-mix the meat, the burger will be tough" is a bullet under
# Ingredients on the hamburger page - and those are not ingredients.
PROSE = re.compile(
    r"\b(you|your|we|will|would|should|could|may|must|don't|because|however|"
    r"instead|prefer|recommend|usually|typically|often|note that|make sure)\b",
    re.IGNORECASE)

STARTS_QUANTIFIED = re.compile(r"^\s*(?:\d|[" + "".join(FRACTIONS) + r"])")

# An ingredient that opens with a quantity has earned some rope: "750 g
# skinless, boneless chicken, cut into chunks" is long and is still an
# ingredient. One that does not is either a short noun phrase or a sentence.
MAX_WORDS_QUANTIFIED = 18
MAX_WORDS_BARE = 8


def is_ingredient_line(line: str) -> bool:
    text = _clean(line)
    if len(text) < 2 or len(text) > 200:
        return False
    if PROSE.search(text):
        return False
    # Count words on what is left once the restated imperial measures and the
    # asides are gone, or "1.5 liters (roughly 5 1/4 cups) beef stock (chicken
    # or vegetable stock is an acceptable alternative)" reads as a sentence.
    core = _strip_parentheticals(text)
    # Headings are checked against the core too: "Aromatics (e.g. onion,
    # shallot, scallion, garlic)" is a heading wearing a parenthetical.
    if NOT_AN_INGREDIENT.match(text) or NOT_AN_INGREDIENT.match(core):
        return False
    words = core.count(" ") + 1
    limit = MAX_WORDS_QUANTIFIED if STARTS_QUANTIFIED.match(core) else MAX_WORDS_BARE
    return words <= limit


def parse(line: str) -> Measured | None:
    """Resolve one written ingredient line, or None if it is not one."""
    label = _clean(line)
    if not is_ingredient_line(label):
        return None

    text = _strip_parentheticals(label)
    # "~1 cup water" and "scant 1/2 cup olive oil" both hide the quantity
    # behind something that is not a number, so the head parse never sees it.
    text = re.sub(r"^[~≈]\s*", "", text)
    text = SIZE_WORDS.sub("", text)
    text = LEADING_NOISE.sub("", text)

    quantity: float | None = None
    unit: str | None = None
    kind: str | None = None

    # Twice, because a line can state one amount as two: "1/4 cup and 1
    # tablespoon palm sugar". The first pass takes the cup and the second the
    # tablespoon; only the first amount is kept, which understates that line by
    # a spoonful and is a great deal better than calling the ingredient "and 1
    # tablespoon palm sugar".
    for pass_number in range(2):
        if match := QUANTITY_HEAD.match(text):
            value = _fraction_value(match.group("qty"))
            if value is not None:
                if quantity is None:
                    quantity = value
                text = text[match.end():]

        text = SIZE_WORDS.sub("", text)

        if match := UNIT_HEAD.match(text):
            raw = re.sub(r"\s+", " ", match.group("unit").lower())
            if raw in UNIT_WORDS:
                if unit is None:
                    unit = raw
                    kind = UNIT_WORDS[raw]
                text = text[match.end():]

        if pass_number == 0:
            conjoined = CONJOINED.sub("", text)
            if conjoined == text:
                break
            text = conjoined

    name = LEADING_NOISE.sub("", PREP_TAIL.sub("", text)).strip(" ,;.")
    name = DIMENSION.sub("", name)
    name = _resolve_choice(name)
    name = SLASH_CHOICE.sub(r"\1", name)
    name = TRAILING_CLAUSE.sub("", name)
    # Repeatedly, because they stack: "scrubbed, bearded mussels".
    previous = None
    while previous != name:
        previous = name
        name = LEADING_PREP.sub("", name)
    name = re.sub(r"^of\s+", "", name, flags=re.IGNORECASE)
    # What survives a comma is a second thought about the first thing, so the
    # first thing is the ingredient: "red leaf lettuce, leaves" is lettuce.
    name = name.split(",")[0]
    # Scraped lines leave orphaned punctuation and stray measurement fragments
    # behind: "- or olive oil" becomes "-", "-sized tomatoes" becomes "-sized".
    name = re.sub(r"^[\s\-–—,;:.]+", "", name).strip(" ,;.-")
    if not name or not LOOKS_LIKE_A_NAME.search(name):
        return None

    if quantity is None:
        # Matched against the label, not the name: "Butter, for greasing" has
        # had its qualifier stripped out of the name by PREP_TAIL, and the
        # qualifier is the whole reason this line is a smear and not a portion.
        seasoning = _lookup(TO_TASTE_G, label, 0.0)
        if seasoning:
            grams = seasoning
            basis = "to-taste"
        else:
            grams = _lookup(UNQUANTIFIED_G, name, DEFAULT_UNQUANTIFIED_G)
            basis = "unquantified"
    elif kind == "mass":
        grams = quantity * MASS_G[unit]
        basis = "mass"
    elif kind == "volume":
        grams = quantity * VOLUME_ML[unit] * density_for(name)
        basis = "volume"
    elif kind == "count":
        grams = quantity * COUNT_UNITS[unit] * count_grams_for(name)
        basis = "count"
    else:
        grams = quantity * count_grams_for(name)
        basis = "count"

    if FAT.search(name) and (FRYING_MEDIUM.search(label) or grams >= FRYING_IMPLIED_G):
        grams = FRYING_ABSORBED_G
        basis = "frying-medium"
    elif STOCK_MEDIUM.search(name):
        grams = min(grams, STOCK_RETAINED_G)
        basis = "stock-medium"

    # Nothing in a domestic recipe weighs three kilos, and a parse that says so
    # is a parse that went wrong. Cap rather than propagate.
    grams = min(round(grams, 1), 3000.0)
    return Measured(label=label, name=name, quantity=quantity, unit=unit,
                    grams=grams, basis=basis)


def quantity_text(measured: Measured) -> str:
    """How to print the quantity back to the cook."""
    if measured.quantity is None:
        return "to taste"
    amount = measured.quantity
    shown = f"{amount:g}" if abs(amount - round(amount)) > 0.01 else f"{round(amount):d}"
    return f"{shown} {measured.unit}" if measured.unit else shown
