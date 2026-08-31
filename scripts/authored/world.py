"""Dishes from the scattering cuisines with no Cookbook recipe to scrape.

See scripts/authored/__init__.py for the format and why these exist.
"""

from __future__ import annotations

RECIPES: dict[str, dict] = {
    # Serves 4. The long total time is marinating, not work: the pear has to
    # sit on the meat for hours and the grilling itself takes minutes.
    "galbi": {
        "ingredients": [
            "1.2 kg beef short ribs, flanken-cut",
            "1 nashi pear, grated",
            "1 small onion, grated",
            "120 ml soy sauce",
            "50 g soft brown sugar",
            "2 tablespoons honey",
            "1 tablespoon mirin",
            "2 tablespoons toasted sesame oil",
            "6 cloves garlic, minced",
            "1 tablespoon grated ginger",
            "4 spring onions, sliced",
            "1 tablespoon toasted sesame seeds",
            "0.5 teaspoon ground black pepper",
            "200 g red leaf lettuce, leaves separated",
        ],
        "instructions": [
            "Rinse the ribs and leave them in a bowl of cold water for 30 minutes, "
            "changing the water once. This draws out the blood that would otherwise "
            "muddy the marinade and burn black on the grill.",
            "Drain the ribs and pat them completely dry, then score the meat lightly "
            "on both sides so the marinade reaches past the surface.",
            "Peel and grate the pear and the onion into a large dish, catching all "
            "the juice. The pear is doing real work here: it carries an enzyme that "
            "breaks down connective tissue, which is what makes galbi tender without "
            "long cooking.",
            "Stir in the soy sauce, brown sugar, honey, mirin, sesame oil, garlic, "
            "ginger, half the spring onions and the black pepper until the sugar has "
            "dissolved.",
            "Turn the ribs through the marinade until every surface is coated, cover, "
            "and refrigerate for at least four hours and no more than twelve. Left "
            "overnight and beyond, the pear enzyme keeps going and the meat turns "
            "soft and mealy.",
            "Heat a charcoal or gas grill until it is properly hot - you want the "
            "ribs to sear on contact, because they are thin and any hesitation cooks "
            "them through before they colour.",
            "Lift the ribs out and let the excess marinade drip off. Grill them for "
            "two to three minutes a side, moving them if the sugar starts to catch, "
            "until the edges are lacquered and charred in places.",
            "Rest the ribs for a couple of minutes, then cut between the bones into "
            "strips. Scatter over the sesame seeds and the remaining spring onions "
            "and serve with the lettuce leaves for wrapping.",
        ],
    },

    # Serves 4. Bones, water and noodles are stated for what ends up in the
    # four bowls - about 450 ml of broth each - not for the full stockpot,
    # which starts nearer three litres and reduces down.
    "pho": {
        "ingredients": [
            "1.2 kg beef leg and marrow bones",
            "400 g beef brisket",
            "300 g beef sirloin",
            "2 onions",
            "80 g ginger",
            "6 star anise",
            "8 g cassia bark",
            "1 teaspoon whole cloves",
            "2 teaspoons coriander seeds",
            "3 cardamom pods",
            "1.8 litres water, plus more to top up",
            "60 ml fish sauce",
            "30 g rock sugar",
            "400 g dried flat rice noodles",
            "150 g bean sprouts",
            "4 spring onions, sliced",
            "20 g fresh coriander",
            "20 g Thai basil",
            "2 red chillies, sliced",
            "2 limes, cut into wedges",
        ],
        "instructions": [
            "Put the bones in a stockpot, cover them with cold water and bring it to "
            "a hard boil for ten minutes. Grey scum will rise in a thick raft.",
            "Tip the bones into the sink, rinse each one under the tap and scrub the "
            "pot out. Parboiling like this is the whole reason a good pho broth is "
            "clear: the blood and soluble proteins come out in one go, instead of "
            "clouding the pot for the next three hours.",
            "Char the onions and the ginger, skins on and halved, directly over a gas "
            "flame or under a very hot grill until they are blackened in patches, "
            "about ten minutes. Rub off the loose char and rinse them. The scorching "
            "is not cosmetic - it caramelises their sugars and gives the broth its "
            "sweet, smoky backbone.",
            "Toast the star anise, cassia, cloves, coriander seeds and cardamom in a "
            "dry pan over a medium heat for two minutes, until they smell warm, then "
            "tie them into a square of muslin.",
            "Return the bones to the clean pot with the brisket, the charred onion "
            "and ginger and the spice bag. Add the water and enough more to cover "
            "everything by five centimetres.",
            "Bring it to the barest simmer, with a bubble breaking every second or "
            "so, and hold it there. A rolling boil emulsifies the fat into the liquid "
            "and turns the broth cloudy and greasy, and it will not come back.",
            "Skim the surface for the first twenty minutes. After ninety minutes lift "
            "out the brisket, plunge it into cold water so it stops cooking and stays "
            "moist, then refrigerate it.",
            "Simmer for three hours in all, topping up with hot water as it drops. "
            "Strain the broth through a fine sieve and discard the bones and spices; "
            "you should have about 1.8 litres.",
            "Season the broth with the fish sauce and the rock sugar. Taste it and "
            "push the seasoning further than seems right - the noodles, herbs and "
            "sprouts in the bowl will dilute it.",
            "Firm the sirloin in the freezer for fifteen minutes, then slice it "
            "against the grain as thinly as you can. Slice the cold brisket too.",
            "Soak or boil the rice noodles according to the packet, drain them well "
            "and divide them between four warmed bowls. Lay the raw sirloin and the "
            "brisket over the top.",
            "Bring the broth back to a full boil and ladle it straight over the meat. "
            "The heat of the broth is what cooks the raw beef, so it has to be "
            "boiling and the bowls have to go to the table at once, with the sprouts, "
            "herbs, chilli and lime alongside.",
        ],
    },

    # Serves 4. Roasted stacked on a skewer rather than turned on a spit, which
    # is as close as a domestic oven gets.
    "shawarma": {
        "ingredients": [
            "800 g boneless chicken thighs",
            "200 g Greek yoghurt",
            "3 tablespoons olive oil",
            "3 tablespoons lemon juice",
            "7 cloves garlic, crushed",
            "2 teaspoons ground cumin",
            "2 teaspoons ground coriander",
            "2 teaspoons sweet paprika",
            "1 teaspoon ground turmeric",
            "1 teaspoon ground cinnamon",
            "0.5 teaspoon ground cardamom",
            "0.5 teaspoon cayenne pepper",
            "1 teaspoon ground black pepper",
            "1.5 teaspoons salt",
            "90 g tahini",
            "1 lemon, juiced",
            "60 ml cold water",
            "4 flatbreads",
            "1 red onion, thinly sliced",
            "2 tomatoes, sliced",
            "20 g flat-leaf parsley, chopped",
        ],
        "instructions": [
            "Whisk the yoghurt, olive oil, lemon juice, six of the garlic cloves, all "
            "the spices and the salt together in a large bowl. Keep the seventh clove "
            "back for the sauce.",
            "Open the thighs out flat, turn them through the marinade until they are "
            "thickly coated, cover and refrigerate for at least two hours and ideally "
            "overnight. Yoghurt works more slowly and more gently than a straight "
            "lemon marinade, which is why it can be left this long without the "
            "surface of the meat going chalky.",
            "Heat the oven to 220 °C.",
            "Thread the thighs onto a long metal skewer, stacking them flat against "
            "one another, and stand the skewer across a roasting tin so the meat is "
            "held clear of the base. The stack is the point: the outside roasts and "
            "browns while the interior stays moist, the way it does on a spit. "
            "Failing a skewer, overlap them tightly in the tin.",
            "Roast for 40 to 45 minutes, until the outer edges are deep brown and "
            "crisp and a skewer pushed into the centre of the stack comes out hot.",
            "While it roasts, make the sauce. Whisk the tahini with the lemon juice "
            "and the reserved garlic clove: it will seize into a stiff, ugly paste, "
            "which is what is meant to happen.",
            "Add the cold water a spoonful at a time, whisking hard after each, until "
            "the paste loosens and turns pale and pourable. Season it with salt.",
            "Rest the chicken for ten minutes, then carve down the outside of the "
            "stack in thin shavings, the way it is cut off a spit. Cutting it into "
            "chunks instead just gives you roast chicken.",
            "Warm the flatbreads briefly in the cooling oven, pile the chicken on "
            "with the red onion, tomato and parsley, and spoon the tahini sauce over.",
        ],
    },

    # Serves 6. Tinned chickpeas cooked down further with bicarbonate of soda,
    # which is what makes a half-hour hummus as smooth as an overnight one.
    "hummus": {
        "ingredients": [
            "480 g tinned chickpeas, drained",
            "1 teaspoon bicarbonate of soda",
            "180 g tahini",
            "60 ml lemon juice",
            "2 cloves garlic",
            "1 teaspoon fine sea salt",
            "0.5 teaspoon ground cumin",
            "100 ml iced water",
            "2 tablespoons extra-virgin olive oil",
            "1 teaspoon sweet paprika",
            "1 tablespoon flat-leaf parsley, chopped",
        ],
        "instructions": [
            "Put the drained chickpeas in a saucepan with the bicarbonate of soda, "
            "cover them with water by five centimetres and bring it to the boil.",
            "Simmer for about 20 minutes, skimming off the foam and the loose skins "
            "that float up, until a chickpea crushes to nothing between your fingers. "
            "The alkali breaks down the pectin holding the skins on, so they dissolve "
            "rather than having to be pinched off one at a time - and skins are what "
            "makes hummus grainy.",
            "Blend the garlic, lemon juice and salt together in a food processor and "
            "leave it to stand for five minutes. The acid takes the raw heat off the "
            "garlic, which would otherwise dominate the bowl by the second day.",
            "Drain the chickpeas, add them to the processor still hot with the cumin, "
            "and run it for three or four minutes until the paste is completely "
            "smooth. Hot chickpeas purée finer than cold ones.",
            "Add the tahini and blend again until the mixture is thick and pale.",
            "With the motor running, trickle in the iced water. This is the step that "
            "changes the texture: whipping tahini with water this cold turns it from "
            "dense and claggy to light and almost mousse-like, and the paste goes "
            "several shades paler as it takes in air.",
            "Taste and adjust the lemon and salt, then let the hummus sit for half an "
            "hour so the flavours settle.",
            "Spread it into a shallow bowl, dragging the back of a spoon round to "
            "leave a well, pool the olive oil in it and finish with the paprika and "
            "the parsley.",
        ],
    },

    # Serves 2. Shoyu poke, dressed and eaten the same hour - the cure is
    # minutes, not days.
    "poke-bowl": {
        "ingredients": [
            "300 g sashimi-grade tuna",
            "160 g sushi rice",
            "2 tablespoons rice vinegar",
            "2 teaspoons caster sugar",
            "1 teaspoon fine sea salt",
            "2 tablespoons soy sauce",
            "1 tablespoon toasted sesame oil",
            "1 teaspoon grated ginger",
            "0.5 teaspoon chilli flakes",
            "0.5 sweet onion, thinly sliced",
            "3 spring onions, sliced",
            "1 teaspoon toasted sesame seeds",
            "1 sheet nori, shredded",
            "1 avocado, sliced",
            "100 g cucumber, thinly sliced",
            "60 g shelled edamame beans",
        ],
        "instructions": [
            "Rinse the rice in several changes of cold water until the water runs "
            "almost clear, then cook it covered with 240 ml of water for 12 minutes "
            "and leave it, lid on and off the heat, for 10 more.",
            "Warm the rice vinegar, sugar and salt together until they dissolve, then "
            "fold the mixture through the hot rice with a slicing motion of the "
            "spatula rather than a stir, which would crush the grains. Let the rice "
            "cool to just above room temperature.",
            "Keep the tuna in the fridge until the last moment, then cut it into "
            "2 cm cubes with a sharp knife, one clean stroke per cut. Sawing at "
            "sashimi-grade fish tears the muscle fibres and the texture goes woolly.",
            "Whisk the soy sauce, sesame oil, ginger, chilli flakes and half the "
            "sesame seeds together in a bowl.",
            "Add the tuna, the sweet onion and two-thirds of the spring onions and "
            "turn everything over gently with your hands so the cubes stay whole.",
            "Leave it to sit for ten minutes and no longer. Beyond that the salt in "
            "the shoyu starts to cure the outside of the cubes and they lose the soft "
            "raw centre that makes poke worth eating.",
            "Spread the rice into two bowls, spoon the tuna and its dressing over, "
            "and arrange the avocado, cucumber and edamame around it.",
            "Finish with the remaining sesame seeds, the rest of the spring onions "
            "and the shredded nori, and eat straight away.",
        ],
    },

    # Serves 2. Cookbook:Banh Mi exists but lists five fillings as
    # alternatives with no amounts, so a scrape of it builds a sandwich
    # containing all five at once.
    "banh-mi": {
        "ingredients": [
            "2 small baguettes",
            "150 g pork belly, thinly sliced",
            "60 g pork liver pate",
            "1 carrot",
            "150 g daikon radish",
            "3 tablespoons rice vinegar",
            "2 tablespoons caster sugar",
            "1 teaspoon salt",
            "2 tablespoons mayonnaise",
            "1 tablespoon soy sauce",
            "1 tablespoon fish sauce",
            "2 teaspoons honey",
            "2 cloves garlic",
            "1 cucumber",
            "10 g coriander",
            "1 red chilli",
        ],
        "instructions": [
            "Cut the carrot and daikon into matchsticks, toss them with the salt and "
            "leave for ten minutes, then squeeze out the water they give up. Pickling "
            "them wet dilutes the brine and leaves them limp.",
            "Warm the vinegar with the sugar until it dissolves, pour it over the "
            "vegetables and leave them at least twenty minutes. They keep for weeks.",
            "Mix the soy sauce, fish sauce, honey and crushed garlic, and turn the "
            "pork belly through it. Leave it while the pickles sit.",
            "Fry the pork over a high heat until the edges caramelise, two or three "
            "minutes a side. The honey burns quickly, so keep it moving.",
            "Split the baguettes lengthwise without cutting all the way through, and "
            "warm them in a hot oven for five minutes so the crust crackles.",
            "Spread one cut face with the pâté and the other with the mayonnaise.",
            "Fill with the pork, then the drained pickles, then cucumber cut into "
            "long ribbons, and finish with coriander and sliced chilli.",
            "Press the sandwich closed and eat it immediately, while the bread is "
            "still crisp.",
        ],
    },
}
