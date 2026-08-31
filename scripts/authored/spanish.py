"""Spanish dishes with no Cookbook recipe to scrape.

See scripts/authored/__init__.py for the format and why these exist.
"""

from __future__ import annotations

RECIPES: dict[str, dict] = {
    # Serves 4.
    "patatas-bravas": {
        "ingredients": [
            "900 g waxy potatoes",
            "2 tablespoons olive oil",
            "1 onion, finely chopped",
            "2 cloves garlic, crushed",
            "1 tablespoon sweet smoked paprika",
            "1 teaspoon hot smoked paprika",
            "1 teaspoon plain flour",
            "400 g tinned chopped tomatoes",
            "150 ml chicken stock",
            "1 tablespoon sherry vinegar",
            "Vegetable oil, for deep-frying",
            "Flaky sea salt",
        ],
        "instructions": [
            "Peel the potatoes and cut them into 3 cm cubes, keeping them close to "
            "the same size so they cook at the same rate. Rinse off the loose "
            "starch and dry them thoroughly.",
            "Heat the frying oil in a deep pan to 140 °C and cook the potatoes in "
            "two batches for about eight minutes, until a knife slides in easily "
            "but they have taken no colour. Lift them onto a wire rack.",
            "Leave them to cool for at least fifteen minutes. The first fry cooks "
            "the inside and dries the surface; the second only has to build the "
            "crust, and a cooled cube crisps far harder than a hot one.",
            "For the sauce, warm the olive oil in a saucepan and soften the onion "
            "over a low heat for ten minutes, then add the garlic for a minute more.",
            "Take the pan off the heat before stirring in both paprikas and the "
            "flour. Paprika scorches in seconds over direct heat and turns bitter; "
            "off the heat it just blooms in the warm oil.",
            "Return the pan to a medium heat, add the tomatoes, stock and vinegar, "
            "and simmer for fifteen minutes.",
            "Blend the sauce smooth, pass it through a sieve and season it. It "
            "should pour, but still cling to a potato rather than run off it.",
            "Bring the frying oil up to 190 °C and fry the potatoes a second time, "
            "in batches, for three to four minutes, until deep gold and hard.",
            "Drain them, salt them at once while the surface is still oily, pile "
            "them into a warm dish and spoon the sauce over. Serve straight away, "
            "before the crust goes soft under the sauce.",
        ],
    },

    # Serves 6.
    "croquetas": {
        "ingredients": [
            "100 g butter",
            "1 small onion, finely chopped",
            "120 g plain flour",
            "750 ml whole milk",
            "200 g jamón serrano, finely chopped",
            "0.25 teaspoon grated nutmeg",
            "100 g plain flour, for coating",
            "2 eggs",
            "150 g fine dried breadcrumbs",
            "Vegetable oil, for deep-frying",
            "Salt",
            "Ground white pepper",
        ],
        "instructions": [
            "Melt the butter in a heavy saucepan and cook the onion very gently for "
            "ten minutes, until soft and translucent but not coloured.",
            "Stir in the 120 g of flour and cook the roux for three minutes, long "
            "enough to lose the raw flour taste while staying pale.",
            "Add the milk a ladleful at a time, beating each addition completely "
            "smooth before the next. Poured in all at once it gives lumps that no "
            "amount of whisking will take out again.",
            "Stir in the jamón and the nutmeg, then season carefully - the ham is "
            "already salty and the sauce reduces further from here.",
            "Cook over a low heat for fifteen to twenty minutes, stirring almost "
            "constantly, until the béchamel is thick enough to come away from the "
            "sides of the pan in one mass and hold the mark of the spoon.",
            "Spread it about 3 cm deep in a shallow dish, press cling film onto the "
            "surface so no skin forms, and chill for at least four hours, better "
            "overnight. The paste has to set hard: warm béchamel cannot be shaped "
            "at all, and a croqueta that goes into the oil less than cold splits "
            "and empties itself into the fryer.",
            "Divide the cold paste into about thirty pieces and roll each one into "
            "a short cylinder with floured hands.",
            "Set out three shallow dishes: the remaining flour, the eggs beaten, "
            "and the breadcrumbs. Take each croqueta through the three in order, "
            "making sure no paste is left showing anywhere.",
            "Chill the crumbed croquetas for thirty minutes while the oil heats. "
            "The second rest firms the coating into a shell.",
            "Heat the oil to 180 °C and fry them five or six at a time for about "
            "two minutes, turning once, until deep gold. More than that in the pan "
            "drops the temperature and the crust comes out greasy.",
            "Drain them on a rack and serve hot, while the inside is still molten.",
        ],
    },

    # Serves 2. Breakfast, so it is four slices and nothing else.
    "pan-con-tomate": {
        "ingredients": [
            "4 slices country bread",
            "2 ripe tomatoes",
            "3 tablespoons extra-virgin olive oil",
            "Flaky sea salt",
        ],
        "instructions": [
            "Toast the bread on a hot grill pan until it is marked and crisp on "
            "both sides but still soft in the middle.",
            "Halve the tomatoes through the middle. They need to be very ripe and "
            "soft; a firm tomato will not give its flesh up to the bread.",
            "Rub the cut face of a tomato half hard across each hot slice, pressing "
            "until the pulp is gone and only the skin is left in your hand.",
            "Drizzle the olive oil over the slices, enough that it soaks into the "
            "crumb rather than sitting on top, and finish with flaky salt.",
            "Eat immediately. Dressed bread softens within a few minutes.",
        ],
    },

    # Serves 6.
    "fabada": {
        "ingredients": [
            "500 g dried fabes de la granja, or large butter beans",
            "300 g lacón, or gammon",
            "150 g panceta",
            "200 g chorizo",
            "200 g morcilla asturiana",
            "1 onion, halved",
            "4 cloves garlic",
            "2 bay leaves",
            "2 tablespoons olive oil",
            "1 teaspoon sweet smoked paprika",
            "0.25 teaspoon saffron threads",
            "Salt",
        ],
        "instructions": [
            "Cover the fabes generously with cold water and leave them to soak "
            "overnight. Beans this large will not cook evenly from dry: the skins "
            "burst long before the middles have softened.",
            "If the lacón is heavily salted, soak it overnight in its own bowl of "
            "water and change the water once.",
            "Drain the beans and put them in a heavy pot with the lacón, the "
            "panceta, the onion halves, the garlic and the bay leaves. Add cold "
            "water to cover everything by 5 cm.",
            "Bring it slowly to the boil, skimming off the grey foam as it rises. "
            "Add the chorizo and the morcilla whole, and do not prick the morcilla "
            "or it will collapse into the broth.",
            "As soon as it boils, pour in a glass of cold water to stop it dead - "
            "this is the asustar, frightening the beans, and the shock keeps the "
            "skins from splitting.",
            "Lower the heat until the surface barely trembles and cook, uncovered, "
            "for two to two and a half hours. Fabada must never boil hard; a "
            "rolling boil breaks the beans and clouds the broth.",
            "Top up with a little cold water whenever the beans show above the "
            "surface, and never stir with a spoon. Shake the pot by its handles "
            "instead, which moves the beans without tearing them.",
            "After the first hour, lift out the onion and garlic, blend them with a "
            "ladleful of broth and a spoonful of the beans, and stir the puree back "
            "in. That is what thickens a fabada - there is no flour in it.",
            "Warm the olive oil in a small pan, take it off the heat, stir in the "
            "paprika and the saffron, and pour the lot into the pot.",
            "It is done when a bean crushes to cream between your fingers and the "
            "broth has gone glossy. Season with salt only now, since the cured "
            "meats give up a great deal of their own.",
            "Lift out the meats, slice them thickly and return them to the pot.",
            "Let it stand off the heat for twenty minutes before serving - it "
            "settles and thickens as it cools - then serve in deep bowls.",
        ],
    },

    # Serves 4.
    "albondigas": {
        "ingredients": [
            "300 g minced pork",
            "300 g minced beef",
            "60 g fresh breadcrumbs",
            "60 ml whole milk",
            "1 egg",
            "3 cloves garlic, minced",
            "2 tablespoons chopped parsley",
            "0.25 teaspoon grated nutmeg",
            "60 g plain flour, for dusting",
            "4 tablespoons olive oil",
            "1 onion, finely chopped",
            "50 g blanched almonds",
            "1 teaspoon sweet smoked paprika",
            "150 ml dry white wine",
            "400 g tinned chopped tomatoes",
            "250 ml chicken stock",
            "1 bay leaf",
            "Salt",
            "Ground black pepper",
        ],
        "instructions": [
            "Soak the breadcrumbs in the milk for five minutes, until they have "
            "taken all of it up.",
            "Mix the pork and beef with the soaked crumbs, the egg, two thirds of "
            "the garlic, half the parsley, the nutmeg, salt and pepper. Work it "
            "only until it comes together; kneading minced meat makes it springy "
            "and the meatballs turn out bouncy rather than tender.",
            "Chill the mixture for twenty minutes, then roll it into about 24 "
            "walnut-sized balls with wet hands.",
            "Roll the meatballs through the flour and tap off the excess. The flour "
            "gives them a surface that browns, and what falls into the pan later "
            "helps thicken the sauce.",
            "Heat half the oil in a skillet and brown the meatballs in batches on "
            "all sides, about four minutes a batch. They do not need to be cooked "
            "through, as they finish in the sauce. Set them aside.",
            "Fry the almonds in the same pan for a minute, until golden, and lift "
            "them out before they catch.",
            "Add the rest of the oil and cook the onion gently for ten minutes, "
            "until soft and sweet, then add the remaining garlic for a minute.",
            "Off the heat, stir in the paprika, which burns almost instantly on a "
            "hot pan base.",
            "Pour in the wine, scrape up everything stuck to the bottom of the pan "
            "and let it bubble for two minutes to drive off the alcohol.",
            "Add the tomatoes, the stock and the bay leaf and simmer for ten "
            "minutes.",
            "Pound or blitz the fried almonds with the remaining parsley and a "
            "ladleful of the sauce to a coarse paste. This picada is what gives the "
            "salsa its body; Spanish sauces are bound with nuts and bread rather "
            "than with flour or cream.",
            "Return the meatballs to the pan, cover and simmer gently for twenty "
            "minutes, turning them once.",
            "Stir in the picada and cook for five minutes more. Check the salt, "
            "take out the bay leaf and serve with bread for the sauce.",
        ],
    },
}
