# Field, images and depth — design

**Date:** 2026-08-26
**Status:** approved, pending implementation
**Builds on:** `docs/superpowers/specs/2026-08-25-ui-rebuild-design.md`

## Context

The monochrome rebuild shipped. Three problems surfaced from using it:

1. The graticule is a uniform full-bleed grid. Every rule, axis, bar edge and
   divider in the app is also a hairline, so the background competes with the
   foreground instead of sitting under it.
2. The recipe corpus carries image URLs that the generated subset drops. The
   app shows food without ever showing food.
3. Screens are too dense. Nutrition puts 48 targets on one scroll; recipe
   detail stacks stats, nutrition, ingredients, equipment and method.

## Goals

1. Replace the uniform grid with composed patches that never sit behind a mark.
2. Add recipe photography, rendered greyscale so the app stays monochrome.
3. Spread dense screens across routes and collapsible sections.

## Non-goals and invariants

- **`src/domain/` and `src/store/` stay untouched.** The 85 domain tests are
  again the proof that no number moved.
- **The recipe subset does not change.** `build_recipe_subset.py` stratifies a
  random sample; re-running it would return different recipes and invalidate
  every saved plan. Images are added to the existing 1,600 by id lookup.
- No new runtime dependencies. `react-native-svg` 15 exports `Image`, `Filter`
  and `FeColorMatrix`, which is all greyscale needs.
- No hue. Photographs are desaturated, not merely surrounded by monochrome.

## 1. The field

### 1.1 `src/theme/field.ts` (new)

Pure geometry and composition data, in the manner of `plot.ts`.

```ts
export type PatchKind = 'grid' | 'ticks' | 'cross' | 'rule';

export interface Patch {
  kind: PatchKind;
  /** Fractions of the viewport, so a composition scales rather than being
   *  re-tuned per device. */
  x: number; y: number; w: number; h: number;
}

export type FieldName =
  | 'landing' | 'plan' | 'dense' | 'list' | 'detail' | 'onboarding';

export const FIELDS: Record<FieldName, Patch[]>;

/** Resolve a composition to pixel-space patches for a given viewport. */
export interface PlacedPatch { kind: PatchKind; x: number; y: number; w: number; h: number; }
export function placeField(name: FieldName, width: number, height: number): PlacedPatch[];
```

**Placement rule, enforced by test:** every patch lies wholly within the outer
eighth of the page on at least one axis — `x + w <= 0.125`, `x >= 0.875`,
`y + h <= 0.125`, or `y >= 0.875`. A patch that sits in the middle of the
content column is a defect, and the test says so rather than leaving it to the
eye.

Compositions:

| Name | Used by | Patches |
|------|---------|---------|
| `landing` | `app/index.tsx` | large grid upper-left, tick run down the right margin |
| `plan` | plan tab | small grid top-right, one crosshair low-left |
| `dense` | nutrition, pantry | two small corner patches only |
| `list` | grocery | tick run under the header, grid patch at the foot |
| `detail` | recipe, nutrient, references, category pages | corner grid, one rule with an end tick |
| `onboarding` | onboarding | corner grid, tick run at the foot |

### 1.2 `src/ui/plot/Field.tsx` (replaces `Graticule`)

Renders a named composition. Keeps `Graticule`'s fade-up on mount and its
zero-size guard. `Screen` takes a `field?: FieldName` prop, defaulting to
`detail`; the `gridOpacity` prop is deleted, since density is now a property
of the composition rather than a dial at the call site.

`Graticule` and its use of `graticule()` are deleted. `graticule()` itself
stays in `plot.ts` — `Field` uses it to draw the `grid` patch kind.

## 2. Images

### 2.1 `scripts/add_recipe_images.py` (new)

Streams `data-source/recipes.csv` in chunks, keeps rows whose `RecipeId` is in
the existing `recipes.json`, parses the R-style `c("url", "url")` vector, and
writes the first URL into each recipe as `image`. Recipes with no usable URL
get `null`.

Measured coverage: **1,492 of 1,600 (93.2%)**.

The script rewrites `src/data/generated/recipes.json` in place, preserving
recipe order and every other field byte-for-byte. It is idempotent and is
documented as the only sanctioned way to touch that file without changing the
subset.

### 2.2 Type

`Recipe` in `src/domain/planner/types.ts` gains `image: string | null`.

