# Gospel

> Let science be my gospel and life be my creed

A React Native + Expo app for Android that builds a **repeating** meal schedule —
the same meals every day, week, fortnight, three weeks or month — sized to your
body from published dietary reference intakes, and shopped for by a grocery list
that knows what is already in your cupboard.

This repository is the **frontend only**. It runs entirely on-device with no
backend and no network calls.

## Running it

```bash
npm install
npm run android      # or: npm start, then scan the QR code
```

```bash
npm test             # 223 tests across two projects
python -m pytest scripts/   # 58 tests for the unit parser
npm run typecheck    # tsc --noEmit
npm run apk          # a signed release APK, into site/download/
```

## What it does

**Onboarding** asks twelve questions. Six of them drive nutrition and are exactly
the inputs `nutrient_targets.xlsx` defines — sex, age, weight, diet, activity and
sun exposure. The other six shape recipe selection: cuisines, difficulty, time
per meal, weekly budget, and how often the plan repeats.

**The plan** is solved on-device against your resolved targets, then repeats.
Same seed, same plan; regenerating is a deliberate act.

**Any meal can be swapped.** A solver optimising forty-eight targets will
sooner or later put something on a Tuesday you will not cook, and one such dish
is enough to stop you following the plan at all. `swap` on a meal row opens
every recipe that could take the slot, ranked by the planner's own objective —
so the top of the list is what the solver would have chosen if it had looked
harder, not a second opinion from a different measure. Each card opens onto a
radar of the dish against its fair share of the day, the figures behind it, and
the price, time and difficulty. Choosing one rescales that day's portions so it
still lands on its energy target; the other six days are left alone.

**Nutrition** shows 43 of the workbook's 48 targets against what the plan
delivers, each one summed from USDA FoodData Central panels over the plan's
ingredient weights. The other five — iodine, chloride, chromium, molybdenum and
biotin — are absent from FDC's schema entirely, so they are not shown at all
rather than shown as a permanent blank.

**Grocery and Pantry** track what you own. A 300 g tub of sour cream against 60 g
a week is covered on quantity for five weeks, but its 21-day shelf life expires
first — so it returns to the list in cycle four, and the Pantry tab shows why.

## Architecture

```
app/                      Expo Router routes
  index.tsx               Title screen and onboarding gate
  onboarding/index.tsx    Twelve-step stepper
  (tabs)/                 Plan · Nutrition · Grocery · Pantry
  recipe/[id].tsx         Ingredients, quantities, method
  swap/[day]/[slot].tsx   Ranked replacements for one meal
  nutrient/[id].tsx       Derivation, upper limits, citations

src/
  domain/
    nutrition/resolver.ts   48 targets from 6 inputs
    planner/planner.ts      Greedy fill + best-of-K hill climb
    planner/swap.ts         Ranked replacements for one meal, same objective
    pantry/depletion.ts     Quantity and shelf-life simulation
  data/generated/           Committed JSON, built by scripts/
  components/, theme/       UI and design tokens

scripts/
  build_nutrient_data.py     xlsx -> nutrition.json + golden_vectors.json
  recipe_sources.py          the curated hundred, and where each comes from
  wikimedia.py               Cookbook, Wikipedia and Commons scraping
  measures.py                "3-4 tbsp olive oil" -> 41 g
  cookbook_index.py          the Cookbook by cuisine, course and difficulty
  discover_recipes.py        3,792 Cookbook pages -> the other 400 dishes
  authored/                  the 29 recipes no permitted source publishes
  build_recipe_library.py    the above -> recipes.json + ingredients.json
  fetch_recipe_images.py     500 photographs -> assets/recipes/
  ingredient_taxonomy.py     Prices, shelf lives, pack sizes, diet flags
  build_app_icon.py          the app icon, drawn rather than painted
  screenshots.mjs            every page, captured from the web build
  build_site_assets.py       the phone renders, cropped and sized for the web
  build_apk.mjs              a signed release APK, into site/download/

site/                     The landing page, static
  index.html, styles.css, main.js
  assets/                 the renders as WebP, the link-preview card
  download/               the APK, its checksum, and build.js for the page
```

### The nutrition engine

`nutrient_targets.xlsx` is a machine-readable rules engine, not a lookup table:
48 nutrients, 64 modifier rules with operators and priorities, Schofield BMR
coefficients, PAL multipliers, diet-spectrum anchors and latitude bands. The
resolver is a direct port of the algorithm published in its `_readme` sheet.

It is verified against the workbook's own `expected_output` sheet — **4 personas
× 48 nutrients**, asserting the value, the exact set of rule ids that fired, the
flags raised, and the upper-limit comparison. If the port ever drifts from the
published standard, those tests fail.

Two ambiguities in the spec were settled from the golden data rather than
guessed: derived nutrients (fibre) use the *resolved* energy value, and on a
priority tie the **higher** priority number wins, with the losing `set` rule
excluded from `rules_applied`.

### The recipe library

