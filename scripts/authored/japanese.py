"""Japanese dishes with no Cookbook recipe to scrape.

See scripts/authored/__init__.py for the format and why these exist.
"""

from __future__ import annotations

RECIPES: dict[str, dict] = {
    # Serves 2. A shoyu bowl: chicken-and-kombu broth, a soy tare made
    # separately, and toppings that cook in the same pot as the broth.
    "ramen": {
        "ingredients": [
            "1.2 litres chicken stock",
            "10 g dried kombu",
            "10 g dried shiitake mushrooms",
            "20 g ginger, sliced",
            "2 cloves garlic, crushed",
            "4 spring onions",
            "200 g pork belly, thinly sliced",
            "4 tablespoons soy sauce",
            "2 tablespoons mirin",
            "2 tablespoons sake",
            "1 teaspoon caster sugar",
            "2 eggs",
            "300 g fresh ramen noodles",
            "60 g menma bamboo shoots",
            "2 sheets nori",
            "1 teaspoon sesame oil",
        ],
        "instructions": [
            "Put the stock, kombu and dried shiitake in a pot and bring them slowly "
            "up to a bare simmer. Lift the kombu out before the pot reaches a boil; "
            "boiled kombu turns the broth slippery and faintly bitter.",
            "Add the ginger, the garlic and the green tops of the spring onions, "
            "slide in the pork belly and simmer for 30 minutes with the lid ajar, "
            "skimming off any grey foam that rises.",
            "Meanwhile make the tare. Warm the soy sauce, mirin, sake and sugar in a "
            "small pan until the sugar dissolves, then let it bubble for a minute to "
            "drive off the raw alcohol. The tare carries the salt of the bowl, not "
            "the broth, which is why they are seasoned apart.",
            "Lower the eggs into boiling water and cook them for exactly six and a "
            "half minutes, then chill them in iced water and peel them. Sit them in "
            "two tablespoons of the tare while everything else finishes, turning them "
            "once or twice.",
            "Lift the pork out of the broth, blot it dry and sear the slices in a dry "
            "hot frying pan until the edges catch, then brush them with a little tare.",
            "Strain the broth through a fine sieve. Slice the shiitake caps for the "
            "bowls and discard the rest of the aromatics. Keep the broth hot but "
            "below a boil.",
            "Slice the white parts of the spring onions thinly and halve the eggs.",
            "Bring a second pan of unsalted water to a hard boil and cook the noodles "
            "for the time on the packet, usually a minute or two for fresh. They go "
            "in their own water and go in last: their starch would cloud the broth, "
            "and they keep softening from the moment they are cooked.",
            "Put half the tare in each warmed bowl and pour about 400 ml of hot broth "
            "over it, stirring once to combine.",
            "Drain the noodles hard, shaking the sieve until no water is left, and "
            "lower them into the bowls. Top with the pork, egg, menma, shiitake, nori "
            "and spring onion, add a few drops of sesame oil and eat straight away.",
        ],
    },

    # Serves 4. Kare raisu, with the roux made in a second pan from butter,
    # flour and curry powder rather than a bought block.
    "japanese-curry": {
        "ingredients": [
            "600 g boneless chicken thighs",
            "2 onions",
            "2 carrots",
            "500 g potatoes, peeled",
            "1 apple, grated",
            "2 cloves garlic, crushed",
            "15 g ginger, grated",
            "2 tablespoons vegetable oil",
            "50 g butter",
            "45 g plain flour",
            "3 tablespoons curry powder",
            "1 teaspoon garam masala",
            "1 litre chicken stock",
            "1 tablespoon tomato paste",
            "2 tablespoons soy sauce",
            "1 tablespoon Worcestershire sauce",
            "1 tablespoon honey",
            "300 g Japanese short-grain rice",
            "Salt",
            "Ground black pepper",
        ],
        "instructions": [
            "Rinse the rice in several changes of cold water until the water runs "
            "almost clear, then set it to cook. Starting it now lets it steam and "
            "rest while the curry thickens.",
            "Cut the chicken into 3 cm pieces and season them. Heat the oil in a "
            "heavy pot over a medium-high heat and brown the chicken on all sides in "
            "two batches, then lift it out.",
            "Slice the onions and cook them in the same pot for about ten minutes, "
            "scraping up the browned bits, until they are soft and properly golden. "
            "Onions taken this far are where the sweetness of the curry comes from.",
            "Stir in the garlic and ginger for a minute, then the tomato paste for a "
            "minute more.",
            "Return the chicken, pour in the stock and add the carrots cut into "
            "rounds and the potatoes cut into 4 cm chunks. Bring it to the boil, then "
            "simmer for 20 minutes until the potatoes are tender.",
            "While that simmers, melt the butter in a small pan, stir in the flour "
            "and cook the roux over a low heat for five to eight minutes, stirring, "
            "until it smells nutty and turns the colour of peanut butter.",
            "Take the roux off the heat and stir in the curry powder and garam "
            "masala. Off the heat the spices bloom in the hot fat without scorching, "
            "which they would do in a pan still on the flame.",
            "Ladle two ladles of the hot cooking liquid into the roux and whisk it "
            "smooth, then stir that loose paste back into the pot. Added as a slurry "
            "it disperses; added dry it seizes into lumps.",
            "Stir in the grated apple, honey, soy sauce and Worcestershire sauce and "
            "simmer uncovered for ten minutes, stirring often so the bottom does not "
            "catch, until the sauce is glossy and coats a spoon.",
            "Taste and season, then serve it beside a mound of the rice.",
        ],
    },

    # Serves 4. The potato-starch double fry: once low to cook, once hot to
    # crisp.
    "karaage": {
        "ingredients": [
            "800 g boneless chicken thighs",
            "3 tablespoons soy sauce",
            "2 tablespoons sake",
            "1 tablespoon mirin",
            "20 g ginger, grated",
            "3 cloves garlic, crushed",
            "1 teaspoon sesame oil",
            "1 teaspoon caster sugar",
            "0.5 teaspoon salt",
            "120 g potato starch",
            "Vegetable oil, for deep-frying",
            "1 lemon, cut into wedges",
        ],
        "instructions": [
            "Cut the chicken into 4 cm pieces and leave the skin on. It crisps in the "
            "second fry and it bastes the meat during the first.",
            "Whisk the soy sauce, sake, mirin, ginger, garlic, sesame oil, sugar and "
            "salt together in a bowl, add the chicken and turn it to coat. Leave it "
            "for 30 minutes at room temperature, or up to three hours in the fridge.",
            "Heat the oil in a deep pan to 160 °C. Fill the pan no more than a third "
            "full, because the chicken will bring the level up.",
            "Lift each piece out, let the marinade drip off for a second, then press "
            "it into the potato starch until thickly coated and shake off the loose "
            "excess. Coat only just before frying: starch left sitting on wet chicken "
            "turns to paste and slides off in the oil.",
            "Fry five or six pieces at a time for 90 seconds to two minutes. They "
            "should be barely coloured and just cooked through. Crowding the pan "
            "drops the oil temperature and the coating goes soft.",
            "Rest the pieces on a wire rack for five minutes. The residual heat "
            "finishes the centre while the surface dries.",
            "Bring the oil up to 190 °C and fry each batch again for 45 to 60 seconds "
            "until deep gold and hard to the tap of a spoon. The second fry drives "
            "off the moisture the first one pulled to the surface, and that is what "
            "keeps karaage crisp on the plate.",
            "Drain on the rack, salt them while they are hot and serve with the lemon "
            "wedges to squeeze over.",
        ],
    },

    # Serves 2. The rolled omelette, built one thin layer at a time.
    "tamagoyaki": {
        "ingredients": [
            "4 eggs",
            "2 tablespoons dashi",
            "1 teaspoon soy sauce",
            "1 teaspoon mirin",
            "1 teaspoon caster sugar",
            "0.25 teaspoon salt",
            "1 tablespoon vegetable oil",
            "50 g daikon radish, grated",
        ],
        "instructions": [
            "Beat the eggs with the dashi, soy sauce, mirin, sugar and salt until "
            "they are just combined, then pour them through a sieve. The cords that "
            "hold the yolk show up as white streaks in a rolled omelette, and the "
            "sieve is the only way to get rid of them.",
            "Set the tamagoyaki pan over a medium-low heat and wipe it with oil on a "
            "folded piece of kitchen paper. Keep the paper: you will oil the pan "
            "again between every layer.",
            "Test the heat with a drop of egg. It should set within a couple of "
            "seconds without hissing or browning; a pan hot enough to colour the egg "
            "is too hot to roll.",
            "Pour in a third of the egg and tilt the pan so it runs to the corners. "
            "Burst any bubbles with your chopsticks. When the surface is set but "
            "still glossy and slightly wet, fold the omelette over on itself in "
            "loose rolls, working from the far edge towards you.",
            "Push the roll back to the far end of the pan, oil the bare metal and "
            "pour in half the remaining egg, lifting the roll with the chopsticks so "
            "the raw egg runs underneath it. That seam is what welds the layers "
            "together instead of leaving them as separate sheets.",
            "When the new layer is just set, roll it towards you around the first "
            "roll, then repeat with the last of the egg.",
            "Turn the roll out onto a bamboo mat or a sheet of foil, press it gently "
            "into a neat rectangle and leave it for two minutes. Cut it into 2 cm "
            "slices and serve with the grated daikon.",
        ],
    },

    # Serves 4. Chicken and negi skewers, glazed at the end with a tare
    # reduced from soy, mirin and sake.
    "yakitori": {
        "ingredients": [
            "800 g boneless chicken thighs",
            "6 spring onions",
            "120 ml soy sauce",
            "120 ml mirin",
            "60 ml sake",
            "2 tablespoons caster sugar",
            "15 g ginger, sliced",
            "2 cloves garlic, crushed",
            "1 tablespoon vegetable oil",
            "Shichimi togarashi, to serve",
            "Salt",
        ],
        "instructions": [
            "Soak twelve bamboo skewers in cold water for 30 minutes so the exposed "
            "ends do not burn through on the grill.",
            "Put the soy sauce, mirin, sake, sugar, ginger and garlic in a small "
            "saucepan and simmer gently for 15 to 20 minutes, until the tare has "
            "reduced by about a third and just coats the back of a spoon. Strain it "
            "and set it aside.",
            "Cut the chicken into 3 cm pieces, keeping the skin on, and cut the white "
            "and pale green parts of the spring onions into 3 cm lengths.",
            "Thread the skewers alternately, four or five pieces of chicken to each, "
            "pushing the pieces together snugly but not squashing them. Packed too "
            "tight the sides steam instead of grilling.",
            "Heat a charcoal or gas grill until it is properly hot and oil the bars. "
            "Grill the skewers plain, without any sauce, for three to four minutes a "
            "side, until the fat has rendered and the skin has coloured. The tare is "
            "sugary and would burn black long before the chicken cooked.",
            "Now brush the skewers with tare and turn them every 30 seconds for two "
            "or three minutes, building three or four thin coats into a lacquer.",
            "Rest them for a minute, then season with salt and shichimi togarashi and "
            "serve with the rest of the tare for dipping.",
        ],
    },

    # Serves 2. Parent and child: chicken and egg simmered in seasoned dashi
    # and slid over rice.
    "oyakodon": {
        "ingredients": [
            "300 g boneless chicken thighs, sliced",
            "1 onion, thinly sliced",
            "4 eggs",
            "200 ml dashi",
            "3 tablespoons soy sauce",
            "3 tablespoons mirin",
            "1 tablespoon sake",
            "1 teaspoon caster sugar",
            "400 g cooked Japanese short-grain rice",
            "2 spring onions",
            "1 sheet nori, shredded",
            "Shichimi togarashi, to serve",
        ],
        "instructions": [
            "Have the rice hot and two deep bowls warmed before you start. The "
            "chicken and egg take four minutes at the end and will not wait.",
            "Beat the eggs with five or six strokes only, leaving visible streaks of "
            "white and yolk. Eggs beaten smooth set into a uniform custard, and what "
            "oyakodon wants is soft ribboned curds.",
            "Put the dashi, soy sauce, mirin, sake and sugar in a small skillet and "
            "bring them to a simmer.",
            "Add the sliced onion and simmer for three minutes, until it has gone "
            "translucent and taken on the seasoning.",
            "Lay the chicken in as a single layer and simmer for five minutes, "
            "turning the pieces once, until just cooked through. If your skillet is "
            "narrower than 20 cm, cook the two portions one after the other with half "
            "of everything, because a crowded pan boils the chicken.",
            "Pour two-thirds of the egg over the surface in a spiral, cover the pan "
            "and cook over a medium-low heat for a minute, until it is barely set at "
            "the edges.",
            "Pour on the rest of the egg, cover again for 30 seconds and take the pan "
            "off the heat. The carryover heat finishes it; the top should still look "
            "glossy and a little loose when it leaves the stove.",
            "Fill the bowls with rice and slide the chicken and egg over it in one "
            "piece, spooning the pan juices on top. Scatter with sliced spring onion "
            "and nori, add shichimi togarashi and eat immediately.",
        ],
    },
}
