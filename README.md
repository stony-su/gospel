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
npm test             # 101 tests across two projects
npm run typecheck    # tsc --noEmit
```

## What it does

**Onboarding** asks twelve questions. Six of them drive nutrition and are exactly
the inputs `nutrient_targets.xlsx` defines — sex, age, weight, diet, activity and
sun exposure. The other six shape recipe selection: cuisines, difficulty, time
per meal, weekly budget, and how often the plan repeats.

**The plan** is solved on-device against your resolved targets, then repeats.
Same seed, same plan; regenerating is a deliberate act.

**Nutrition** shows all 48 targets against what the plan delivers. Six can be
measured from the recipe data. The other 42 need FoodData Central, and say so
rather than showing an invented number.

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
  build_nutrient_data.py    xlsx  -> nutrition.json + golden_vectors.json
  build_recipe_subset.py    704MB -> 1,600 curated recipes
  ingredient_taxonomy.py    Prices, shelf lives, pack sizes, diet flags
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

### Regenerating the data

The source files live in `data-source/` and are gitignored for size. With them
in place:

```bash
python scripts/build_nutrient_data.py
python scripts/build_recipe_subset.py --target 1600
```

The recipe filter keeps rows with a rating ≥ 4.0 and ≥ 8 reviews, ingredient and
quantity lists of equal length, 3–16 ingredients, ≤ 180 minutes, and usable
nutrition, then stratifies across cuisine × meal slot. About 2% of the corpus
survives.

## Design

Near-black throughout, with a ten-step ink scale. One accent —
**phenolphthalein magenta** — and it only appears at the endpoint: a nutrient bar
is grey while short of target and *turns* when it arrives, the way an acid-base
indicator does at a titration endpoint. Amber and red are reserved strictly for
the workbook's approaching-UL and over-UL states. Every colour clears WCAG AA
against the surface, and the status trio separates at ΔE 12 under deuteranopia.

The twining motif is two braided strands — reference and achieved — crossing
where the plan meets its target. Ambient in backgrounds, converging on the
onboarding rail, and carrying real data on the energy chart.

Three type registers for the three things the app is: Newsreader italic for
doctrine, IBM Plex Sans for interface, IBM Plex Mono for **every** numeral and
unit, so a figure always reads as a measurement.

## Known limits

- **42 of 48 nutrients have no intake data.** The recipe corpus publishes nine
  nutrients per serving; micronutrients need FoodData Central. The UI marks them
  `awaiting FDC` rather than estimating.
- **Prices, shelf lives and pack sizes are estimates**, hand-curated by
  ingredient category in `scripts/ingredient_taxonomy.py`. They are good enough
  to rank options and pace a shopping list, not to quote a bill.
- **Ingredient weights are inferred.** The dataset stores quantities without
  units, so a bare number is read as a count and converted via a per-unit weight
  table.
- **The carnivore end of the spectrum is thin** — 16 compatible recipes, because
  almost nothing in the corpus is purely animal products. The app says so during
  onboarding instead of quietly repeating four dishes.
- Gospel implements published intake guidance. It is not medical advice, and it
  does not model pregnancy, lactation, medication or disease.

## Testing

Two Jest projects. `domain` runs pure logic in Node. `ui` renders components
through react-native-web into jsdom, executing real component bodies.

Components built on `react-native-svg` are not render-tested — the package
resolves to its native TypeScript source under Jest. Their risk is the geometry,
which is pure and tested directly in `src/theme/__tests__/twine.test.ts`.
