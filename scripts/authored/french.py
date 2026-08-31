"""French dishes with no Cookbook recipe to scrape.

See scripts/authored/__init__.py for the format and why these exist.
"""

from __future__ import annotations

RECIPES: dict[str, dict] = {
    # Serves 4, about twelve 20 cm crepes.
    "crepes": {
        "ingredients": [
            "250 g plain flour",
            "2 tablespoons caster sugar",
            "0.5 teaspoon salt",
            "3 eggs",
            "500 ml whole milk",
            "50 g butter, melted",
            "Butter, for greasing the pan",
        ],
        "instructions": [
            "Whisk the flour, sugar and salt together in a bowl and make a well "
            "in the middle.",
            "Break the eggs into the well with a splash of the milk and whisk, "
            "drawing the flour in from the sides a little at a time until you "
            "have a smooth thick paste. Lumps are easy to work out of a paste "
            "and impossible to work out of a thin batter.",
            "Whisk in the rest of the milk and then the melted butter. The "
            "batter should be about the consistency of single cream.",
            "Cover the bowl and leave the batter to rest for at least thirty "
            "minutes, or overnight in the fridge. Resting lets the flour "
            "hydrate fully and the gluten relax, which is what makes a crepe "
            "tender instead of rubbery and stops it shrinking in the pan.",
            "Set a crepe pan or a 20 cm frying pan over a medium-high heat and "
            "wipe it with butter on a piece of kitchen paper. It is hot enough "
            "when a drop of batter sets on contact.",
            "Lift the pan off the heat, pour in a small ladleful of batter, "
            "about 60 ml, and swirl it immediately so it runs to a thin even "
            "layer over the whole base. Tip any excess back into the bowl.",
            "Cook for about a minute, until the edge lifts and the underside is "
            "lacy and brown, then flip it and give the second side twenty or "
            "thirty seconds.",
            "Stack the crepes on a warm plate as they come off. Loosen the "
            "batter with a splash of milk if it thickens as it stands.",
        ],
    },

    # Serves 6.
    "gratin-dauphinois": {
        "ingredients": [
            "1.2 kg waxy potatoes, thinly sliced",
            "500 ml whole milk",
            "300 ml double cream",
            "3 cloves garlic",
            "30 g butter",
            "0.25 teaspoon grated nutmeg",
            "Salt",
            "Ground black pepper",
        ],
        "instructions": [
            "Heat the oven to 150 °C. Halve one garlic clove and rub the cut "
            "faces over the inside of a gratin dish, then butter the dish "
            "generously with half the butter.",
            "Peel the potatoes and slice them 2 to 3 mm thick, on a mandoline "
            "if you have one, so they all cook at the same rate.",
            "Do not rinse the slices. The starch clinging to them is what "
            "thickens the milk and cream into a sauce as the gratin bakes, and "
            "washing it off leaves a dish swimming in thin liquid.",
            "Crush the remaining garlic into a saucepan with the milk, the "
            "cream and the nutmeg. Season well with salt and pepper and bring "
            "it just to a simmer, then take it off the heat.",
            "Layer the potato slices into the dish in overlapping rows, "
            "seasoning lightly every few layers, and press them down flat.",
            "Pour the hot milk and cream over. It should come level with the "
            "top layer rather than cover it, so the surface browns while "
            "everything underneath poaches.",
            "Dot the rest of the butter over the top and bake for about an "
            "hour, until the top is blistered and gold and a knife slides "
            "through the middle without resistance. Give it another ten "
            "minutes if it does not.",
            "Let the gratin stand for ten minutes before serving. Straight out "
            "of the oven the cream is still loose; it sets into the potatoes as "
            "it cools.",
        ],
    },

    # Serves 6, in ramekins of about 150 ml.
    "creme-brulee": {
        "ingredients": [
            "600 ml double cream",
            "2 teaspoons vanilla extract",
            "6 egg yolks",
            "100 g caster sugar",
            "50 g demerara sugar, for the tops",
        ],
        "instructions": [
            "Heat the oven to 150 °C and stand six ramekins in a deep roasting "
            "tin.",
            "Warm the cream with the vanilla in a saucepan until it steams and "
            "the surface just begins to tremble, then take it off the heat.",
            "Whisk the egg yolks with the caster sugar until they are pale and "
            "the sugar has dissolved, but no further. Whisking air in gives a "
            "custard full of bubbles.",
            "Pour the hot cream onto the yolks in a thin stream, whisking all "
            "the time. Adding it slowly brings the yolks up to temperature "
            "gradually; tipped in at once, or boiled, they scramble.",
            "Strain the custard through a fine sieve into a jug and skim off "
            "any foam, then divide it between the ramekins.",
            "Pour just-boiled water into the roasting tin until it comes "
            "halfway up the sides of the ramekins. The water holds the custard "
            "near 100 °C and no higher, which is what keeps it silky rather "
            "than curdled and weeping.",
            "Bake for 30 to 35 minutes. They are done when the custards are set "
            "at the edge and still wobble like jelly in the middle; they firm "
            "up as they cool.",
            "Lift the ramekins out of the water, cool them to room temperature "
            "and then chill for at least two hours.",
            "Just before serving, blot any condensation off the tops, sprinkle "
            "each one with an even layer of demerara and melt it with a "
            "blowtorch until it bubbles and darkens to amber.",
            "Leave them a minute for the sugar to harden into glass, and serve "
            "while the custard underneath is still cold.",
        ],
    },
}
