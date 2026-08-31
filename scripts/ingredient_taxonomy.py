"""Ingredient knowledge the recipe dataset does not carry.

The Food.com data names ingredients but says nothing about what they cost,
how long they keep, or what size you buy them in. Gospel needs all three:
cost drives the weekly budget constraint, shelf life and pack size drive the
adaptive grocery list (buy a 500 g tub of sour cream, use 60 g a week, and it
reappears on the list three weeks later).

Everything here is a documented estimate, not measured data. Prices are rough
2026 UK/US supermarket midpoints in GBP per kilogram or per litre. Shelf lives
are days from opening for perishables, days from purchase for dry goods.

Classification is pattern-based rather than an exhaustive dictionary: the
dataset has ~6900 distinct ingredient strings with a very long tail, so we
match on tokens and fall back to a category default. PATTERNS is ordered
most-specific-first and the first match wins.
"""

from __future__ import annotations

import re
import unicodedata

# --- Category defaults -------------------------------------------------------
# price_per_kg: GBP. shelf_life_days: after opening for perishables.
# pack_g: the smallest realistic supermarket unit.
# staple: bought once and topped up rarely, so it belongs in the one-time list.

CATEGORIES: dict[str, dict] = {
    "spice":          dict(aisle="Spices & Herbs",  price_per_kg=28.0, shelf_life_days=730, pack_g=40,   staple=True),
    "herb_dry":       dict(aisle="Spices & Herbs",  price_per_kg=45.0, shelf_life_days=550, pack_g=15,   staple=True),
    "baking_agent":   dict(aisle="Baking",          price_per_kg=6.0,  shelf_life_days=540, pack_g=200,  staple=True),
    "flour":          dict(aisle="Baking",          price_per_kg=1.4,  shelf_life_days=365, pack_g=1500, staple=True),
    "sugar":          dict(aisle="Baking",          price_per_kg=1.2,  shelf_life_days=730, pack_g=1000, staple=True),
    "sweetener":      dict(aisle="Baking",          price_per_kg=6.5,  shelf_life_days=730, pack_g=340,  staple=True),
    "oil":            dict(aisle="Oils & Vinegars", price_per_kg=6.0,  shelf_life_days=365, pack_g=750,  staple=True),
    "vinegar":        dict(aisle="Oils & Vinegars", price_per_kg=3.0,  shelf_life_days=730, pack_g=500,  staple=True),
    "condiment":      dict(aisle="Condiments",      price_per_kg=5.5,  shelf_life_days=180, pack_g=300,  staple=True),
    "chocolate":      dict(aisle="Baking",          price_per_kg=11.0, shelf_life_days=365, pack_g=200,  staple=False),
    "nut_seed":       dict(aisle="Baking",          price_per_kg=14.0, shelf_life_days=180, pack_g=200,  staple=False),

    "dairy_milk":     dict(aisle="Dairy",           price_per_kg=1.3,  shelf_life_days=7,   pack_g=1000, staple=False),
    "dairy_cream":    dict(aisle="Dairy",           price_per_kg=4.5,  shelf_life_days=10,  pack_g=300,  staple=False),
    "dairy_cultured": dict(aisle="Dairy",           price_per_kg=4.0,  shelf_life_days=21,  pack_g=300,  staple=False),
    "dairy_hard":     dict(aisle="Dairy",           price_per_kg=11.0, shelf_life_days=30,  pack_g=250,  staple=False),
    "butter":         dict(aisle="Dairy",           price_per_kg=8.0,  shelf_life_days=60,  pack_g=250,  staple=False),
    "egg":            dict(aisle="Dairy",           price_per_kg=4.5,  shelf_life_days=28,  pack_g=360,  staple=False),

    "meat_red":       dict(aisle="Meat & Fish",     price_per_kg=11.0, shelf_life_days=3,   pack_g=500,  staple=False),
    "meat_poultry":   dict(aisle="Meat & Fish",     price_per_kg=8.0,  shelf_life_days=3,   pack_g=500,  staple=False),
    "meat_cured":     dict(aisle="Meat & Fish",     price_per_kg=14.0, shelf_life_days=14,  pack_g=200,  staple=False),
    "seafood":        dict(aisle="Meat & Fish",     price_per_kg=18.0, shelf_life_days=2,   pack_g=250,  staple=False),

    "produce_veg":    dict(aisle="Produce",         price_per_kg=2.6,  shelf_life_days=10,  pack_g=500,  staple=False),
    "produce_leafy":  dict(aisle="Produce",         price_per_kg=6.0,  shelf_life_days=5,   pack_g=150,  staple=False),
    "produce_root":   dict(aisle="Produce",         price_per_kg=1.6,  shelf_life_days=30,  pack_g=1000, staple=False),
    "produce_fruit":  dict(aisle="Produce",         price_per_kg=3.0,  shelf_life_days=8,   pack_g=500,  staple=False),
    "herb_fresh":     dict(aisle="Produce",         price_per_kg=22.0, shelf_life_days=6,   pack_g=30,   staple=False),

    "grain":          dict(aisle="Dry Goods",       price_per_kg=2.2,  shelf_life_days=365, pack_g=1000, staple=True),
    "bread":          dict(aisle="Bakery",          price_per_kg=3.0,  shelf_life_days=5,   pack_g=800,  staple=False),
    "legume_dry":     dict(aisle="Dry Goods",       price_per_kg=2.8,  shelf_life_days=730, pack_g=500,  staple=True),
    "canned":         dict(aisle="Tins & Jars",     price_per_kg=2.2,  shelf_life_days=730, pack_g=400,  staple=False),
    "broth":          dict(aisle="Tins & Jars",     price_per_kg=1.8,  shelf_life_days=365, pack_g=500,  staple=True),
    "frozen":         dict(aisle="Frozen",          price_per_kg=3.2,  shelf_life_days=180, pack_g=500,  staple=False),
    "alcohol":        dict(aisle="Drinks",          price_per_kg=9.0,  shelf_life_days=90,  pack_g=750,  staple=False),
    "water":          dict(aisle="Free",            price_per_kg=0.0,  shelf_life_days=9999, pack_g=1000, staple=True),
    "other":          dict(aisle="Other",           price_per_kg=5.0,  shelf_life_days=90,  pack_g=300,  staple=False),
}

