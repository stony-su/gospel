"""American dishes with no Cookbook recipe to scrape.

See scripts/authored/__init__.py for the format and why these exist.
"""

from __future__ import annotations

RECIPES: dict[str, dict] = {
    # Serves 6.
    "mac-and-cheese": {
        "ingredients": [
            "450 g macaroni",
            "60 g butter",
            "45 g plain flour",
            "750 ml whole milk",
            "400 g mature cheddar cheese, grated",
            "60 g parmesan cheese, grated",
            "1 teaspoon English mustard powder",
            "60 g panko breadcrumbs",
            "0.25 teaspoon grated nutmeg",
            "Salt",
            "Ground black pepper",
        ],
        "instructions": [
            "Heat the oven to 200 °C and bring a large pot of salted water to the boil.",
            "Cook the macaroni two minutes short of the time on the packet, so it "
            "finishes in the oven rather than going soft. Drain it.",
            "Melt the butter in a saucepan over a medium heat, stir in the flour and "
            "cook the roux for two minutes without letting it colour.",
            "Add the milk a splash at a time, whisking each addition smooth before "
            "the next, until you have a sauce the thickness of pouring cream.",
            "Take the pan off the heat and stir in the cheddar, the mustard powder "
            "and the nutmeg until the cheese has melted. Season.",
            "Fold the drained macaroni through the sauce and tip it into a baking dish.",
            "Mix the parmesan into the breadcrumbs, scatter them over the top and bake "
            "for 20 minutes, until the crust is brown and the sauce is bubbling at "
            "the edges.",
        ],
    },

    # Serves 4.
    "pancakes": {
        "ingredients": [
            "250 g plain flour",
            "2 tablespoons caster sugar",
            "2 teaspoons baking powder",
            "0.5 teaspoon bicarbonate of soda",
            "0.5 teaspoon salt",
            "2 eggs",
            "500 ml buttermilk",
            "50 g butter, melted",
            "1 tablespoon vegetable oil",
        ],
        "instructions": [
            "Whisk the flour, sugar, baking powder, bicarbonate of soda and salt "
            "together in a large bowl.",
            "Beat the eggs into the buttermilk in a second bowl, then stir in the "
            "melted butter.",
            "Pour the wet ingredients into the dry and fold them together until only "
            "just combined. The batter should still be lumpy; beating it smooth "
            "develops the gluten and makes the pancakes tough.",
            "Rest the batter for ten minutes while the pan heats.",
            "Wipe a griddle or heavy frying pan with the oil and set it over a medium "
            "heat. Ladle on rounds of batter, spaced apart.",
            "Cook until bubbles rise through the surface and the edges look set, about "
            "two minutes, then flip once and give them a further minute.",
            "Keep them warm in a low oven while you cook the rest.",
        ],
    },

    # Serves 4.
    "fried-shrimp": {
        "ingredients": [
            "600 g raw prawns, peeled and deveined",
            "120 g plain flour",
            "2 eggs",
            "150 g panko breadcrumbs",
            "1 teaspoon paprika",
            "0.5 teaspoon cayenne pepper",
            "1 lemon",
            "Vegetable oil, for deep-frying",
            "Salt",
            "Ground black pepper",
        ],
        "instructions": [
            "Pat the prawns thoroughly dry. Wet prawns steam inside the crumb instead "
            "of frying and the coating slides off.",
            "Set out three shallow bowls: the flour seasoned with the paprika, cayenne, "
            "salt and pepper; the eggs beaten; and the panko.",
            "Take each prawn through the three in order, pressing the crumbs on firmly, "
            "and set them on a wire rack.",
            "Heat the oil in a deep pan to 180 °C. A crumb dropped in should sizzle "
            "immediately and brown in about thirty seconds.",
            "Fry the prawns in batches of six or so for two to three minutes, until the "
            "crumb is deep gold. Crowding the pan drops the oil temperature and the "
            "coating goes greasy.",
            "Lift them onto the rack, salt them while they are still hot, and serve "
            "with the lemon cut into wedges.",
        ],
    },
}
