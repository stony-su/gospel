# Gospel UI rebuild — design

**Date:** 2026-08-25
**Status:** approved, pending implementation plan

## Context

Gospel's UI layer is ~4,000 lines across 10 screens and 9 components. It is
coherent — a near-black ground, one magenta accent carrying nutrient status, a
braided "twine" mark used for backgrounds, charts and the onboarding rail, and
three typographic registers including a Newsreader italic "doctrine" voice.

It is being replaced. The target is an entirely monochrome, minimalist,
graph-paper instrument: many shades of black, mathematics-forward, animated
throughout, with the app's prose stripped back to labels, numbers, units and
citations.

The rebuild is ground-up. A new `src/ui/` layer is written against a new
foundation and the existing `src/components/` tree is deleted, rather than
restyling nine components in place. This avoids a long window where half the
app speaks the old design language and half the new.

## Goals

1. Entirely black and white. No hue anywhere in the interface.
2. Nutrient status encoded by **form** — fill, hatch, inversion — not colour.
3. Mono-first typography. Professional, technical, on a strict baseline grid.
4. A graticule/plot theme: graph paper, axes, tick marks, hairline rules.
5. Animation on every state change — tabs, numbers, text, bars, lists, routes.
6. Prose reduced to labels, numbers, units and citations.
7. One `[ REF ]` button opening a single formatted references page.

## Non-goals and invariants

- **`src/domain/` and `src/store/` are not touched.** No nutrition maths,
  planner logic, pantry simulation or persisted state changes. The 101 existing
  domain tests must stay green for the entire rebuild; they are the proof that
  a UI rewrite this large did not move a single number.
- The generated datasets under `src/data/generated/` are not regenerated.
- No new runtime dependencies. Reanimated 4.5.1, `react-native-worklets`,
  `react-native-svg` and the IBM Plex font packages are already installed, and
  `babel-preset-expo` wires the worklets plugin automatically.
- No change to routing structure beyond adding one route.

## 1. Foundation

### 1.1 `src/theme/tokens.ts` (rewritten)

A single neutral 14-stop ramp replaces `ink`, `text` and `signal`. Neutral
rather than the current faintly-cool black: cool greys read as "screen",
neutral reads as ink on paper, which is what a graticule wants.

| Stop | Hex | Role |
|------|-----|------|
| `grade[0]` | `#000000` | page ground |
| `grade[5]` | `#060606` | well |
| `grade[10]` | `#0B0B0B` | panel |
| `grade[15]` | `#111111` | raised |
| `grade[20]` | `#171717` | card |
| `grade[30]` | `#262626` | grid, minor |
| `grade[35]` | `#303030` | grid, major |
| `grade[40]` | `#3D3D3D` | rule |
| `grade[50]` | `#565656` | inert mark |
| `grade[60]` | `#6E6E6E` | faint text |
| `grade[70]` | `#909090` | tertiary text |
| `grade[80]` | `#B4B4B4` | secondary text |
| `grade[90]` | `#D6D6D6` | primary text |
| `grade[100]` | `#FFFFFF` | bright text, target met |

Also exported:

- `type` — the scale in §1.2.
- `space` — unchanged 4pt series (`xxs` 4 … `huge` 64).
- `radius` — collapses to `{ none: 0, sm: 2 }`. Sharp corners; `pill` is
  removed. Rounded shapes read as consumer software, not instrument.
- `stroke` — `{ hair: 0.5, thin: 1, medium: 1.5, heavy: 2 }`. Line weight is
  now a primary design variable and needs to be nameable.
- `GUTTER` — unchanged at 24.

`glow()` is deleted. There is nothing left to glow.

### 1.2 Typography

IBM Plex Mono carries titles, labels, figures and readouts. IBM Plex Sans 400
survives only for running prose, of which little remains after §5. Newsreader
is deleted, dropping three font files from the bundle.

| Register | Face | Size/Line | Tracking | Use |
|----------|------|-----------|----------|-----|
| `display` | Mono 600 | 34/40 | −1.5 | headline numbers |
| `title` | Mono 600 | 20/28 | +0.5 | screen titles, uppercase |
| `heading` | Mono 500 | 14/20 | +1.0 | section heads, uppercase |
| `label` | Mono 500 | 10/14 | +2.0 | eyebrows, axis labels, uppercase |
| `figure` | Mono 400 | 13/18 | −0.2 | inline measured values |
| `figureSmall` | Mono 400 | 11/16 | 0 | dense tables, tick labels |
| `prose` | Sans 400 | 14/22 | 0 | the only non-mono register |

Every line height is a multiple of 4 so text aligns to the graticule's minor
grid.

Font loading in `app/_layout.tsx` drops the three Newsreader imports and keeps
the six Plex faces, still imported from per-weight subpaths.

### 1.3 `src/theme/motion.ts` (new)

