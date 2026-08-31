"""Tests for the ingredient-line parser.

These are the lines the Cookbook actually writes, taken from the pages the
library scrapes. The weights they assert are what the grocery list buys and
what the FoodData Central panels get multiplied by, so a regression here is a
regression in every number the app shows.

Run: python -m pytest scripts/test_measures.py
"""

from __future__ import annotations

import pytest

from measures import Measured, parse, quantity_text


def g(line: str) -> float:
    measured = parse(line)
    assert measured is not None, line
    return measured.grams


def name(line: str) -> str:
    measured = parse(line)
    assert measured is not None, line
    return measured.name


# --- Mass: nothing to estimate ----------------------------------------------

def test_metric_mass_is_exact():
    assert g("450 g spaghetti") == 450.0
    assert g("1 kg potatoes") == 1000.0


def test_imperial_mass_converts():
    assert g("1 lb ground beef") == pytest.approx(453.6, abs=0.1)
    assert g("8 oz cream cheese") == pytest.approx(226.8, abs=0.1)


def test_metric_wins_over_the_parenthetical_imperial():
    # "450 g (1 pound) spaghetti" must not be read as 1 pound, and must not
    # double-count. The parenthetical is a restatement, not an addition.
    assert g("450 g (1 pound ) spaghetti") == 450.0
    assert name("450 g (1 pound ) spaghetti") == "spaghetti"


def test_range_takes_the_midpoint():
    assert g("225-500 g guanciale") == 362.5
    assert g("225–500 g (½–1 pound) guanciale or pancetta") == 362.5


# --- Volume: millilitres times a density ------------------------------------

def test_water_like_volumes_are_about_one_to_one():
    assert g("250 ml water") == 250.0
    assert g("1 cup milk") == pytest.approx(237.0, abs=1)


def test_oil_is_lighter_than_water():
    assert g("3 tablespoons olive oil") == pytest.approx(41.4, abs=0.5)


def test_grated_cheese_packs_loosely():
    # A cup of grated parmesan is about 95 g, not the 237 g water would give.
    assert g("1 cup grated Parmigiano-Reggiano cheese") == pytest.approx(94.8, abs=2)


def test_flour_is_not_water():
    assert g("1 cup all-purpose flour") == pytest.approx(125.6, abs=3)


def test_honey_is_denser_than_water():
    assert g("2 tablespoons honey") == pytest.approx(42.6, abs=1)


def test_a_teaspoon_of_dried_herb_is_about_a_gram():
    # The failure that made this module necessary: read as a count, this was
    # 100 g of oregano and put every plan over its vitamin K limit.
    assert g("1 teaspoon dried oregano") < 3.0
    assert g("1 tablespoon chopped fresh parsley") < 6.0


def test_a_teaspoon_of_salt_is_about_six_grams():
    assert g("1 teaspoon salt") == pytest.approx(6.0, abs=0.5)


# --- Count: a per-item weight ------------------------------------------------

def test_eggs():
    assert g("5 egg yolks") == 90.0
    assert g("2 eggs") == 110.0


def test_garlic_cloves_are_small():
    assert g("4 cloves of garlic, minced") == 20.0
    assert name("4 cloves of garlic, minced") == "garlic"


def test_bare_counts_use_the_item_weight():
    assert g("1 onion, sliced") == 150.0
    assert g("3 carrots") == 210.0


def test_bay_leaves_are_not_ninety_grams():
    assert g("2 bay leaves") == pytest.approx(0.4, abs=0.1)


def test_a_pinch_is_a_pinch():
    assert g("1 pinch of saffron") < 1.0


# --- Lines with no quantity --------------------------------------------------

def test_seasoning_to_taste_is_small_but_not_zero():
    measured = parse("Salt")
    assert measured is not None
    assert measured.quantity is None
    assert 0 < measured.grams < 5
    assert measured.basis == "to-taste"


def test_oil_for_frying_is_a_glug():
    assert 5 < g("Oil for frying") < 40


# --- Names -------------------------------------------------------------------

