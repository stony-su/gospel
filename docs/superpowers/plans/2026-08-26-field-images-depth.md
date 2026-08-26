# Field, Images and Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the uniform graticule with composed patches, add greyscale recipe photography, and break dense screens across routes and collapsible sections.

**Architecture:** A patch composition module (`field.ts`) drives a new `Field` background. A one-off script adds image URLs to the existing recipe subset without re-sampling it. A `Disclosure` primitive plus one new route split the two densest screens.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router 57, Reanimated 4.5.1, react-native-svg 15 (`Image` + `Filter` + `FeColorMatrix`), pandas for the data step.

**Spec:** `docs/superpowers/specs/2026-08-26-field-images-depth-design.md`

## Global Constraints

- **`src/domain/` and `src/store/` stay untouched, with exactly one exception:** adding `image: string | null` to `Recipe` in `src/domain/planner/types.ts` (Task 4). Type-only, no logic. The 85 domain tests must pass at the end of every task.
- **Never run `scripts/build_recipe_subset.py`.** It stratifies a random sample; a re-run returns different recipes and invalidates every saved plan.
- No new runtime dependencies.
- No hue. Photographs are desaturated, not merely surrounded by monochrome.
- Every colour in `src/ui/` comes from `grade[...]`.
- Animated primitives read timing through `useMotion()`.
- Every task ends with `npm test` and `npm run typecheck` green, then a commit. Work on branch `ui-rebuild` (already checked out) or a branch from it.

---

## Task 1: Field geometry

**Files:**
- Create: `src/theme/field.ts`
- Test: `src/theme/__tests__/field.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
```ts
export type PatchKind = 'grid' | 'ticks' | 'cross' | 'rule';
export interface Patch { kind: PatchKind; x: number; y: number; w: number; h: number }
export type FieldName = 'landing' | 'plan' | 'dense' | 'list' | 'detail' | 'onboarding';
export const FIELDS: Record<FieldName, Patch[]>;
export interface PlacedPatch { kind: PatchKind; x: number; y: number; w: number; h: number }
export function placeField(name: FieldName, width: number, height: number): PlacedPatch[];
```

- [ ] **Step 1: Write the failing test**

```ts
// src/theme/__tests__/field.test.ts
import { FIELDS, placeField, type FieldName } from '@/theme/field';

const NAMES = Object.keys(FIELDS) as FieldName[];