Five hundred dishes. Japanese, Italian, American, French and Spanish carry the
library — they are its five largest cuisines and no other comes close — with a
scattering of everyday cooking from seventeen more.

Nothing is bought or downloaded as a dataset. Each dish is assembled from three
public Wikimedia pages:

| | source | licence |
|---|---|---|
| ingredients and method, 471 of 500 | Wikibooks Cookbook | CC BY-SA 4.0 |
| description | Wikipedia | CC BY-SA 4.0 |
| photograph | Wikimedia Commons | per file, credited in-app |

The other 29 dishes — ramen, pho, shawarma, pizza margherita, pan con tomate —
have a Wikipedia article and a photograph but no Cookbook page with a real
method. Those recipes are written in `scripts/authored/` and every one is
labelled `authored` on screen, so a reader can tell which of the two they are
looking at.

**Chosen, then found.** The first hundred are one hand-written row of
`scripts/recipe_sources.py` each: the dishes an everyday meal planner looks
broken without. Four hundred more cannot be picked that way, so
`scripts/discover_recipes.py` walks the Cookbook's own `Category:Recipes` —
3,792 pages — and keeps what survives four questions:

- **Is it a recipe?** Ingredients and Procedure sections that parse into at
  least four weighed ingredients and three steps. 412 pages failed this.
- **Is it a meal?** 90–1400 g a serving, which is what separates a dish from a
  spice rub or a bottle of cordial. Sauces, doughs and stocks are excluded by
  name as well: pesto is an ingredient of a plate of trofie, and a plan that
  schedules a jar of it for dinner is wrong in a way no nutrition figure would
  reveal.
- **Is there a picture?** No photograph, no recipe.
- **Whose food is it?** The Cookbook's own origin categories first, then the
  page's `Cuisine` field, then the categories on the dish's Wikipedia article.
  Two thirds of the Cookbook is in no origin category at all, and a scraper
  guessing cuisine from the dish name would be inventing the one field the
  reader filters on.

The five are taken to exhaustion in a first pass and everything else is capped
in a second, which is what stops the 219 Nigerian recipes in the Cookbook from
becoming a fifth of the library on their own.

Servings, cooking time and difficulty come from the Cookbook where it says:
192 serving counts and 214 times from the recipe infobox, and 385 of the 400
difficulties from the Cookbook's own `Easy`/`Medium`/`Difficult` categories.
The rest are estimated from the shape of the recipe, and `discovered.json`
records which is which.

**NYT Cooking is deliberately absent.** It was the first source asked for. Its
`robots.txt` disallows `anthropic-ai` and `ClaudeBot` outright, and its terms
prohibit scraping, text-and-data-mining and dataset creation. Nothing here
touches it.

Photographs are downloaded, resized and **bundled** rather than hotlinked, at
1000×600 for the recipe screen and 240×240 for the plan list — 60 MB for the
five hundred. That keeps the app's no-network-calls claim true and means a
recipe cannot lose its picture to someone else's outage. It is also the single
biggest thing in the app; `HERO` in `scripts/fetch_recipe_images.py` is the
dial if that trade ever stops being worth it.

### Regenerating the data

`nutrient_targets.xlsx` lives in `data-source/` and is gitignored for size.
The recipe half needs no local source file, only network access and an
`FDC_API_KEY` in `.env`. Order matters — nutrition is computed from the
ingredient list, so the ingredients have to exist first:

```bash
npm run data
```

which is:

```bash
python scripts/build_nutrient_data.py       # xlsx -> targets
python scripts/cookbook_index.py            # the Cookbook's own categories
python scripts/discover_recipes.py          # -> scripts/discovered.json
python scripts/fetch_recipe_images.py       # Commons -> assets/recipes/
python scripts/build_recipe_library.py      # -> recipes.json, ingredients.json
python scripts/fetch_fdc_nutrition.py       # -> ingredient_nutrition.json
python scripts/attach_recipe_nutrition.py   # -> recipes.json, with nutrition
```

`npm run data:check` verifies the sources before a build: that every dish still
resolves to a photograph and a method, that every authored recipe parses, and
that the unit parser still turns each written line into the weight it should.

Recipe ids are derived from the slug, so adding a dish does not renumber the
others and does not invalidate a saved plan.

## Design

**The interface has no colour.** The palette is one neutral ramp from black to
white, and everything the app needs to say — a target met, a limit breached, a
selection, a threshold — is said with fill, weight, hatch or inversion instead.
That is a stricter constraint than it sounds and a better one: form survives a
greyscale screenshot, a colour-blind reader and direct sunlight, where a
magenta-versus-orange distinction survives none of them. Depth does the work
colour would: four surface levels, near-black, and a level means the same thing
everywhere in the app.

**The photographs are the one exception, and they are in full colour.** A plate
of food is the only thing on screen that is not a measurement, and desaturating
it threw away the only information it carries — whether a curry is deep red or
pale yellow is the point of the picture. They are framed by a hairline in the
ramp's own grey and given a fixed footprint, which is what keeps a colour
photograph from shouting down the figures beside it.

