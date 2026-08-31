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
npm test             # 202 tests across two projects
python -m pytest scripts/   # 58 tests for the unit parser
npm run typecheck    # tsc --noEmit
```

## What it does

**Onboarding** asks twelve questions. Six of them drive nutrition and are exactly
the inputs `nutrient_targets.xlsx` defines — sex, age, weight, diet, activity and
sun exposure. The other six shape recipe selection: cuisines, difficulty, time
per meal, weekly budget, and how often the plan repeats.

**The plan** is solved on-device against your resolved targets, then repeats.
Same seed, same plan; regenerating is a deliberate act.

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
  nutrient/[id].tsx       Derivation, upper limits, citations

src/
  domain/
    nutrition/resolver.ts   48 targets from 6 inputs
    planner/planner.ts      Greedy fill + best-of-K hill climb
    pantry/depletion.ts     Quantity and shelf-life simulation
  data/generated/           Committed JSON, built by scripts/
  components/, theme/       UI and design tokens

scripts/
  build_nutrient_data.py     xlsx -> nutrition.json + golden_vectors.json
  recipe_sources.py          the hundred dishes, and where each comes from
  wikimedia.py               Cookbook, Wikipedia and Commons scraping
  measures.py                "3-4 tbsp olive oil" -> 41 g
  authored/                  the 29 recipes no permitted source publishes
  build_recipe_library.py    the above -> recipes.json + ingredients.json
  fetch_recipe_images.py     100 photographs -> assets/recipes/
  ingredient_taxonomy.py     Prices, shelf lives, pack sizes, diet flags
  build_app_icon.py          the app icon, drawn rather than painted
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

One hundred dishes, chosen rather than sampled: Japanese, Italian, American,
French and Spanish carry the library, with a scattering of everyday dishes from
elsewhere. `scripts/recipe_sources.py` is that decision in one table.

Nothing is bought or downloaded as a dataset. Each dish is assembled from three
public Wikimedia pages:

| | source | licence |
|---|---|---|
| ingredients and method, 71 of 100 | Wikibooks Cookbook | CC BY-SA 4.0 |
| description | Wikipedia | CC BY-SA 4.0 |
| photograph | Wikimedia Commons | per file, credited in-app |

The other 29 dishes — ramen, pho, shawarma, pizza margherita, pan con tomate —
have a Wikipedia article and a photograph but no Cookbook page with a real
method. Those recipes are written in `scripts/authored/` and every one is
labelled `authored` on screen, so a reader can tell which of the two they are
looking at.

**NYT Cooking is deliberately absent.** It was the first source asked for. Its
`robots.txt` disallows `anthropic-ai` and `ClaudeBot` outright, and its terms
prohibit scraping, text-and-data-mining and dataset creation. Nothing here
touches it.

Photographs are downloaded, resized and **bundled** rather than hotlinked, at
1000×600 for the recipe screen and 240×240 for the plan list — 12 MB for the
hundred. That keeps the app's no-network-calls claim true and means a recipe
cannot lose its picture to someone else's outage.

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