def test_preparation_is_stripped_from_the_name_not_the_label():
    # "minced" goes too: FoodData Central calls it "Beef, ground", and asking
    # for a food by a preparation it has never heard of gets whatever the
    # search ranks first - which for "scrubbed bearded mussels" was an oil.
    measured = parse("200 g (7 oz) minced beef, or pork")
    assert measured is not None
    assert measured.name == "beef"
    assert "or pork" in measured.label


def test_leading_preparation_words_go_too():
    assert name("3 quarts scrubbed, bearded mussels") == "mussels"
    assert name("400 g tinned chopped tomatoes") == "tinned chopped tomatoes"


def test_leading_articles_go():
    assert name("1 small piece of ginger") == "small piece of ginger" or \
        name("1 small piece of ginger").endswith("ginger")


# --- Non-ingredients ---------------------------------------------------------

@pytest.mark.parametrize("line", [
    "For the sauce",
    "To serve",
    "Notes",
    "Bring a big pot of water to a boil and add salt to taste when it begins to simmer.",
    "",
])
def test_rejects_lines_that_are_not_ingredients(line):
    assert parse(line) is None


# --- Printing back -----------------------------------------------------------

def test_quantity_text_reads_like_the_recipe():
    assert quantity_text(parse("450 g spaghetti")) == "450 g"
    assert quantity_text(parse("2 eggs")) == "2"
    assert quantity_text(parse("Salt")) == "to taste"


def test_everything_returns_a_positive_weight():
    lines = [
        "450 g (1 pound ) spaghetti",
        "225–500 g (½–1 pound) guanciale or pancetta",
        "5 egg yolks",
        "178 ml (¾ cup ) grated Pecorino Romano cheese",
        "3–4 tablespoons extra-virgin olive oil",
        "½ tablespoon freshly-ground pepper",
        "Salt",
        "1 onion , sliced",
        "1–2 tsp crushed dried chile pepper",
        "500 g (1 lb ) silken tofu , cubed",
        "2 tbsp chili bean paste (la doubanjiang)",
        "3–4 green onions , cut into 2 cm (1 inch) pieces",
    ]
    for line in lines:
        measured = parse(line)
        assert measured is not None, line
        assert measured.grams > 0, line
        assert measured.grams <= 3000, line


# --- Frying oil is a medium, not an ingredient -------------------------------

def test_a_litre_of_frying_oil_is_not_eaten():
    # Counted literally this is 920 g of fat in a dish for four, which would
    # dominate every nutrition figure the recipe reports.
    assert g("1 litre vegetable oil") == 35.0
    assert g("Vegetable oil, for deep-frying") == 35.0
    assert g("Oil for frying") == 35.0


def test_frying_rule_leaves_cooking_fat_alone():
    assert g("3 tablespoons olive oil") == pytest.approx(41.4, abs=0.5)
    assert g("1 tablespoon vegetable oil") == pytest.approx(13.8, abs=0.5)


def test_frying_medium_is_labelled_as_such():
    measured = parse("1 litre vegetable oil")
    assert measured is not None and measured.basis == "frying-medium"


# --- Gaps found while authoring the fallback recipes -------------------------

def test_whole_aromatics_are_not_ninety_grams():
    # Each of these arrives as a bare count. Without its own per-item weight a
    # single vanilla pod reads as most of a jar of vanilla.
    assert g("1 vanilla pod") < 8
    assert g("2 cinnamon sticks") < 8
    assert g("8 basil leaves") < 8
    assert g("1 parmesan rind") < 40


def test_a_leaf_is_a_leaf_whatever_kind():
    assert g("4 kaffir lime leaves") < 3
    assert g("6 lettuce leaves") == pytest.approx(84, abs=6)


def test_greasing_is_read_off_the_label_not_the_name():
    # PREP_TAIL strips ", for greasing" out of the name, so a lookup against
    # the name alone would never see the qualifier that makes this a smear.
    measured = parse("Butter, for greasing the pan")
    assert measured is not None
    assert measured.basis == "to-taste"
    assert 5 < measured.grams < 30


def test_peppercorns_are_priced_as_a_spice():
    from measures import density_for
    assert density_for("black peppercorns") == 0.50


# --- Telling an ingredient from a sentence about cooking ---------------------