# --- Diet exclusion flags per category ---------------------------------------

MEAT_CATEGORIES = {"meat_red", "meat_poultry", "meat_cured", "seafood"}
ANIMAL_SECONDARY = {"dairy_milk", "dairy_cream", "dairy_cultured", "dairy_hard", "butter", "egg"}
DAIRY_CATEGORIES = {"dairy_milk", "dairy_cream", "dairy_cultured", "dairy_hard", "butter"}
GRAIN_CATEGORIES = {"grain", "flour", "bread"}
HIGH_CARB_CATEGORIES = {"sugar", "sweetener", "flour", "grain", "bread", "legume_dry", "chocolate"}
# Carnivore tolerates these non-animal items; everything else disqualifies.
CARNIVORE_TOLERATED = {"water", "spice"}

# --- Pattern table -----------------------------------------------------------
# Ordered most-specific-first. First match wins, so "peanut butter" must sit
# above both "peanut" and "butter", and "coconut milk" above "milk".

PATTERNS: list[tuple[str, str]] = [
    # Traps: compound names whose head noun would otherwise misclassify them.
    (r"\bpeanut butter\b", "nut_seed"),
    (r"\b(almond|cashew|soy|oat|rice|coconut) milk\b", "other"),
    (r"\bcoconut (oil|cream)\b", "oil"),
    (r"\bcocoa butter\b", "chocolate"),
    (r"\bbutter(milk)\b", "dairy_cultured"),
    (r"\bcream cheese\b", "dairy_cultured"),
    (r"\bsour cream\b", "dairy_cultured"),
    (r"\bwhipping cream\b|\bheavy cream\b|\bhalf-and-half\b|\bdouble cream\b", "dairy_cream"),
    (r"\bice cream\b", "frozen"),
    (r"\bcream of (mushroom|chicken|celery)\b", "canned"),
    (r"\bcondensed milk\b|\bevaporated milk\b", "canned"),
    (r"\bcoconut\b", "nut_seed"),
    (r"\bnutmeg\b", "spice"),
    (r"\bbay (leaf|leaves)\b", "herb_dry"),
    (r"\bvanilla\b", "spice"),
    (r"\bchicken (broth|stock|bouillon)\b|\bbeef (broth|stock)\b|\bvegetable (broth|stock)\b|\bbroth\b|\bstock\b", "broth"),
    (r"\btomato (sauce|paste|puree)\b|\bdiced tomatoes\b|\bcrushed tomatoes\b|\bcanned\b", "canned"),
    (r"\bsalsa\b|\bketchup\b|\bmayonnaise\b|\bmustard\b|\bsoy sauce\b|\bworcestershire\b|\btabasco\b|\bhot sauce\b|\bbbq sauce\b|\bbarbecue sauce\b|\bteriyaki\b|\bfish sauce\b|\bhoisin\b|\bsriracha\b|\bpesto\b|\brelish\b|\bhorseradish\b", "condiment"),
    (r"\bpowdered sugar\b|\bconfectioners'? sugar\b|\bicing sugar\b|\bbrown sugar\b|\bgranulated sugar\b|\bcaster sugar\b|\bsugar\b", "sugar"),
    (r"\bhoney\b|\bmaple syrup\b|\bmolasses\b|\bcorn syrup\b|\bagave\b|\bgolden syrup\b|\btreacle\b", "sweetener"),
    (r"\ball-purpose flour\b|\bflour\b|\bcornmeal\b|\bcornstarch\b|\bcorn starch\b|\bbreadcrumbs\b|\bbread crumbs\b", "flour"),
    (r"\bbaking (powder|soda)\b|\byeast\b|\bcream of tartar\b|\bgelatin\b", "baking_agent"),
    (r"\bchocolate\b|\bcocoa\b|\bcacao\b", "chocolate"),

    # Fats and acids. Rendered animal fats are fats, not meat: duck fat is
    # 900 kcal per 100 g, which is right for a fat and impossible for poultry.
    (r"\bduck fat\b|\bgoose fat\b|\bbeef dripping\b|\bbacon fat\b|\btallow\b|\bsuet\b", "oil"),
    (r"\bolive oil\b|\bvegetable oil\b|\bcanola oil\b|\bsesame oil\b|\bsunflower oil\b|\bpeanut oil\b|\bcooking spray\b|\blard\b|\bshortening\b|\boil\b", "oil"),
    # Starches and tortillas ahead of the produce patterns, or "potato starch"
    # is a root vegetable and "corn tortillas" are sweetcorn.
    (r"\bpotato starch\b|\bpotato flour\b|\btapioca\b|\barrowroot\b", "flour"),
    (r"\btortillas?\b|\btaco shells?\b", "bread"),
    (r"\bvinegar\b", "vinegar"),
    (r"\bmargarine\b|\bbutter\b", "butter"),

    # Dairy and eggs.
    (r"\b(parmesan|cheddar|mozzarella|monterey jack|swiss|feta|gruyere|romano|provolone|blue cheese|goat cheese|ricotta|cottage cheese)\b", "dairy_hard"),
    (r"\bcheese\b", "dairy_hard"),
    (r"\byogurt\b|\byoghurt\b|\bcreme fraiche\b", "dairy_cultured"),
    (r"\bmilk\b", "dairy_milk"),
    (r"\bcream\b", "dairy_cream"),
    (r"\begg\b|\beggs\b|\begg whites?\b|\begg yolks?\b", "egg"),

    # Proteins.
    (r"\bbacon\b|\bham\b|\bprosciutto\b|\bpancetta\b|\bpanceta\b|\bguanciale\b|\bsalami\b|\bpepperoni\b|\bchorizo\b|\bsausage\b|\bhot dog\b|\bsalt pork\b|\bmorcilla\b|\blardo\b|\bspeck\b", "meat_cured"),
    (r"\bchicken\b|\bturkey\b|\bduck\b|\bpoultry\b", "meat_poultry"),
    (r"\bbeef\b|\bsteak\b|\bpork\b|\blamb\b|\bveal\b|\bvenison\b|\bground round\b|\bbrisket\b|\bmince\b", "meat_red"),
    (r"\bshrimp\b|\bprawn\b|\bsalmon\b|\btuna\b|\bcod\b|\bhalibut\b|\btilapia\b|\bcrab\b|\blobster\b|\bscallop\b|\bclam\b|\bmussel\b|\banchov\w*\b|\bfish\b|\bsardine\b", "seafood"),
    (r"\btofu\b|\btempeh\b|\bseitan\b", "other"),

    # Produce.
    (r"\bfresh (parsley|cilantro|basil|thyme|rosemary|mint|dill|sage|oregano|chives|tarragon)\b", "herb_fresh"),
    (r"\b(parsley|cilantro|basil|thyme|rosemary|mint|dill|sage|oregano|chives|tarragon|marjoram)\b", "herb_dry"),
    (r"\b(cinnamon|paprika|cumin|turmeric|coriander|cardamom|clove|allspice|ginger|curry powder|chili powder|cayenne|peppercorn|pepper|salt|saffron|fennel seed|mustard seed|caraway|star anise|garam masala|old bay|italian seasoning|poultry seasoning|seasoning)\b", "spice"),
    (r"\b(potato|potatoes|sweet potato|yam|turnip|parsnip|beet|rutabaga)\b", "produce_root"),
    (r"\b(garlic|onion|onions|shallot|scallion|green onion|leek)\b", "produce_root"),
    (r"\b(lettuce|spinach|kale|arugula|cabbage|chard|romaine|watercress|bok choy)\b", "produce_leafy"),
    (r"\b(apple|banana|orange|lemon|lime|strawberr\w*|blueberr\w*|raspberr\w*|grape|peach|pear|pineapple|mango|melon|cherr\w*|cranberr\w*|raisin|date|apricot|plum|kiwi|avocado|coconut)\b", "produce_fruit"),
    (r"\b(tomato|tomatoes|carrot|celery|pepper|zucchini|squash|cucumber|mushroom|broccoli|cauliflower|asparagus|eggplant|corn|pea|peas|green bean|brussels sprout|okra|artichoke|radish)\b", "produce_veg"),

    # Dry goods.
    (r"\b(rice|pasta|spaghetti|macaroni|noodle|penne|linguine|couscous|quinoa|barley|oat|oats|oatmeal|bulgur|farro|polenta|tortilla|cereal)\b", "grain"),
    (r"\b(bread|baguette|roll|bun|pita|naan|croissant|biscuit|cracker)\b", "bread"),
    (r"\b(lentil|chickpea|garbanzo|black bean|kidney bean|pinto bean|navy bean|cannellini|split pea|bean|beans)\b", "legume_dry"),
    (r"\b(walnut|pecan|almond|cashew|pistachio|hazelnut|macadamia|pine nut|peanut|sesame seed|sunflower seed|pumpkin seed|flax|chia|poppy seed|nut|nuts)\b", "nut_seed"),

    # Everything else.
    (r"\bfrozen\b", "frozen"),
    (r"\bwine\b|\bbeer\b|\brum\b|\bbourbon\b|\bbrandy\b|\bvodka\b|\bsherry\b|\bwhiskey\b|\bliqueur\b", "alcohol"),
    (r"\bwater\b|\bice\b", "water"),
]