```
duration  instant 90 · fast 160 · base 240 · slow 420 · reveal 700
easing    standard cubic(0.2, 0, 0, 1) · decel cubic(0, 0, 0, 1) · accel cubic(0.3, 0, 1, 1)
spring    { damping: 22, stiffness: 210, mass: 0.9 }
stagger   40
```

Exports a `useMotion()` hook wrapping Reanimated's `useReducedMotion()`, which
returns durations collapsed to 0 and springs replaced by immediate assignment
when the OS asks for reduced motion. Every animated primitive reads its timing
through this hook rather than importing the constants directly, so the
accessibility path cannot be forgotten at a call site.

### 1.4 `src/theme/plot.ts` (new, replaces `src/theme/twine.ts`)

Pure geometry, no rendering — the same discipline `twine.ts` had.

- `linearScale(domain, range)` → mapping fn plus its inverse.
- `niceTicks(min, max, count)` → tick values rounded to 1/2/5×10ⁿ, the standard
  axis-rounding algorithm, so axes never show `3.7142`.
- `graticule(width, height, minor, major)` → minor and major line coordinate
  arrays.
- `hatchGeometry(bounds, angle, spacing)` → the 45° hairline set backing the
  approaching-UL fill.

`src/theme/twine.ts` and `src/theme/__tests__/twine.test.ts` are deleted; the
geometry suite is replaced by `src/theme/__tests__/plot.test.ts` covering the
same ground for the new primitives. That layer keeps its test coverage rather
than silently losing it in the rewrite.

## 2. `src/ui/` — the new component layer

Built fresh. `src/components/` is deleted once every screen has migrated.

```
src/ui/
  text/       Display · Title · Heading · Label · Figure · Prose
  motion/     Reveal · AnimatedNumber · MorphText · Press
  plot/       Graticule · Plot · Axis · Rule · Hatch · ProgressRail
  controls/   Option · Chip · Check · Segmented · Slider · Stepper
  layout/     Screen · Header · Section · Row · Divider
  data/       NutrientBar · StatBlock · SunMap · DietSpectrum
```

### 2.1 Motion primitives

Three components do most of the animation work; screens rarely touch
Reanimated directly.

- **`AnimatedNumber`** — interpolates between old and new value on change and
  renders through `Figure`/`Display`. Numbers are what this app is about, so
  they never cut. Takes `value`, `precision`, `duration`.
- **`Reveal`** — stagger wrapper. Children fade in and rise 12pt, `stagger`ms
  apart, on mount. Used for every screen's section list.
- **`MorphText`** — cross-fades on content change so a changing label never
  snaps.
- **`Press`** — pressable wrapper applying a 0.98 press scale and an optional
  selection rule that sweeps in from the left.

### 2.2 Plot primitives

- **`Graticule`** — graph paper. Minor rules every 8pt at `grade[30]`, major
  every 40pt at `grade[35]`, both `stroke.hair`. Fades up on mount. Sits behind
  every screen, replacing `TwineField`.
- **`Plot`** — a chart frame with gridlines, axes, tick marks, domain labels
  and dashed target rules.
- **`Axis`**, **`Rule`** — tick/label rendering and the dashed reference rule.
- **`Hatch`** — an SVG `<Pattern>` of 45° hairlines. A real pattern rather than
  drawn lines so the fill survives at any bar width.

### 2.3 Status encoding

`NutrientBar` takes a `mark` derived from the resolver's existing fields —
never a colour:

| Mark | Condition | Rendering |
|------|-----------|-----------|
| `hollow` | under target | full-width track outlined in `grade[40]`; the achieved fraction filled `grade[50]` |
| `solid` | target met | achieved fraction filled `grade[100]`, track outline dropped |
| `hatch` | `approaching_ul` | filled, then overlaid with `Hatch` |
| `inverted` | `over_ul` | filled white, value knocked out in `grade[0]`, heavy rule at the UL |

The state cross-fades when it changes; the bar width springs independently.

## 3. Screens

Each is rebuilt against `src/ui/`, not edited.

| Route | Notes |
|-------|-------|
| `app/_layout.tsx` | font set trimmed; custom fade-slide stack transitions |
| `app/index.tsx` | onboarding gate; unchanged logic |
| `app/onboarding/index.tsx` | largest screen at 573 lines; `note` prose removed per §5; progress becomes `ProgressRail`, a segmented axis of seven ticks filling as answers land |
| `app/(tabs)/_layout.tsx` | tab bar as a hairline-ruled axis; underline indicator spring-slides between tabs; cross-fade on switch |
| `app/(tabs)/index.tsx` | plan; regeneration wipes the meal list out and staggers it back in |
| `app/(tabs)/nutrition.tsx` | `Plot` + `NutrientBar` list |
| `app/(tabs)/grocery.tsx` | checklist; check marks animate |
| `app/(tabs)/pantry.tsx` | depletion projection as a step plot |
| `app/nutrient/[id].tsx` | inline citations replaced by reference numbers linking to §4 |
| `app/recipe/[id].tsx` | `description` never rendered (§5) |
| `app/references.tsx` | **new**, §4 |