@pytest.mark.parametrize("line", [
    "Do not over-mix the meat—the burger will be tough, dense, and dry.",
    "You can add a pat of butter or some cheese to the center of each burger.",
    "Hand-made burger patties change shape during cooking, with the edges shrinking.",
    "Let the meat get to room temperature before cooking.",
])
def test_cooking_advice_in_an_ingredient_list_is_not_an_ingredient(line):
    # The Cookbook hamburger page files nine of these under Ingredients.
    assert parse(line) is None


@pytest.mark.parametrize("line,expected_name", [
    ("1.5 liters (roughly 5¼ cups) beef stock (chicken or vegetable stock is an "
     "acceptable alternative)", "beef stock"),
    ("750 g (1½ lb ) skinless, boneless chicken , cut into chunks (use breast "
     "and/or leg meat)", "skinless"),
    ("6–8 kaffir lime leaves , torn into pieces (if unavailable, use the grated "
     "zest of 1 lime)", "kaffir lime leaves"),
])
def test_a_long_line_that_opens_with_a_quantity_is_still_an_ingredient(line, expected_name):
    measured = parse(line)
    assert measured is not None, line
    assert measured.grams > 0
    assert measured.name.startswith(expected_name)


# --- Choices and clauses collapse to one buyable thing -----------------------

@pytest.mark.parametrize("line,expected", [
    ("225 g guanciale or pancetta", "guanciale"),
    ("200 g minced/ground beef or lamb", "beef"),
    ("2 tablespoons butter or margarine", "butter"),
    ("1 kg chicken meat cut into 1-inch cubes", "chicken meat"),
    ("4 golden delicious apples cored and quartered", "golden delicious apples"),
    ("2 kaffir lime leaves torn into pieces", "kaffir lime leaves"),
])
def test_a_choice_resolves_to_its_first_option(line, expected):
    # A plan has to buy one of them, and no food is called "beef or lamb".
    assert name(line) == expected


@pytest.mark.parametrize("line", ["Aromatics", "Seasonings", "Toppings", "Marinade"])
def test_section_headings_are_not_ingredients(line):
    assert parse(line) is None


def test_a_line_that_cleans_down_to_punctuation_is_rejected():
    assert parse("- or olive oil") is None


# --- A source that gave no amount at all -------------------------------------

def test_an_unquantified_food_is_a_portion_not_a_pinch():
    # The Cookbook's Greek salad lists "Tomatoes", "Cucumber", "Red onion" with
    # no amounts. Read as a seasoning, a salad for four came out at 16 kcal a
    # serving. The figure returned here is per serving; the builder multiplies.
    measured = parse("Tomatoes")
    assert measured is not None
    assert measured.basis == "unquantified"
    assert measured.grams >= 30


def test_an_unquantified_rich_thing_is_a_smear_not_a_portion():
    # French toast lists butter, syrup, jam, cream and icing sugar with no
    # amounts. At a vegetable's portion each, breakfast for two came out at
    # 2,389 kcal a head.
    for line in ("Butter", "Maple syrup", "Jam", "Whipped cream"):
        measured = parse(line)
        assert measured is not None, line
        assert measured.basis == "unquantified", line
        assert measured.grams <= 20, line


def test_a_seasoning_with_no_amount_is_still_a_pinch():
    for line in ("Salt", "Ground black pepper", "Mixed herbs"):
        measured = parse(line)
        assert measured is not None, line
        assert measured.basis == "to-taste", line
        assert measured.grams < 5, line


# --- Bones are a medium, not an ingredient -----------------------------------

def test_stock_bones_are_mostly_not_eaten():
    # Counted whole, 1.2 kg of beef leg put pho at 3,400 kcal a serving.
    measured = parse("1.2 kg beef leg and marrow bones")
    assert measured is not None
    assert measured.basis == "stock-medium"
    assert measured.grams <= 60


def test_a_choice_between_adjectives_keeps_the_noun():
    # "skimmed or whole milk" is one ingredient with two adjectives, not two
    # ingredients. Taking the first option left "skimmed", which is not a food
    # and which FoodData Central answered with skimmed-milk yogurt.
    assert name("1½ quarts skimmed or whole milk, scalded") == "whole milk"
    assert name("500 g diced or grated tomatoes") == "tomatoes"
    # And the ordinary case still takes the first option.
    assert name("225 g guanciale or pancetta") == "guanciale"