COMPILED = [(re.compile(pattern), category) for pattern, category in PATTERNS]

# --- Specific overrides ------------------------------------------------------
# Where a category default is meaningfully wrong for a very common ingredient.
# Keys match the normalised name exactly.

OVERRIDES: dict[str, dict] = {
    "salt":            dict(price_per_kg=0.9,  shelf_life_days=3650, pack_g=750,  staple=True),
    "water":           dict(price_per_kg=0.0,  shelf_life_days=9999, pack_g=1000, staple=True),
    "sour cream":      dict(price_per_kg=4.2,  shelf_life_days=21,   pack_g=300),
    "butter":          dict(price_per_kg=8.5,  shelf_life_days=60,   pack_g=250),
    "eggs":            dict(price_per_kg=4.5,  shelf_life_days=28,   pack_g=360),
    "olive oil":       dict(price_per_kg=9.0,  shelf_life_days=545,  pack_g=500),
    "extra virgin olive oil": dict(price_per_kg=12.0, shelf_life_days=545, pack_g=500),
    "parmesan cheese": dict(price_per_kg=22.0, shelf_life_days=45,   pack_g=200),
    "heavy cream":     dict(price_per_kg=5.5,  shelf_life_days=10,   pack_g=300),
    "cream cheese":    dict(price_per_kg=7.0,  shelf_life_days=21,   pack_g=200),
    "bacon":           dict(price_per_kg=12.0, shelf_life_days=10,   pack_g=250),
    "boneless skinless chicken breasts": dict(price_per_kg=9.5, shelf_life_days=3, pack_g=600),
    "ground beef":     dict(price_per_kg=9.0,  shelf_life_days=3,    pack_g=500),
    "shrimp":          dict(price_per_kg=22.0, shelf_life_days=2,    pack_g=250),
    "honey":           dict(price_per_kg=8.0,  shelf_life_days=1095, pack_g=340),
    "maple syrup":     dict(price_per_kg=16.0, shelf_life_days=365,  pack_g=250),
    "vanilla extract": dict(price_per_kg=180.0, shelf_life_days=1460, pack_g=60),
    "saffron":         dict(price_per_kg=4000.0, shelf_life_days=730, pack_g=1),
}

