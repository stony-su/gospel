"""The hundred dishes Gospel cooks, and where each one comes from.

This is the whole editorial decision in one table. Everything downstream -
the scrape, the ingredient taxonomy, the FDC nutrition join, the images - is
mechanical once this list exists.

Two fields decide where a recipe's *method* comes from:

  ``wikibooks``   a Cookbook page whose Ingredients and Procedure sections
                  genuinely describe this dish. Scraped verbatim.
  ``None``        no such page exists, so the ingredients and method are
                  written in scripts/authored/ instead.

``wikipedia`` is separate and always present: it supplies the one-line
description and, more importantly, the photograph. Every dish here has a
Wikipedia article carrying a freely-licensed lead image, which is what lets
the library promise that no recipe ships without a picture.

Sources and licences
--------------------
en.wikibooks.org  Cookbook, CC BY-SA 4.0
en.wikipedia.org  CC BY-SA 4.0
commons.wikimedia.org  per-file; the builder records each photograph's own
                  licence and author and the app displays them.

NYT Cooking was asked for first and is deliberately absent: its robots.txt
disallows ``anthropic-ai`` and ``ClaudeBot`` outright and its terms prohibit
scraping, text-and-data-mining and dataset creation. Nothing here touches it.

The remaining metadata - times, servings, difficulty, equipment - is not
published by either source in any reliable form, so it is set here by hand.
These are cook's estimates, and the README says so.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Source:
    slug: str
    name: str
    cuisine: str
    slot: str
    wikipedia: str
    minutes: int
    prep: int
    servings: int
    difficulty: int
    equipment: tuple[str, ...]
    wikibooks: str | None = None
    image_file: str | None = None
    """Commons file to use instead of the article's lead image.

    The lead image of a Wikipedia article is usually the dish, but not always -
    the Poutine article leads with a photograph of a restaurant - and where it
    is a bad photograph of the right dish there is no heuristic that can tell.
    Naming the file is the only honest fix.
    """

    @property
    def authored(self) -> bool:
        return self.wikibooks is None


def R(slug, name, cuisine, slot, wikipedia, minutes, prep, servings, difficulty,
      equipment, wikibooks=None, image_file=None):
    return Source(slug, name, cuisine, slot, wikipedia, minutes, prep, servings,
                  difficulty, tuple(equipment), wikibooks, image_file)


# Cuisine ids and the labels the app shows. The five the library is built
# around come first; the rest are the scattering.
CUISINE_LABELS: dict[str, str] = {
    "japanese": "Japanese",
    "italian": "Italian",
    "american": "American",
    "french": "French",
    "spanish": "Spanish",
    "chinese": "Chinese",
    "korean": "Korean",
    "southeast_asian": "Southeast Asian",
    "south_asian": "South Asian",
    "mexican": "Mexican",
    "middle_eastern": "Middle Eastern",
    "mediterranean": "Mediterranean",
    "british": "British & Irish",
    "eastern_european": "Eastern European",
    "african": "African",
    "latin_american": "Latin American",
    "canadian": "Canadian",
    "hawaiian": "Hawaiian",
}

SOURCES: list[Source] = [
    # --- Japanese ------------------------------------------------------------
    R("ramen", "Ramen", "japanese", "dinner", "Ramen",
      45, 20, 2, 4, ["stockpot", "strainer", "ladle"]),
    R("japanese-curry", "Japanese Curry Rice", "japanese", "dinner", "Japanese curry",
      60, 20, 4, 2, ["heavy pot", "rice cooker"]),
    R("tonkatsu", "Tonkatsu", "japanese", "dinner", "Tonkatsu",
      35, 20, 4, 3, ["deep pan", "tongs", "wire rack"],
      wikibooks="Tonkatsu"),
    R("gyoza", "Gyoza Dumplings", "japanese", "dinner", "Jiaozi",
      70, 45, 4, 4, ["skillet with lid", "mixing bowl"],
      wikibooks="Gyoza"),
    R("onigiri", "Onigiri", "japanese", "snack", "Onigiri",
      25, 15, 4, 1, ["rice cooker", "bowl of water"],
      wikibooks="Onigiri"),
    R("miso-soup", "Miso Soup", "japanese", "breakfast", "Miso soup",
      15, 5, 4, 1, ["saucepan", "ladle"],
      wikibooks="Miso Soup"),
    R("okonomiyaki", "Okonomiyaki", "japanese", "dinner", "Okonomiyaki",
      35, 20, 2, 3, ["griddle", "spatula"],
      wikibooks="Okonomiyaki"),
    R("gyudon", "Gyudon", "japanese", "lunch", "Gyudon",
      25, 10, 2, 2, ["skillet", "rice cooker"],
      wikibooks="Gyudon"),
    R("sukiyaki", "Sukiyaki", "japanese", "dinner", "Sukiyaki",
      40, 25, 4, 3, ["shallow cast-iron pot", "portable burner"],
      wikibooks="Sukiyaki"),
    R("karaage", "Chicken Karaage", "japanese", "dinner", "Karaage",
      50, 35, 4, 3, ["deep pan", "wire rack", "thermometer"]),
    R("tamagoyaki", "Tamagoyaki", "japanese", "breakfast", "Tamagoyaki",
      15, 5, 2, 3, ["rectangular tamagoyaki pan", "chopsticks"]),
    R("yakitori", "Yakitori", "japanese", "dinner", "Yakitori",
      40, 25, 4, 3, ["bamboo skewers", "grill", "small saucepan"]),
    R("oyakodon", "Oyakodon", "japanese", "lunch", "Oyakodon",
      25, 10, 2, 2, ["small skillet", "rice cooker"]),
    # --- Italian -------------------------------------------------------------
    R("carbonara", "Spaghetti alla Carbonara", "italian", "dinner", "Carbonara",
      25, 10, 4, 3, ["large pot", "skillet", "mixing bowl"],
      wikibooks="Spaghetti alla Carbonara"),
    R("bolognese", "Spaghetti Bolognese", "italian", "dinner", "Bolognese sauce",
      150, 20, 6, 2, ["heavy pot", "large pot", "wooden spoon"],
      wikibooks="Bolognese Sauce"),
    R("aglio-e-olio", "Spaghetti Aglio e Olio", "italian", "dinner",
      "Spaghetti aglio e olio",
      20, 5, 4, 1, ["large pot", "skillet"],
      wikibooks="Spaghetti Aglio e Olio"),
    R("cacio-e-pepe", "Cacio e Pepe", "italian", "dinner", "Cacio e pepe",
      20, 5, 2, 3, ["large pot", "skillet", "grater"]),
    R("lasagne", "Lasagne al Forno", "italian", "dinner", "Lasagne",
      180, 45, 8, 4, ["baking dish", "heavy pot", "saucepan"]),
    R("pizza-margherita", "Pizza Margherita", "italian", "dinner",
      "Pizza Margherita",
      120, 30, 2, 3, ["baking stone", "mixing bowl", "peel"]),
    R("risotto-milanese", "Risotto alla Milanese", "italian", "dinner", "Risotto",
      40, 10, 4, 4, ["wide heavy pan", "ladle", "small saucepan"],
      wikibooks="Risotto alla Milanese"),
    R("pesto-genovese", "Trofie al Pesto", "italian", "dinner", "Pesto",
      25, 15, 4, 2, ["mortar and pestle", "large pot"]),
    R("puttanesca", "Spaghetti alla Puttanesca", "italian", "dinner",
      "Spaghetti alla puttanesca",
      30, 10, 4, 2, ["large pot", "skillet"],
      wikibooks="Spaghetti alla Puttanesca"),
    R("gnocchi", "Potato Gnocchi", "italian", "dinner", "Gnocchi",
      75, 45, 4, 4, ["large pot", "potato ricer", "board"]),
    R("minestrone", "Minestrone", "italian", "lunch", "Minestrone",
      60, 25, 6, 2, ["stockpot", "ladle"]),
    R("caprese", "Caprese Salad", "italian", "lunch", "Caprese salad",
      10, 10, 2, 1, ["knife", "platter"],
      wikibooks="Caprese Salad"),
    R("bruschetta", "Bruschetta", "italian", "snack", "Bruschetta",
      20, 15, 4, 1, ["grill pan", "bowl"],
      wikibooks="Bruschetta"),
    R("tiramisu", "Tiramisu", "italian", "snack", "Tiramisu",
      40, 30, 8, 3, ["mixing bowls", "dish", "whisk"],
      wikibooks="Tiramisu"),

    # --- American ------------------------------------------------------------
    R("bbq-ribs", "Barbecue Pork Ribs", "american", "dinner", "Pork ribs",
      240, 30, 4, 3, ["roasting pan", "grill", "basting brush"],
      wikibooks="Barbecue Ribs"),
    R("cheeseburger", "Cheeseburger", "american", "dinner", "Cheeseburger",
      30, 15, 4, 2, ["griddle", "spatula"],
      wikibooks="Hamburger"),
    R("mac-and-cheese", "Macaroni and Cheese", "american", "dinner",
      "Macaroni and cheese",
      45, 15, 6, 2, ["saucepan", "large pot", "baking dish"]),
    R("fried-chicken", "Fried Chicken", "american", "dinner", "Fried chicken",
      60, 30, 4, 3, ["deep pan", "wire rack", "thermometer"],
      wikibooks="Fried Chicken"),
    R("pancakes", "Buttermilk Pancakes", "american", "breakfast", "Pancake",
      25, 10, 4, 1, ["griddle", "mixing bowl", "ladle"]),
    R("scrambled-eggs", "Scrambled Eggs", "american", "breakfast",
      "Scrambled eggs",
      10, 3, 2, 1, ["nonstick skillet", "spatula", "bowl"],
      wikibooks="Scrambled Eggs"),
    R("grilled-cheese", "Grilled Cheese Sandwich", "american", "lunch",
      "Grilled cheese",
      12, 5, 1, 1, ["skillet", "spatula"],
      wikibooks="Grilled Cheese Sandwich"),
    R("blt", "BLT Sandwich", "american", "lunch", "BLT",
      15, 10, 1, 1, ["skillet", "toaster"],
      wikibooks="BLT Sandwich"),
    R("clam-chowder", "New England Clam Chowder", "american", "lunch",
      "Clam chowder",
      50, 20, 6, 3, ["stockpot", "ladle"],
      wikibooks="New England Clam Chowder"),
    R("buffalo-wings", "Buffalo Wings", "american", "snack", "Buffalo wing",
      45, 15, 4, 2, ["deep pan", "mixing bowl", "wire rack"],
      wikibooks="Buffalo Wings"),
    R("caesar-salad", "Caesar Salad", "american", "lunch", "Caesar salad",
      25, 20, 4, 2, ["salad bowl", "whisk", "baking sheet"],
      wikibooks="Caesar Salad"),
    R("jambalaya", "Jambalaya", "american", "dinner", "Jambalaya",
      70, 25, 6, 3, ["heavy pot", "wooden spoon"],
      wikibooks="Jambalaya"),
    R("fried-shrimp", "Fried Shrimp", "american", "dinner", "Fried shrimp",
      35, 20, 4, 2, ["deep pan", "wire rack", "shallow bowls"]),
    R("waffles", "Waffles", "american", "breakfast", "Waffle",
      30, 15, 4, 2, ["waffle iron", "mixing bowls", "whisk"],
      wikibooks="Waffles"),
    R("french-toast", "French Toast", "american", "breakfast", "French toast",
      20, 10, 2, 1, ["skillet", "shallow dish"],
      wikibooks="French Toast"),

    # --- French --------------------------------------------------------------
    R("crepes", "Crêpes", "french", "breakfast", "Crêpe",
      60, 10, 4, 2, ["crêpe pan", "ladle", "mixing bowl"]),
    R("coq-au-vin", "Coq au Vin", "french", "dinner", "Coq au vin",
      150, 30, 6, 4, ["Dutch oven", "skillet", "tongs"],
      wikibooks="Coq au Vin"),
    R("beef-bourguignon", "Beef Bourguignon", "french", "dinner",
      "Beef bourguignon",
      210, 40, 6, 4, ["Dutch oven", "skillet", "sieve"],
      wikibooks="Beef Bourguignon"),
    R("quiche-lorraine", "Quiche Lorraine", "french", "lunch", "Quiche",
      75, 30, 6, 3, ["tart tin", "skillet", "mixing bowl"],
      wikibooks="Quiche Lorraine"),
    R("french-onion-soup", "French Onion Soup", "french", "lunch",
      "French onion soup",
      90, 20, 4, 3, ["heavy pot", "oven-safe bowls", "ladle"],
      wikibooks="French Onion Soup"),
    R("croque-monsieur", "Croque Monsieur", "french", "lunch", "Croque monsieur",
      25, 15, 2, 2, ["saucepan", "baking sheet", "grater"],
      wikibooks="Croque Monsieur"),
    R("salade-nicoise", "Salade Niçoise", "french", "lunch", "Salade niçoise",
      35, 25, 4, 2, ["saucepan", "platter", "whisk"],
      wikibooks="Niçoise Salad"),
    R("bouillabaisse", "Bouillabaisse", "french", "dinner", "Bouillabaisse",
      90, 35, 10, 4, ["stockpot", "sieve", "mortar"],
      wikibooks="Bouillabaisse",
      image_file="15-12-13-Bouillabaisse-RalfR-N3S_3103.jpg"),
    R("cassoulet", "Cassoulet", "french", "dinner", "Cassoulet",
      240, 45, 8, 5, ["earthenware pot", "skillet", "large bowl"],
      wikibooks="Cassoulet"),
    R("gratin-dauphinois", "Gratin Dauphinois", "french", "dinner",
      "Gratin dauphinois",
      90, 20, 6, 2, ["gratin dish", "mandoline", "saucepan"]),
    R("moules-mariniere", "Moules Marinière", "french", "dinner",
      "Moules-frites",
      30, 15, 2, 2, ["large pot with lid", "colander"],
      wikibooks="Moules Mariniere"),
    R("french-omelette", "French Omelette", "french", "breakfast", "Omelette",
      10, 3, 1, 3, ["nonstick pan", "fork"],
      wikibooks="French Omelette",
      image_file="Blond_unbrowned_omelet_with_mushrooms_and_herbs.jpg"),
    R("tarte-tatin", "Tarte Tatin", "french", "snack", "Tarte Tatin",
      75, 30, 8, 4, ["oven-safe skillet", "rolling pin"],
      wikibooks="Tarte Tatin"),
    R("creme-brulee", "Crème Brûlée", "french", "snack", "Crème brûlée",
      180, 20, 6, 3, ["ramekins", "roasting tin", "blowtorch"]),
    # --- Spanish -------------------------------------------------------------
    R("paella", "Paella Valenciana", "spanish", "dinner", "Paella",
      70, 25, 6, 4, ["paella pan", "ladle"],
      wikibooks="Paella Valenciana"),
    R("tortilla-espanola", "Tortilla Española", "spanish", "lunch",
      "Spanish omelette",
      45, 15, 4, 3, ["skillet", "plate", "bowl"],
      wikibooks="Tortilla de Patatas"),
    R("gazpacho", "Gazpacho", "spanish", "lunch", "Gazpacho",
      20, 20, 4, 1, ["blender", "sieve"],
      wikibooks="Gazpacho"),
    R("salmorejo", "Salmorejo", "spanish", "lunch", "Salmorejo",
      20, 20, 4, 1, ["blender", "bowl"],
      wikibooks="Salmorejo"),
    R("patatas-bravas", "Patatas Bravas", "spanish", "snack", "Patatas bravas",
      45, 15, 4, 2, ["deep pan", "saucepan", "wire rack"]),
    R("gambas-al-ajillo", "Gambas al Ajillo", "spanish", "snack",
      "Gambas al ajillo",
      15, 10, 2, 1, ["earthenware dish", "skillet"],
      wikibooks="Gambas al Ajillo"),
    R("croquetas", "Croquetas de Jamón", "spanish", "snack", "Croquette",
      90, 40, 6, 4, ["saucepan", "deep pan", "shallow dish"]),
    R("pan-con-tomate", "Pan con Tomate", "spanish", "breakfast",
      "Pa amb tomàquet",
      10, 8, 2, 1, ["grill pan", "grater"]),
    R("fabada", "Fabada Asturiana", "spanish", "dinner", "Fabada asturiana",
      180, 20, 6, 2, ["heavy pot", "skimmer"]),
    R("albondigas", "Albóndigas en Salsa", "spanish", "dinner", "Meatball",
      75, 30, 4, 2, ["skillet", "saucepan", "mixing bowl"]),
    R("churros", "Churros", "spanish", "snack", "Churro",
      40, 20, 4, 3, ["deep pan", "piping bag", "saucepan"],
      wikibooks="Churros"),
    # --- The scattering ------------------------------------------------------
    R("poutine", "Poutine", "canadian", "dinner", "Poutine",
      50, 25, 2, 2, ["deep pan", "saucepan"],
      wikibooks="Poutine", image_file="Poutine.JPG"),
    R("mapo-tofu", "Mapo Tofu", "chinese", "dinner", "Mapo tofu",
      30, 15, 4, 2, ["wok", "spatula"],
      wikibooks="Mapo Tofu"),
    R("fried-rice", "Egg Fried Rice", "chinese", "lunch", "Fried rice",
      20, 10, 2, 1, ["wok", "spatula"],
      wikibooks="Fried Rice"),
    R("char-siu", "Char Siu", "chinese", "dinner", "Char siu",
      120, 25, 4, 3, ["roasting rack", "basting brush", "bowl"],
      wikibooks="Char Siu"),
    R("kung-pao-chicken", "Kung Pao Chicken", "chinese", "dinner",
      "Kung Pao chicken",
      35, 20, 4, 3, ["wok", "spatula", "small bowls"],
      wikibooks="Kung Pao Chicken"),
    R("congee", "Congee", "chinese", "breakfast", "Congee",
      90, 10, 4, 1, ["heavy pot", "ladle"],
      wikibooks="Congee"),
    R("galbi", "Galbi", "korean", "dinner", "Galbi",
      240, 30, 4, 3, ["grill", "shallow dish", "tongs"]),
    R("bibimbap", "Bibimbap", "korean", "lunch", "Bibimbap",
      60, 40, 4, 3, ["skillet", "rice cooker", "bowls"],
      wikibooks="Bibimbap"),
    R("pad-thai", "Pad Thai", "southeast_asian", "dinner", "Pad thai",
      35, 20, 2, 3, ["wok", "spatula", "bowl"],
      wikibooks="Pad Thai"),
    R("green-curry", "Thai Green Curry", "southeast_asian", "dinner",
      "Green curry",
      40, 20, 4, 2, ["wok", "saucepan"],
      wikibooks="Thai Green Curry"),
    R("pho", "Phở Bò", "southeast_asian", "lunch", "Pho",
      240, 30, 4, 4, ["stockpot", "skimmer", "strainer"]),
    # Authored rather than scraped. Cookbook:Bánh Mì lists five fillings -
    # bbq pork, bbq chicken, pâté, pork meatloaf, bbq beef - as alternatives,
    # with no amounts against any of them. Read as one recipe that is a
    # sandwich containing all five, and it came out at 1,712 kcal a serving.
    R("banh-mi", "Bánh Mì", "southeast_asian", "lunch", "Bánh mì",
      40, 30, 2, 2, ["bowl", "knife", "skillet"]),
    R("tikka-masala", "Chicken Tikka Masala", "south_asian", "dinner",
      "Chicken tikka masala",
      75, 35, 4, 3, ["skillet", "saucepan", "blender"],
      wikibooks="Chicken Tikka Masala"),
    R("butter-chicken", "Butter Chicken", "south_asian", "dinner",
      "Butter chicken",
      90, 30, 4, 3, ["heavy pan", "blender", "bowl"],
      wikibooks="Butter Chicken"),
    R("tacos-al-pastor", "Tacos", "mexican", "dinner", "Al pastor",
      45, 25, 4, 2, ["skillet", "griddle", "bowls"],
      wikibooks="Tacos"),
    R("guacamole", "Guacamole", "mexican", "snack", "Guacamole",
      15, 15, 4, 1, ["molcajete", "knife"],
      wikibooks="Guacamole"),
    R("quesadilla", "Quesadilla", "mexican", "lunch", "Quesadilla",
      15, 8, 2, 1, ["skillet", "spatula"],
      wikibooks="Quesadilla"),
    R("shakshuka", "Shakshouka", "middle_eastern", "breakfast", "Shakshouka",
      35, 12, 4, 2, ["skillet with lid", "wooden spoon"],
      wikibooks="Shakshouka"),
    R("shawarma", "Chicken Shawarma", "middle_eastern", "dinner", "Shawarma",
      90, 25, 4, 2, ["roasting tin", "bowl", "skewer"]),
    R("hummus", "Hummus", "middle_eastern", "snack", "Hummus",
      30, 15, 6, 1, ["food processor", "saucepan"]),
    R("falafel", "Falafel", "middle_eastern", "lunch", "Falafel",
      60, 40, 4, 3, ["food processor", "deep pan", "wire rack"],
      wikibooks="Falafel"),
    R("greek-salad", "Greek Salad", "mediterranean", "lunch", "Greek salad",
      15, 15, 4, 1, ["salad bowl", "knife"],
      wikibooks="Greek Salad"),
    R("moussaka", "Moussaka", "mediterranean", "dinner", "Moussaka",
      150, 45, 8, 4, ["baking dish", "skillet", "saucepan"],
      wikibooks="Greek Moussaka"),
    R("fish-and-chips", "Fish and Chips", "british", "dinner", "Fish and chips",
      60, 25, 4, 3, ["deep pan", "wire rack", "mixing bowl"],
      wikibooks="Fish and Chips"),
    R("shepherds-pie", "Shepherd's Pie", "british", "dinner", "Shepherd's pie",
      90, 30, 6, 2, ["skillet", "saucepan", "baking dish"],
      wikibooks="Shepherd's Pie"),
    R("full-english", "Full English Breakfast", "british", "breakfast",
      "Full breakfast",
      35, 10, 2, 2, ["large skillet", "grill", "saucepan"],
      wikibooks="English Breakfast"),
    R("porridge", "Porridge", "british", "breakfast", "Porridge",
      15, 2, 2, 1, ["saucepan", "wooden spoon"],
      wikibooks="Porridge"),
    R("borscht", "Borscht", "eastern_european", "lunch", "Borscht",
      100, 30, 6, 2, ["stockpot", "grater", "ladle"],
      wikibooks="Borscht"),
    R("goulash", "Goulash", "eastern_european", "dinner", "Goulash",
      150, 25, 6, 2, ["heavy pot", "wooden spoon"],
      wikibooks="Goulash"),
    R("jollof-rice", "Jollof Rice", "african", "dinner", "Jollof rice",
      70, 25, 6, 2, ["heavy pot", "blender"],
      wikibooks="Jollof Rice"),
    R("feijoada", "Feijoada", "latin_american", "dinner", "Feijoada",
      210, 30, 8, 3, ["heavy pot", "skillet", "bowl"],
      wikibooks="Feijoada"),
    R("empanadas", "Empanadas", "latin_american", "snack", "Empanada",
      90, 50, 12, 3, ["baking sheet", "skillet", "rolling pin"],
      wikibooks="Empanadas"),
    R("poke-bowl", "Poke Bowl", "hawaiian", "lunch", "Poke (dish)",
      25, 25, 2, 1, ["mixing bowl", "sharp knife"]),
]


BY_SLUG: dict[str, Source] = {source.slug: source for source in SOURCES}


def check() -> None:
    """Fail loudly on a spec that would build a broken library."""
    slugs = [s.slug for s in SOURCES]
    assert len(slugs) == len(set(slugs)), "duplicate slug"
    for source in SOURCES:
        assert source.cuisine in CUISINE_LABELS, f"{source.slug}: {source.cuisine}"
        assert source.slot in {"breakfast", "lunch", "dinner", "snack"}, source.slug
        assert 1 <= source.difficulty <= 5, source.slug
        assert source.prep <= source.minutes, source.slug
        assert source.servings >= 1, source.slug


if __name__ == "__main__":
    check()
    from collections import Counter

    print(f"{len(SOURCES)} dishes")
    print(f"  scraped  {sum(1 for s in SOURCES if not s.authored)}")
    print(f"  authored {sum(1 for s in SOURCES if s.authored)}")
    print("\ncuisine:")
    for cuisine, count in Counter(s.cuisine for s in SOURCES).most_common():
        print(f"  {cuisine:<18} {count}")
    print("\nslot:")
    for slot, count in Counter(s.slot for s in SOURCES).most_common():
        print(f"  {slot:<18} {count}")
    print("\nauthored, needing scripts/authored/:")
    for source in SOURCES:
        if source.authored:
            print(f"  {source.slug}")