The app icon is drawn from the same two greys: a plate read as a graduated
measure — a ring, filled to a level, with a rule running the width of the tile
that meets the circle exactly there. It is the app's argument in one shape, and
it makes the Android monochrome variant free.

Three type registers for the three things the app is: Newsreader italic for
doctrine, IBM Plex Sans for interface, IBM Plex Mono for **every** numeral and
unit, so a figure always reads as a measurement.

## The landing page

`site/` is a static page under the same rules as the app: the grade ramp, the
three registers, and no colour but the photographs on the phones. It is plain
HTML and CSS with one script, so any static host serves it as is; open
`site/index.html` from disk and it works.

The centrepiece is the app icon brought to life. A day's meals type into a
ledger, the plate fills with their energy, and the forty-eight targets around
the bezel tick over as they are met; a dinner is swapped for a better fit,
the last two close, and the drawing settles into the icon. It is one SVG
drawn and driven by `site/main.js` from the same timeline every loop, so it
can be parked at any moment from the console with `gospelMeasure.hold(ms)`.

The pictures are the renders in `screenshots/mockups/`, which are 16000 × 12000
and mostly empty. `python scripts/build_site_assets.py` crops each to its
phones and writes it twice as WebP, for 1x and 2x screens, along with the
favicon and a link-preview card.

The download is a release APK, built and signed locally:

```bash
npm run apk
```

which runs `expo prebuild`, Gradle's `assembleRelease` for the two ARM ABIs,
and `apksigner`, and writes `site/download/gospel-<version>.apk` with its
SHA-256 beside it and a `build.js` the page reads for the file name, size and
checksum. Real phones are ARM, so the x86 emulator ABIs are left out; that is
most of the difference against a universal build.

The first run makes the signing key, `credentials/gospel-release.jks`, and
writes its password to `.env` as `GOSPEL_KEYSTORE_PASSWORD`. Both are
gitignored, and both are the app's identity: an APK signed with any other key
will not install over one signed with this, so back them up. Expo's own
template signs release builds with the shared Android debug key, which is why
the script re-signs.

The APK itself is gitignored too, at 116 MB, because GitHub refuses any file
over 100 MB. Serving `site/` from a host with no such limit works as is. To
serve it from the repository instead, attach the APK to a GitHub Release, put
that asset's address in `.env` as `GOSPEL_APK_URL`, and run
`npm run apk -- --manifest`: that rewrites `build.js` from the APK already on
disk, so the page links to the release and its checksum still describes the
file that was uploaded. Two builds are not byte-identical, which is why the
manifest is refreshed rather than the build repeated.

## Known limits

- **No recipe publishes its own nutrition.** A Cookbook page is a method, not a
  label, so every figure on a recipe card is computed from FoodData Central
  panels over the ingredient weights. Each recipe carries the share of its mass
  that matched a panel, and shows it; below 100% the figures understate by
  roughly that much.
- **Ingredient weights are estimates wherever the source did not weigh.**
  `scripts/measures.py` is that arithmetic and its assumptions are written down:
  a mass is exact, a volume is millilitres times a density, a count is a
  per-item weight. Only the first is a measurement.
- **Times, servings and difficulty are cook's estimates**, set by hand in
  `scripts/recipe_sources.py`. Neither source publishes them reliably.
- **There are no ratings.** No source the library is allowed to use has them,
  and inventing one would make it the only fabricated figure in the app.
- **Prices, shelf lives and pack sizes are estimates**, hand-curated by
  ingredient category in `scripts/ingredient_taxonomy.py`. They are good enough
  to rank options and pace a shopping list, not to quote a bill.
- **The carnivore and vegan ends of the spectrum are thin**, because a library
  built around five meat-eating cuisines is thin at both. The app says so during
  onboarding instead of quietly repeating four dishes.
- Gospel implements published intake guidance. It is not medical advice, and it
  does not model pregnancy, lactation, medication or disease.

## Testing

Two Jest projects. `domain` runs pure logic in Node. `ui` renders components
through react-native-web into jsdom, executing real component bodies.

Components built on `react-native-svg` are not render-tested — the package
resolves to its native TypeScript source under Jest. Their risk is the geometry,
which is pure and tested directly in `src/theme/__tests__/plot.test.ts`. `Plate`
used to be in that group and is not any more: dropping its colour filter also
dropped its dependency on SVG, so it renders and is tested like anything else.

`scripts/test_measures.py` is the third suite and the one that guards the
numbers. Every weight in the app is produced by `measures.py` turning a written
line into grams, so the cases there are the actual lines the Cookbook writes —
`"3-4 tablespoons extra-virgin olive oil"`, `"48 chicken wingettes"`,
`"1½ quarts skimmed or whole milk"` — pinned to the weights they should give.
Each one is a bug that shipped: a litre of frying oil counted as eaten, a
teaspoon of oregano read as a hundred grams, an adjective kept and the food it
described thrown away.