# --- Unit weights ------------------------------------------------------------
# Grams per "1 unit" when a recipe counts rather than weighs. Used to convert
# "2 onions" into a mass we can price and deplete.

UNIT_GRAMS: dict[str, float] = {
    "egg": 55, "eggs": 55, "onion": 150, "onions": 150, "garlic clove": 5,
    "garlic cloves": 5, "carrot": 70, "carrots": 70, "celery": 40,
    "potato": 200, "potatoes": 200, "tomato": 120, "tomatoes": 120,
    "apple": 180, "banana": 120, "bananas": 120, "lemon": 100, "lime": 70,
    "orange": 150, "bell pepper": 160, "green pepper": 160, "red bell pepper": 160,
    "zucchini": 200, "cucumber": 300, "shallot": 30, "shallots": 30,
    "green onion": 15, "green onions": 15, "scallions": 15, "bay leaf": 0.2,
    "bay leaves": 0.2, "chicken breasts": 180, "chicken breast": 180,
}

DEFAULT_UNIT_GRAMS = 100.0

# Volume measures to grams, using water density as the approximation. Fats and
# flours differ but not enough to change a shopping decision.
VOLUME_ML = {
    "cup": 237, "cups": 237, "tablespoon": 15, "tablespoons": 15, "tbsp": 15,
    "teaspoon": 5, "teaspoons": 5, "tsp": 5, "quart": 946, "quarts": 946,
    "pint": 473, "pints": 473, "ounce": 28.35, "ounces": 28.35, "oz": 28.35,
    "pound": 453.6, "pounds": 453.6, "lb": 453.6, "lbs": 453.6,
    "gram": 1, "grams": 1, "g": 1, "kg": 1000, "ml": 1, "liter": 1000,
    "litre": 1000, "l": 1000,
}