`SunMap` and `DietSpectrum` are real inputs and survive as `src/ui/data/`
components, rebuilt onto the graticule.

## 4. References

Reached by a single `[ REF ]` button in the header rule, set in the `label`
register. It appears on the four tab screens and on nutrient detail — the
screen whose inline citations it replaces — and nowhere else. Recipe detail,
onboarding and the references page itself do not carry it.

The dataset already carries 20 `SourceRow`s (`source_id`, `citation`,
`full_citation`, `year`, `url`), and nutrient, modifier and equation rows all
carry `source_ids`. The page is fed by that data, not a hand-written list.

Layout: entries numbered `[01]`–`[20]`, ordered by `source_id`, separated by
hairline rules. Index in `label`, citation in `prose`, year and URL in
`figureSmall`. Tapping an entry with a `url` opens it via `Linking.openURL`;
entries without one are inert and must not render as tappable. Header shows
`REFERENCES` and a `20 SOURCES` count.

`app/nutrient/[id].tsx` stops printing full citations inline and shows only the
bracketed reference numbers, which navigate here.

## 5. Text policy

**If a string is not a label, a number, a unit, or a citation, it is a
deletion candidate.**

Specific removals:

- `app/(tabs)/index.tsx:89` — "The same meals every day."
- Recipe `description` is never rendered. This is where "Simple, easy, and
  tastes great" and "Great for lunches, picnics, cook outs, snacks, finger
  foods, etc." live. It is dataset copy, so it cannot be fixed at the source —
  the field stays in the type and goes unread by the UI.
- Onboarding questions keep `title`; `note` paragraphs are removed, compressed
  to a single `label` line only where they carry real information (the sun
  question becomes `LATITUDE ONLY`).
- `OptionRow` drops `description`, keeping label and meta figure.
- The `Doctrine` register is removed entirely, motto included.

## 6. Testing

- **Domain suite unchanged and green throughout.** 101 tests across
  `src/domain/` and `src/theme/`. This is the rebuild's safety net.
- **`src/theme/__tests__/plot.test.ts`** — new, pure geometry: scale mapping
  and inversion, `niceTicks` rounding across decades and degenerate ranges
  (zero-width domain, negative domains), graticule line counts.
- **`src/ui/__tests__/render.test.tsx`** — render smoke over every primitive,
  following the existing `render.test.tsx` conventions.
- **`src/components/__tests__/storeHooks.test.tsx`** — moves to
  `src/ui/__tests__/`, unchanged in substance. It guards the zustand selector
  loop and is unrelated to the visual work.

Two jest config changes in `package.json` are required and must land before the
first `src/ui/` test:

1. The `ui` project's `testMatch` currently covers only
   `src/components/**/__tests__/**/*.test.tsx`; it must cover
   `src/ui/**/__tests__/**/*.test.tsx` as well.
2. The `ui` project maps `react-native` → `react-native-web` under jsdom.
   Reanimated needs either its own jest setup or a mock alias added to
   `moduleNameMapper` for animated primitives to render in that environment.
   This is the one integration point in the rebuild with a real chance of
   fighting back, and the plan should resolve it early rather than discover it
   at the first `AnimatedNumber` test.

## 7. Build order

1. **Foundation** — `tokens.ts`, `motion.ts`, `plot.ts` + `plot.test.ts`.
   Nothing visible changes; the app still runs on the old components.
2. **Jest wiring** — the two `package.json` changes above, proven by one
   trivial animated-primitive test.
3. **`src/ui/` primitives** — text, motion, plot, layout, controls, data, with
   render smoke tests as each lands.
4. **Screens** — rebuilt one at a time against `src/ui/`. Order: `_layout`,
   `index` (the gate), tabs shell, the four tabs, `references.tsx`, nutrient
   detail (which links to it), recipe detail, then onboarding — largest, and
   last.
5. **Deletion** — `src/components/`, `src/theme/twine.ts`,
   `src/theme/__tests__/twine.test.ts`. Typecheck proves nothing still imports
   them.

Steps 1–3 leave the app running on the old UI. The app is visually mid-rebuild
only during step 4, and every step ends with `npm test` and `npm run typecheck`
green.

## 8. Risks

- **Reanimated under jsdom** (§6). Highest-probability blocker. Mitigated by
  resolving it at step 2, before any primitive depends on it.
- **Scale.** ~4,000 lines rewritten. Mitigated by the untouched domain layer
  and by rebuilding into a new directory, so the tree is never in a
  half-migrated state that neither typechecks nor renders.
- **Animation cost on device.** Reanimated 4 runs on the UI thread, but a
  staggered list of animated numbers on the nutrition screen is the plausible
  frame-drop site. Worth measuring on the phone build once the nutrition tab
  lands rather than at the end.
- **Monochrome legibility of the UL warning.** `hatch` and `inverted` must stay
  distinguishable at small bar widths and in bright sunlight. If they do not,
  the fallback is the third option already discussed — a single accent reserved
  for a UL breach — but this is not being built speculatively.