describe('field compositions', () => {
  it('defines every named composition', () => {
    expect(NAMES.length).toBeGreaterThan(0);
    for (const name of NAMES) expect(FIELDS[name].length).toBeGreaterThan(0);
  });

  // The whole point of the change: nothing may sit behind a bar or an axis.
  it('keeps every patch in the outer eighth on at least one axis', () => {
    for (const name of NAMES) {
      for (const p of FIELDS[name]) {
        const inMargin =
          p.x + p.w <= 0.125 || p.x >= 0.875 || p.y + p.h <= 0.125 || p.y >= 0.875;
        expect({ name, patch: p, inMargin }).toEqual({ name, patch: p, inMargin: true });
      }
    }
  });

  it('keeps every patch inside the viewport', () => {
    for (const name of NAMES) {
      for (const p of FIELDS[name]) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x + p.w).toBeLessThanOrEqual(1);
        expect(p.y + p.h).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('placeField', () => {
  it('scales fractions to pixels', () => {
    const placed = placeField('dense', 400, 800);
    for (const p of placed) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w).toBeLessThanOrEqual(400);
      expect(p.y + p.h).toBeLessThanOrEqual(800);
    }
  });

  it('returns nothing for a zero-size viewport', () => {
    expect(placeField('dense', 0, 0)).toEqual([]);
    expect(placeField('dense', 400, 0)).toEqual([]);
  });

  it('preserves patch count and kind', () => {
    const placed = placeField('landing', 400, 800);
    expect(placed).toHaveLength(FIELDS.landing.length);
    expect(placed.map((p) => p.kind)).toEqual(FIELDS.landing.map((p) => p.kind));
  });
});
```

- [ ] **Step 2: Run and verify it fails**

Run: `npx jest --selectProjects domain field.test` → FAIL, module not found.

- [ ] **Step 3: Implement `src/theme/field.ts`**

Six compositions per spec §1.1. Every patch must satisfy the outer-eighth rule the test enforces — write the compositions to the rule, do not relax the rule to fit a composition. `placeField` multiplies fractions by width/height and returns `[]` when either is `<= 0`.

- [ ] **Step 4: Verify** — `npx jest --selectProjects domain field.test` PASS, then `npm test` and `npm run typecheck`.
- [ ] **Step 5: Commit** — `feat(theme): add field patch compositions`.

---

## Task 2: The Field background

**Files:**
- Create: `src/ui/plot/Field.tsx`
- Modify: `src/ui/plot/index.ts`, `src/ui/layout/Screen.tsx`
- Delete: `src/ui/plot/Graticule.tsx`

**Interfaces:**
- Consumes: `placeField`, `graticule` (still exported from `plot.ts`), `useMotion`, tokens.
- Produces: `export function Field(p: { name: FieldName; width: number; height: number }): JSX.Element | null;`

- [ ] **Step 1:** Write `Field.tsx`. It renders each placed patch by kind:
  - `grid` — minor and major lines from `graticule(w, h)`, offset to the patch origin, `grade[30]` / `grade[35]` at `stroke.hair`.
  - `ticks` — a run of short marks along the patch's long edge, `grade[35]`.
  - `cross` — one crosshair with four short ticks at its arms, `grade[35]`.
  - `rule` — a hairline with a single end tick, `grade[35]`.

  Keep `Graticule`'s fade-up on mount (`duration.reveal`, `easing.decel`) and its `width <= 0 || height <= 0` guard.

- [ ] **Step 2:** In `Screen.tsx`, replace the `Graticule` render with `Field`, add `field?: FieldName` defaulting to `'detail'`, and **delete the `gridOpacity` prop**. Density now belongs to the composition.
- [ ] **Step 3:** Delete `Graticule.tsx` and drop it from `src/ui/plot/index.ts`; export `Field` instead.
- [ ] **Step 4:** `npm run typecheck` — it will fail at the two `gridOpacity` call sites (`(tabs)/nutrition.tsx`, `(tabs)/pantry.tsx`). Replace each with `field="dense"`.
- [ ] **Step 5:** Give every other screen its composition: `app/index.tsx` → `landing` (it renders `Graticule` directly, so switch it to `Field`), plan tab → `plan`, grocery → `list`, onboarding → `onboarding`. Recipe, nutrient and references keep the `detail` default.
- [ ] **Step 6:** Verify — `npm test`, `npm run typecheck`. Commit — `feat(ui): replace the uniform graticule with composed patches`.

---

## Task 3: Add image URLs to the recipe subset

**Files:**
- Create: `scripts/add_recipe_images.py`
- Modify: `src/data/generated/recipes.json` (by running the script)

- [ ] **Step 1: Write the script**

It must:
- Load `src/data/generated/recipes.json` and collect its ids into a set.
- Stream `data-source/recipes.csv` with `pandas.read_csv(..., usecols=['RecipeId','Images'], chunksize=200_000)`.
- Parse the R vector with `re.findall(r'"(https?://[^"]+)"', value)` and take the first match; `None` when there is none.
- Write `image` onto each recipe **in place**, preserving recipe order and every other field.
- Print coverage — expected `1492 / 1600`.
- Be idempotent: re-running overwrites `image` with the same value.
- **Never** import or call anything from `build_recipe_subset.py`.

- [ ] **Step 2: Run it**

```bash
python scripts/add_recipe_images.py
```

Expect minutes, not seconds — it streams a 704 MB CSV. Use a generous timeout.

- [ ] **Step 3: Verify the subset did not change**

```bash
git diff --stat src/data/generated/recipes.json
python -c "import json;d=json.load(open('src/data/generated/recipes.json',encoding='utf-8'));print(len(d), sum(1 for r in d if r.get('image')))"
```

Expected: 1600 recipes, 1492 with an image. If the recipe **count or ids** changed, the script is wrong — revert and fix, do not proceed.

- [ ] **Step 4:** `npm test` — the domain suite reads this file and must still pass. Commit — `data: add image urls to the recipe subset`.

---

## Task 4: The image type field

**Files:**
- Modify: `src/domain/planner/types.ts:41-...` (the `Recipe` interface)

- [ ] **Step 1:** Add `image: string | null;` to `Recipe`, directly under `description`, with a comment noting it is display-only and that the planner never reads it.
- [ ] **Step 2:** `npm run typecheck` and `npm test` — 85 domain tests must still pass, proving a type-only addition moved nothing.
- [ ] **Step 3:** Commit — `feat(domain): add a display-only image field to Recipe`.

---

## Task 5: Plate

**Files:**
- Create: `src/ui/data/Plate.tsx`
- Modify: `src/ui/data/index.ts`

**Interfaces:**
```ts
export function Plate(p: {
  uri: string | null;
  width: number;
  height: number;
  fallbackLabel?: string;
}): JSX.Element;
```

- [ ] **Step 1:** Implement with `Svg` + `Defs` + `Filter` + `FeColorMatrix` + `Image` from `react-native-svg`:

```tsx
<Svg width={width} height={height}>
  <Defs>
    <Filter id={filterId} colorInterpolationFilters="sRGB">
      <FeColorMatrix
        type="matrix"
        values="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0"
      />
    </Filter>
  </Defs>
  <Image
    href={{ uri }}
    x={0}
    y={0}
    width={width}
    height={height}
    preserveAspectRatio="xMidYMid slice"
    filter={`url(#${filterId})`}
  />
</Svg>
```

The filter id must be unique per instance — several plates render at once on the plan tab and a shared id would make them collide. Derive it from a `useId()`.

- [ ] **Step 2:** A null `uri` renders a `grade[15]` block with a `grade[40]` hairline border at the same dimensions, plus `fallbackLabel` in the `label` register at `grade[50]`. The layout must not shift between the two cases.
- [ ] **Step 3:** Export from the barrel. Verify — `npm test`, `npm run typecheck`. Commit — `feat(ui): add the greyscale Plate`.

---

## Task 6: Photos on the recipe and plan screens

**Files:**
- Modify: `app/recipe/[id].tsx`, `app/(tabs)/index.tsx`

- [ ] **Step 1:** Recipe detail — a full-width `Plate` above the title, `height = width * 0.6`, `fallbackLabel` the recipe name. Use `useWindowDimensions()` minus `GUTTER * 2`.
- [ ] **Step 2:** Plan tab — a 44×44 `Plate` at the head of each meal row, replacing nothing; the slot label moves beside it.
- [ ] **Step 3:** Verify — `npm test`, `npm run typecheck`. Commit — `feat(recipe,plan): show recipe photography`.

---

## Task 7: Disclosure

**Files:**
- Create: `src/ui/layout/Disclosure.tsx`
- Modify: `src/ui/layout/index.ts`, `src/ui/__tests__/render.test.tsx`

**Interfaces:**
```ts
export function Disclosure(p: {
  label: string;
  meta?: string;
  defaultOpen?: boolean;
  index?: number;
  children: ReactNode;
}): JSX.Element;
```

- [ ] **Step 1:** Implement. Content is rendered in an absolutely-positioned measuring view on mount so its height is known before the first open — see spec §6; animating to an unknown height makes the first open abrupt. Animate `height` and `opacity` through `useMotion()`. The header is a `Press` carrying the label, the meta, and a caret that rotates 90° when open.
- [ ] **Step 2:** Append a `describe('disclosure')` block to the render suite:

```tsx
it('starts closed and reveals its children when pressed', () => {
  render(
    <Disclosure label="Ingredients" meta="12">
      <Figure>olive oil</Figure>
    </Disclosure>,
  );

  expect(screen.getByText('INGREDIENTS')).toBeTruthy();
  expect(screen.getByText('12')).toBeTruthy();

  fireEvent.click(screen.getByText('INGREDIENTS'));
  expect(screen.getByText('olive oil')).toBeTruthy();
});

it('starts open when asked to', () => {
  render(
    <Disclosure label="Method" defaultOpen>
      <Figure>step one</Figure>
    </Disclosure>,
  );

  expect(screen.getByText('step one')).toBeTruthy();
});
```

Import `Disclosure` from `@/ui/layout/Disclosure`, not the barrel — the barrel reaches expo-router through `Header` and cannot load under jsdom.

- [ ] **Step 3:** Verify — `npm test`, `npm run typecheck`. Commit — `feat(ui): add the Disclosure primitive`.

---

## Task 8: Nutrition index and category route

**Files:**
- Modify: `app/(tabs)/nutrition.tsx`
- Create: `app/nutrition/[category].tsx`
- Modify: `app/_layout.tsx` (register the route)

- [ ] **Step 1:** Extract the shared pieces so both screens use one definition rather than two copies: move `CATEGORY_LABELS` and the `achievedFor` logic into `src/ui/data/nutrition.ts`, exporting `CATEGORY_LABELS` and `achievedForNutrient(plan, nutrient)`. Give it tests in `src/ui/__tests__/` covering the measured, derived fat-percentage, and unmeasurable branches.
- [ ] **Step 2:** Rewrite `(tabs)/nutrition.tsx` as an index: the energy `Plot`, then one `Press` row per category showing the label, `met/total`, and a summary bar. Tapping routes to `/nutrition/[category]`.
- [ ] **Step 3:** Write `app/nutrition/[category].tsx`: `Header` with the category label and `refButton`, then that category's `NutrientBar` list, and a close/back control. Register it in `app/_layout.tsx` alongside the other detail routes.
- [ ] **Step 4:** Verify — `npm test`, `npm run typecheck`. Commit — `feat(nutrition): split categories onto their own routes`.

---

## Task 9: Recipe and grocery disclosures

**Files:**
- Modify: `app/recipe/[id].tsx`, `app/(tabs)/grocery.tsx`

- [ ] **Step 1:** Recipe detail — ingredients and equipment become `Disclosure`s with item counts, collapsed. Method becomes a `Disclosure` with `defaultOpen`, meta `${n} steps`. The photo hero, stat row and per-portion nutrition stay always-visible.
- [ ] **Step 2:** Grocery — each aisle becomes a `Disclosure` with `meta` of `${n} · £${subtotal}`. One-time setup and equipment likewise. The summary rows at the top stay visible.
- [ ] **Step 3:** Verify — `npm test`, `npm run typecheck`. Commit — `feat(recipe,grocery): collapse long sections behind disclosures`.

---

## Verification checklist

- [ ] `npm test` — 85 domain tests green, proving no number moved.
- [ ] `npm run typecheck` — clean.
- [ ] `grep -rn --include=*.tsx "Graticule\|gridOpacity" src/ app/` — no hits.
- [ ] `grep -rn --include=*.ts --include=*.tsx -E "#[0-9a-fA-F]{6}" src/ui app/` — no hits.
- [ ] `npx expo export --platform web --output-dir <scratch>` succeeds.
- [ ] Recipe count still 1600, images 1492.
- [ ] On a device: photos render greyscale, not colour.
- [ ] On a device: no background patch sits behind a nutrient bar or a plot axis.