# Words stripped before matching, so "fresh ground black pepper" resolves the
# same way "pepper" does.
NOISE_WORDS = re.compile(
    r"\b(fresh|freshly|ground|chopped|minced|diced|sliced|shredded|grated|"
    r"crushed|whole|large|small|medium|extra|virgin|light|dark|low-fat|lowfat|"
    r"nonfat|fat-free|reduced|skim|unsalted|salted|boneless|skinless|lean|"
    r"cooked|uncooked|raw|dried|dry|frozen|canned|prepared|warm|cold|boiling|"
    r"hot|room temperature|softened|melted|firmly|packed|granulated|plain|"
    r"all-purpose|self-rising|instant|quick|fine|coarse|thin|thick|ripe|"
    r"unsweetened|sweetened|seedless|pitted|peeled|trimmed|rinsed|drained)\b",
    re.IGNORECASE,
)


def normalise(name: str) -> str:
    """Lowercase, strip punctuation and descriptive noise, collapse spaces."""
    text = name.lower().strip()
    # Fold accents to the letters underneath rather than deleting them.
    # Deleting turned "croutons" into "cro tons" and "jalapeno" into "jalape o",
    # neither of which is a food FoodData Central has ever heard of.
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^a-z0-9'\- ]+", " ", text)
    text = NOISE_WORDS.sub(" ", text)
    # Removing a noise word can leave the half of a compound that was attached
    # to it: "medium-sized tomatoes" loses "medium" and keeps "-sized". A
    # fragment like that is not a food, and searching FoodData Central for one
    # returns whatever it ranks first - rye flour, in that case.
    text = re.sub(r"[\s-]-?(?:sized|style|type|like)\b", " ", text)
    text = re.sub(r"(?:^|\s)-+|-+(?:\s|$)", " ", text)
    text = re.sub(r"\s+", " ", text).strip(" -")
    return text


def classify(name: str) -> str:
    """Return the category key for an ingredient name."""
    text = normalise(name)
    if not text:
        return "other"
    for pattern, category in COMPILED:
        if pattern.search(text):
            return category
    return "other"


def describe(name: str) -> dict:
    """Full record for an ingredient: category, aisle, price, shelf life, diet."""
    normalised = normalise(name) or name.lower().strip()
    category = classify(name)
    record = dict(CATEGORIES[category])
    record.update(OVERRIDES.get(normalised, {}))

    record["name"] = normalised
    record["display_name"] = name.strip()
    record["category"] = category
    record["unit_g"] = UNIT_GRAMS.get(normalised, DEFAULT_UNIT_GRAMS)

    record["excludes_vegan"] = category in MEAT_CATEGORIES or category in ANIMAL_SECONDARY
    record["excludes_vegetarian"] = category in MEAT_CATEGORIES
    record["excludes_paleo"] = category in GRAIN_CATEGORIES or category in DAIRY_CATEGORIES or category == "legume_dry"
    record["excludes_carnivore"] = not (
        category in MEAT_CATEGORIES
        or category in ANIMAL_SECONDARY
        or category in CARNIVORE_TOLERATED
    )
    record["high_carb"] = category in HIGH_CARB_CATEGORIES

    return record