This is the one permitted edit inside `src/domain/`, and it is a type-only
addition — no logic, no behaviour. Called out explicitly because the standing
invariant forbids domain edits; a field the planner never reads does not move
a number, and the domain suite proves it.

### 2.3 `src/ui/data/Plate.tsx` (new)

```ts
export function Plate(p: {
  uri: string | null;
  width: number;
  height: number;
  /** Rounded label shown when there is no image. */
  fallbackLabel?: string;
}): JSX.Element;
```

Renders the image inside an `<Svg>` through a `<Filter>` containing an
`<FeColorMatrix type="matrix">` using Rec. 709 luma coefficients:

```
0.2126 0.7152 0.0722 0 0
0.2126 0.7152 0.0722 0 0
0.2126 0.7152 0.0722 0 0
0      0      0      1 0
```

True perceptual greyscale, identical across iOS, Android and web, with no new
dependency. A null `uri` renders a ruled placeholder block of the same
dimensions, so a missing photo never changes the layout.

### 2.4 Where photos appear

- **Recipe detail** — a full-width hero above the title.
- **Plan tab** — a small square plate beside each meal row.

Nowhere else. Grocery and pantry are working documents and a photograph in a
shopping list is decoration.

## 3. Depth

### 3.1 `src/ui/layout/Disclosure.tsx` (new)

```ts
export function Disclosure(p: {
  label: string;
  /** Shown in the header, e.g. an item count or a subtotal. */
  meta?: string;
  defaultOpen?: boolean;
  index?: number;
  children: ReactNode;
}): JSX.Element;
```

Animated collapse driven by measured content height, timed through
`useMotion()` like every other animated primitive. The header carries a rotating
caret in the `label` register.

### 3.2 Nutrition splits into routes

- `app/(tabs)/nutrition.tsx` becomes an index: the energy plot, then six
  category rows, each showing `measured/total` and a summary bar of how many
  targets in that category are met. Tapping a row opens the category.
- `app/nutrition/[category].tsx` (new) renders that category's bars, with the
  same `NutrientBar` and `markFor` as now.

The energy plot stays on the index because it is the one genuinely
cross-cutting view.

### 3.3 Recipe detail collapses

Photo hero and the stat row stay always-visible. Per-portion nutrition stays
inline — six rows is not a burden. Ingredients and equipment become
`Disclosure`s, collapsed. Method becomes a `Disclosure`, **open by default**,
because it is what the page was opened for.

### 3.4 Grocery aisles collapse

Each aisle becomes a `Disclosure` showing its item count and subtotal. The
one-time setup and equipment lists likewise. A forty-line shop becomes a short
page opened one aisle at a time.

## 4. Testing

- Domain suite unchanged and green: 85 tests.
- `src/theme/__tests__/field.test.ts` — new. Every patch in every composition
  satisfies the outer-eighth rule; `placeField` scales fractions to pixels
  correctly; a zero-size viewport yields no patches.
- `src/ui/__tests__/render.test.tsx` — extended for `Disclosure` (opens,
  closes, respects `defaultOpen`, renders its meta).
- `Plate` and `Field` import `react-native-svg` and so cannot render under
  jsdom, per the limitation already documented at the head of the render
  suite. Their geometry is pure and covered in `field.test.ts`.

## 5. Build order

1. `field.ts` + tests, then `Field.tsx`, then repoint `Screen` and delete
   `Graticule`.
2. `add_recipe_images.py`, run it, add the `image` type field.
3. `Plate.tsx`, then the recipe hero and plan plates.
4. `Disclosure.tsx` + tests.
5. Nutrition index + category route.
6. Recipe and grocery disclosures.

Every step ends with `npm test` and `npm run typecheck` green, and a commit.

## 6. Risks

- **Remote images on a metered connection.** 1,492 URLs at `w_555,h_416`. The
  plan tab shows up to 28 plates at once on a 7-day cycle. Worth watching on a
  device; if it bites, the plan-tab plate is the first thing to drop.
- **`add_recipe_images.py` runtime.** A 704 MB CSV streamed in chunks. Minutes,
  not seconds, and it must be run with a generous timeout.
- **Measured-height collapse.** `Disclosure` needs an `onLayout` pass before it
  can animate to a known height. First open may be abrupt if the measurement
  has not landed; mitigate by measuring on mount while hidden.
