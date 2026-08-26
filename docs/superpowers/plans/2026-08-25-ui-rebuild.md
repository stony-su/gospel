# Gospel UI Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Gospel's entire UI layer with a monochrome, mono-typeset, graph-paper instrument that animates every state change, built ground-up in a new `src/ui/` tree.

**Architecture:** A new foundation (`plot.ts` geometry, `motion.ts` timing, an additive monochrome token ramp) supports a fresh `src/ui/` component tree. Screens are rebuilt one at a time against it. The old `src/components/` tree and the old token exports are deleted last, once nothing imports them. `src/domain/` and `src/store/` are never touched.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router 57, Reanimated 4.5.1 + react-native-worklets, react-native-svg 15, IBM Plex Mono/Sans, Jest (two projects: `domain` node, `ui` jsdom via react-native-web), TypeScript 6.

**Spec:** `docs/superpowers/specs/2026-08-25-ui-rebuild-design.md`

## Global Constraints

- **Never modify `src/domain/**` or `src/store/**`.** The 101 domain tests must pass at the end of every task. If a task appears to require a domain change, stop and escalate.
- **No new runtime dependencies.** Everything needed is installed.
- **No hue.** Every colour in `src/ui/` comes from `grade[...]`. A hex literal or an `rgba()` with unequal channels in a new file is a defect.
- **No prose that is not a label, number, unit, or citation.** See spec §5.
- Every task ends with `npm test` (103+ passing) and `npm run typecheck` (clean) before its commit.
- Text registers are exactly: `display`, `title`, `heading`, `label`, `figure`, `figureSmall`, `prose`. No ad-hoc `fontSize` in `src/ui/`.
- Animated primitives read timing through `useMotion()`, never by importing `duration`/`spring` directly, so reduced-motion cannot be forgotten.
- Commit after every task. Branch first — do not commit to `master` directly.

## Deviation from spec

Spec §1.4 lists `hatchGeometry(bounds, angle, spacing)` in `plot.ts`. Task 7 implements `Hatch` as an SVG `<Pattern>` instead, which tiles automatically at any bar width — the stated reason for choosing a pattern in spec §2.2. The geometry helper is therefore unnecessary and is not built. No other spec requirement is affected.

---

## Phase 1 — Foundation

### Task 1: Plot geometry

Pure functions, no rendering. This is the only genuinely algorithmic code in the rebuild, and it gets real TDD.

**Files:**
- Create: `src/theme/plot.ts`
- Test: `src/theme/__tests__/plot.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
```ts
export interface Scale {
  (value: number): number;
  invert(pixel: number): number;
  domain: readonly [number, number];
  range: readonly [number, number];
}
export function linearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): Scale;

export function niceTicks(min: number, max: number, count?: number): number[];

export interface GraticuleLines {
  minorX: number[]; minorY: number[];
  majorX: number[]; majorY: number[];
}
export function graticule(
  width: number, height: number, minor?: number, major?: number,
): GraticuleLines;
```

- [ ] **Step 1: Write the failing test**

```ts
// src/theme/__tests__/plot.test.ts
import { graticule, linearScale, niceTicks } from '@/theme/plot';

describe('linearScale', () => {
  it('maps the domain onto the range', () => {
    const s = linearScale([0, 100], [0, 200]);
    expect(s(0)).toBe(0);
    expect(s(50)).toBe(100);
    expect(s(100)).toBe(200);
  });

  it('inverts', () => {
    const s = linearScale([0, 100], [0, 200]);
    expect(s.invert(100)).toBe(50);
  });

  it('handles an inverted range, as screen y-axes need', () => {
    const s = linearScale([0, 100], [200, 0]);
    expect(s(0)).toBe(200);
    expect(s(100)).toBe(0);
  });

  it('collapses a zero-width domain onto the range start rather than dividing by zero', () => {
    const s = linearScale([5, 5], [0, 200]);
    expect(Number.isFinite(s(5))).toBe(true);
    expect(s(5)).toBe(0);
  });
});

describe('niceTicks', () => {
  it('rounds to 1/2/5 x 10^n', () => {
    expect(niceTicks(0, 100, 5)).toEqual([0, 20, 40, 60, 80, 100]);
  });

  it('never emits a long fraction', () => {
    for (const t of niceTicks(0, 3.7142, 4)) {
      expect(String(t).replace('-', '').replace('.', '').length).toBeLessThanOrEqual(4);
    }
  });

  it('spans negative domains', () => {
    const ticks = niceTicks(-50, 50, 4);
    expect(ticks[0]).toBeLessThanOrEqual(-50);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(50);
    expect(ticks).toContain(0);
  });

  it('returns a single tick for a zero-width domain instead of looping forever', () => {
    expect(niceTicks(7, 7, 5)).toEqual([7]);
  });
});

describe('graticule', () => {
  it('spaces minor and major lines across the box', () => {
    const g = graticule(80, 40, 8, 40);
    expect(g.minorX).toEqual([0, 8, 16, 24, 32, 40, 48, 56, 64, 72, 80]);
    expect(g.minorY).toEqual([0, 8, 16, 24, 32, 40]);
    expect(g.majorX).toEqual([0, 40, 80]);
    expect(g.majorY).toEqual([0, 40]);
  });

  it('returns empty arrays for a zero-sized box', () => {
    const g = graticule(0, 0);
    expect(g.minorX).toEqual([]);
    expect(g.majorY).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx jest --selectProjects domain plot.test`
Expected: FAIL — `Cannot find module '@/theme/plot'`.

- [ ] **Step 3: Implement `src/theme/plot.ts`**

Write the module to satisfy exactly the tests above. Notes that matter:
- `linearScale`: guard `domain[1] - domain[0] === 0` by returning `range[0]`, which is what the zero-width test pins.
- `niceTicks`: compute a raw step of `(max - min) / count`, take `10 ** floor(log10(raw))`, then pick the first of `[1, 2, 5, 10]` whose product with that power is `>= raw`. Floor `min` and ceil `max` onto the resulting step. Return `[min]` when `max === min`.
- `graticule`: emit `0, spacing, 2*spacing, …` up to and including the bound when it lands exactly on it. Return empty arrays when `width <= 0 || height <= 0`.
- Give the file a header comment in the house style — see `src/theme/twine.ts` for the register to match.

- [ ] **Step 4: Run the test and verify it passes**

Run: `npx jest --selectProjects domain plot.test` → PASS.
Then `npm test` → all suites pass, and `npm run typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git checkout -b ui-rebuild
git add src/theme/plot.ts src/theme/__tests__/plot.test.ts
git commit -m "feat(theme): add plot geometry primitives"
```

---

### Task 2: Monochrome tokens, added alongside the old ones

**Critical:** this task is **additive**. `ink`, `text`, `signal`, `glow` and the old `type` registers stay exactly as they are, because all nine old components still import them. They are deleted in Task 21.

**Files:**
- Modify: `src/theme/tokens.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
```ts
export const grade: {
  0: '#000000';  5: '#060606';  10: '#0B0B0B'; 15: '#111111'; 20: '#171717';
  30: '#262626'; 35: '#303030'; 40: '#3D3D3D'; 50: '#565656'; 60: '#6E6E6E';
  70: '#909090'; 80: '#B4B4B4'; 90: '#D6D6D6'; 100: '#FFFFFF';
};
export const stroke: { hair: 0.5; thin: 1; medium: 1.5; heavy: 2 };
export const registers: {
  display:     { fontFamily: string; fontSize: 34; lineHeight: 40; letterSpacing: -1.5 };
  title:       { fontFamily: string; fontSize: 20; lineHeight: 28; letterSpacing: 0.5 };
  heading:     { fontFamily: string; fontSize: 14; lineHeight: 20; letterSpacing: 1 };
  label:       { fontFamily: string; fontSize: 10; lineHeight: 14; letterSpacing: 2 };
  figure:      { fontFamily: string; fontSize: 13; lineHeight: 18; letterSpacing: -0.2 };
  figureSmall: { fontFamily: string; fontSize: 11; lineHeight: 16; letterSpacing: 0 };
  prose:       { fontFamily: string; fontSize: 14; lineHeight: 22; letterSpacing: 0 };
};
export const sharp: { none: 0; sm: 2 };
```

Faces: `display`/`title` use `IBMPlexMono_600SemiBold`; `heading`/`label` use `IBMPlexMono_500Medium`; `figure`/`figureSmall` use `IBMPlexMono_400Regular`; `prose` uses `IBMPlexSans_400Regular`. Reuse the existing `font` object for these names — do not restate the strings.

The new names (`grade`, `stroke`, `registers`, `sharp`) deliberately avoid colliding with the old ones (`ink`, `text`, `type`, `radius`) so both can coexist. Task 21 renames `registers` → `type` and `sharp` → `radius` once the old ones are gone.

- [ ] **Step 1: Add the new exports**

Append to `src/theme/tokens.ts` under a new `// --- Monochrome rebuild ---` banner. Do not remove or edit anything already in the file.

- [ ] **Step 2: Verify nothing broke**

Run: `npm run typecheck` → clean. `npm test` → all pass. The app still renders the old UI unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/theme/tokens.ts
git commit -m "feat(theme): add monochrome grade ramp and mono type registers"
```

---

### Task 3: Motion tokens

**Files:**
- Create: `src/theme/motion.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
```ts
export const duration: { instant: 90; fast: 160; base: 240; slow: 420; reveal: 700 };
export const spring: { damping: 22; stiffness: 210; mass: 0.9 };
export const STAGGER = 40;
export function useMotion(): {
  duration: typeof duration;   // all zeros when reduced motion is on
  spring: typeof spring;
  stagger: number;             // 0 when reduced motion is on
  easing: { standard: EasingFn; decel: EasingFn; accel: EasingFn };
  enabled: boolean;
};
```

- [ ] **Step 1: Implement `src/theme/motion.ts`**

`useMotion()` calls Reanimated's `useReducedMotion()`. When it returns `true`, hand back a duration object with every value `0`, `stagger: 0`, and `enabled: false`; callers then still run the same code path but land on their target value immediately. Easings are `Easing.bezier(0.2, 0, 0, 1)` (standard), `Easing.bezier(0, 0, 0, 1)` (decel), `Easing.bezier(0.3, 0, 1, 1)` (accel).

Memoise the returned object on `reduced` so it is referentially stable — every animated primitive will put it in a dependency array.

- [ ] **Step 2: Verify**

Run: `npm run typecheck` → clean. No test yet; Task 4 proves it renders.

- [ ] **Step 3: Commit**

```bash
git add src/theme/motion.ts
git commit -m "feat(theme): add motion tokens and reduced-motion hook"
```

---

### Task 4: Jest wiring for `src/ui/` and Reanimated under jsdom

**This is the flagged risk.** Resolve it here, with one trivial component, before any primitive depends on it.

**Files:**
- Modify: `package.json` (the `jest.projects[1]` block — the `ui` project)
- Create: `src/ui/motion/Fade.tsx`
- Test: `src/ui/__tests__/motion.test.tsx`

**Interfaces:**
- Consumes: `useMotion` from Task 3.
- Produces: proof that Reanimated renders under jsdom; `Fade` is a throwaway probe deleted at the end of this task.

- [ ] **Step 1: Extend the `ui` project's testMatch**

In `package.json`, the `ui` project's `testMatch` becomes:

```json
"testMatch": [
  "<rootDir>/src/components/**/__tests__/**/*.test.tsx",
  "<rootDir>/src/ui/**/__tests__/**/*.test.tsx"
]
```

- [ ] **Step 2: Write the failing test**

```tsx
// src/ui/__tests__/motion.test.tsx
import { render, screen } from '@testing-library/react';

import { Fade } from '@/ui/motion/Fade';

describe('reanimated under jsdom', () => {
  it('renders an animated view', () => {
    render(<Fade>probe</Fade>);
    expect(screen.getByText('probe')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Write the probe component**

```tsx
// src/ui/motion/Fade.tsx
import type { ReactNode } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Text } from 'react-native';

import { useMotion } from '@/theme/motion';

export function Fade({ children }: { children: ReactNode }) {
  const motion = useMotion();
  const opacity = useSharedValue(0);
  opacity.value = withTiming(1, { duration: motion.duration.base });
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={style}>
      <Text>{children}</Text>
    </Animated.View>
  );
}
```

- [ ] **Step 4: Run the test and resolve the failure**

Run: `npx jest --selectProjects ui motion.test`

It will likely fail — Reanimated does not run under a bare jsdom environment. Resolve in this order, stopping at the first that works:

1. Add `react-native-reanimated` to the `ui` project's `transformIgnorePatterns` allowlist (it already allows `react-native-web|react-native-svg|@react-native|expo|@expo` — append `|react-native-reanimated|react-native-worklets`).
2. If it still fails, add `"setupFiles": ["<rootDir>/node_modules/react-native-reanimated/src/mock.ts"]` to the `ui` project — Reanimated ships a mock exactly for this.
3. If that conflicts with the `react-native` → `react-native-web` mapping, add an explicit `moduleNameMapper` entry pointing `^react-native-reanimated$` at a local mock in `src/test/reanimatedMock.ts`, following the `hapticsMock.ts` pattern already in the repo.

Record which option worked in a comment at the `ui` project's config, so the next person does not re-derive it.

Expected end state: PASS.

- [ ] **Step 5: Delete the probe**

Remove `src/ui/motion/Fade.tsx` and replace the body of `src/ui/__tests__/motion.test.tsx` with a skipped placeholder, or delete it — Task 6 writes the real motion tests. The jest config change is the deliverable; the probe was scaffolding.

- [ ] **Step 6: Verify and commit**

Run: `npm test` → all pass. `npm run typecheck` → clean.

```bash
git add package.json src/test/
git commit -m "test: wire src/ui into the jsdom project and get reanimated rendering"
```

---

## Phase 2 — Primitives

Every task in this phase follows the same shape: write the component(s), add a render smoke test to `src/ui/__tests__/render.test.tsx` (create it in Task 5, append thereafter), verify, commit. Follow the conventions and header-comment register of the existing `src/components/__tests__/render.test.tsx`.

### Task 5: Text registers

**Files:**
- Create: `src/ui/text/index.tsx`
- Test: `src/ui/__tests__/render.test.tsx`

**Interfaces:**
- Consumes: `grade`, `registers` from Task 2.
- Produces:
```ts
interface TextProps extends RNTextProps {
  children: ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
}
export function Display(p: TextProps): JSX.Element;   // grade[100]
export function Title(p: TextProps): JSX.Element;     // grade[100], uppercased at the component
export function Heading(p: TextProps): JSX.Element;   // grade[90],  uppercased at the component
export function Label(p: TextProps): JSX.Element;     // grade[60],  uppercased at the component
export function Figure(p: TextProps & { small?: boolean }): JSX.Element;  // grade[70]
export function Prose(p: TextProps): JSX.Element;     // grade[80]
```

`Title`, `Heading` and `Label` uppercase string children at the component, as the old `Eyebrow` did — call sites pass normal casing.

- [ ] **Step 1:** Write `src/ui/text/index.tsx`.
- [ ] **Step 2:** Write `src/ui/__tests__/render.test.tsx` with a `describe('text registers')` block rendering all six and asserting the uppercase transform on `Title`/`Heading`/`Label`.
- [ ] **Step 3:** `npx jest --selectProjects ui render.test` → PASS. `npm test`, `npm run typecheck` → clean.
- [ ] **Step 4:** Commit — `feat(ui): add mono text registers`.

---

### Task 6: Motion primitives

**Files:**
- Create: `src/ui/motion/Reveal.tsx`, `src/ui/motion/AnimatedNumber.tsx`, `src/ui/motion/MorphText.tsx`, `src/ui/motion/Press.tsx`, `src/ui/motion/index.ts`
- Modify: `src/ui/__tests__/render.test.tsx`

**Interfaces:**
- Consumes: `useMotion` (Task 3), text registers (Task 5).
- Produces:
```ts
export function Reveal(p: {
  children: ReactNode; index?: number; delay?: number; style?: StyleProp<ViewStyle>;
}): JSX.Element;

export function AnimatedNumber(p: {
  value: number; precision?: number; prefix?: string; suffix?: string;
  variant?: 'display' | 'figure' | 'figureSmall'; color?: string;
}): JSX.Element;

export function MorphText(p: {
  children: string; variant?: 'title' | 'heading' | 'label' | 'figure' | 'prose'; color?: string;
}): JSX.Element;

export function Press(p: {
  children: ReactNode; onPress: () => void; selected?: boolean;
  style?: StyleProp<ViewStyle>; accessibilityLabel?: string;
}): JSX.Element;
```

Behaviour notes:
- `Reveal` fades `0 → 1` and translates `12 → 0` on mount, delayed by `(index ?? 0) * motion.stagger + (delay ?? 0)`.
- `AnimatedNumber` holds a shared value, drives it with `withTiming` on `value` change, and renders through `useDerivedValue` + `useAnimatedProps` on an `Animated.createAnimatedComponent(TextInput)` — the standard way to animate text content in Reanimated, since `Text` children cannot be animated props. Render `editable={false}` and strip all `TextInput` chrome so it is visually identical to a `Figure`.
- `MorphText` cross-fades: on `children` change, fade out over `duration.fast`, swap, fade in over `duration.fast`.
- `Press` scales to `0.98` on press-in with `withSpring(motion.spring)` and back on press-out; when `selected`, a `grade[100]` rule sweeps in from the left over `duration.base`.

- [ ] **Step 1:** Write the four components and the barrel.
- [ ] **Step 2:** Append a `describe('motion primitives')` block: render each; for `AnimatedNumber` assert the initial value renders; for `MorphText` assert the text is present; for `Press` fire a press and assert the handler ran.
- [ ] **Step 3:** `npm test`, `npm run typecheck` → clean.
- [ ] **Step 4:** Commit — `feat(ui): add motion primitives`.

---

### Task 7: Plot components

**Files:**
- Create: `src/ui/plot/Graticule.tsx`, `src/ui/plot/Plot.tsx`, `src/ui/plot/Axis.tsx`, `src/ui/plot/Rule.tsx`, `src/ui/plot/Hatch.tsx`, `src/ui/plot/ProgressRail.tsx`, `src/ui/plot/index.ts`
- Modify: `src/ui/__tests__/render.test.tsx`

**Interfaces:**
- Consumes: `linearScale`, `niceTicks`, `graticule` (Task 1); `grade`, `stroke` (Task 2); `useMotion` (Task 3).
- Produces:
```ts
export function Graticule(p: {
  width: number; height: number; minor?: number; major?: number; opacity?: number;
}): JSX.Element | null;

export interface PlotScales { x: Scale; y: Scale; }
export function Plot(p: {
  width: number; height: number;
  xDomain: readonly [number, number]; yDomain: readonly [number, number];
  target?: number;
  children: (scales: PlotScales) => ReactNode;
}): JSX.Element | null;

export function Axis(p: {
  orientation: 'x' | 'y'; scale: Scale; length: number;
  ticks?: number; format?: (v: number) => string;
}): JSX.Element;

export function Rule(p: { y: number; width: number; dashed?: boolean; weight?: number }): JSX.Element;

export const HATCH_ID = 'gospel-hatch';
export function Hatch(): JSX.Element;   // renders <Defs><Pattern id={HATCH_ID}>…

export function ProgressRail(p: { total: number; answered: number; width: number }): JSX.Element;
```

Notes:
- `Plot` takes children as a **render prop** receiving the scales, so callers plot in data space without re-deriving the mapping.
- `Graticule` and `Plot` return `null` when `width <= 0 || height <= 0`, matching the guard already proven necessary in `SunMap`.
- `Hatch` is a `<Pattern>` of two `grade[100]` hairlines at 45°, tiled at 4pt. Consumers reference it as `fill={`url(#${HATCH_ID})`}`. Render `<Hatch />` once per `<Svg>` that uses it.
- `ProgressRail` draws `total` tick marks on a baseline; the first `answered` are `grade[100]` and full height, the rest `grade[40]` and half height. The transition springs.
- `Graticule` fades in over `duration.reveal` on mount.

- [ ] **Step 1:** Write the six components and the barrel.
- [ ] **Step 2:** Append a `describe('plot')` block. Note the existing suite's header explains that `react-native-svg` resolves to native source under jest — follow whatever that file currently does for SVG components. If SVG cannot render in this environment, assert on the pure geometry (already covered in Task 1) and keep the render assertions to the non-SVG wrappers, extending the header comment to say so.
- [ ] **Step 3:** `npm test`, `npm run typecheck` → clean.
- [ ] **Step 4:** Commit — `feat(ui): add graticule and plot components`.

---

### Task 8: Layout shell

**Files:**
- Create: `src/ui/layout/Screen.tsx`, `src/ui/layout/Header.tsx`, `src/ui/layout/Section.tsx`, `src/ui/layout/Row.tsx`, `src/ui/layout/Divider.tsx`, `src/ui/layout/index.ts`
- Modify: `src/ui/__tests__/render.test.tsx`

**Interfaces:**
- Consumes: text registers (5), `Reveal` (6), `Graticule` (7), tokens (2).
- Produces:
```ts
export function Screen(p: {
  children: ReactNode; scroll?: boolean; bottomInset?: number;
  contentStyle?: StyleProp<ViewStyle>;
}): JSX.Element;

export function Header(p: { title: string; refButton?: boolean; right?: ReactNode }): JSX.Element;
export function Section(p: { label: string; children: ReactNode; index?: number }): JSX.Element;
export function Row(p: { left: ReactNode; right?: ReactNode }): JSX.Element;
export function Divider(p: { weight?: number }): JSX.Element;
```

Notes:
- `Screen` keeps the existing `Screen.tsx` structure — safe-area padding, optional `ScrollView`, `GUTTER` horizontal padding — but grounds on `grade[0]` and renders `Graticule` behind the content instead of `TwineField`. There is no `plain` prop; the graticule is always on.
- `Header` renders the `title` in the `title` register above a `stroke.hair` `grade[40]` rule. When `refButton`, it renders `[ REF ]` in the `label` register at the right, routing to `/references` via `expo-router`'s `Link`.
- `Section` wraps its children in `Reveal` with the given `index`, so a screen's sections stagger by construction.

- [ ] **Step 1:** Write the five components and the barrel.
- [ ] **Step 2:** Append a `describe('layout')` block; assert `Header` renders `REF` when `refButton` and does not when omitted.
- [ ] **Step 3:** `npm test`, `npm run typecheck` → clean.
- [ ] **Step 4:** Commit — `feat(ui): add layout shell with graticule ground`.

---

### Task 9: Controls

**Files:**
- Create: `src/ui/controls/Option.tsx`, `Chip.tsx`, `Check.tsx`, `Segmented.tsx`, `Slider.tsx`, `Stepper.tsx`, `index.ts` (all under `src/ui/controls/`)
- Modify: `src/ui/__tests__/render.test.tsx`

**Interfaces:**
- Consumes: text (5), `Press`/`MorphText` (6), tokens (2).
- Produces:
```ts
export function Option(p: { label: string; meta?: string; selected: boolean; onPress: () => void }): JSX.Element;
export function Chip(p: { label: string; meta?: string; selected: boolean; onPress: () => void }): JSX.Element;
export function Check(p: { label: string; meta?: string; checked: boolean; onPress: () => void }): JSX.Element;
export function Segmented<T extends string | number>(p: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}): JSX.Element;
export function Slider(p: {
  value: number; min: number; max: number; step?: number;
  unit?: string; onChange: (v: number) => void;
}): JSX.Element;
export function Stepper(p: { value: number; min: number; max: number; onChange: (v: number) => void }): JSX.Element;
```

**`Option` has no `description` prop.** This is spec §5 enforced by the type — the old `OptionRow` accepted one and every call site passed prose. Removing it from the interface makes the text policy unskippable.

Notes:
- `Segmented`'s active indicator spring-slides between segments; do not cross-fade it.
- `Slider` rebuilds the old `InstrumentSlider` on the graticule: a hairline track, tick marks at `niceTicks` positions, and an `AnimatedNumber` readout that tracks the thumb.
- `Check` animates its mark drawing in rather than appearing.

- [ ] **Step 1:** Write the six components and the barrel.
- [ ] **Step 2:** Append a `describe('controls')` block; for each, render and fire the interaction, asserting the callback fires with the expected argument.
- [ ] **Step 3:** `npm test`, `npm run typecheck` → clean.
- [ ] **Step 4:** Commit — `feat(ui): add monochrome controls`.

---

### Task 10: Data components

**Files:**
- Create: `src/ui/data/NutrientBar.tsx`, `StatBlock.tsx`, `SunMap.tsx`, `DietSpectrum.tsx`, `mark.ts`, `index.ts` (all under `src/ui/data/`)
- Test: `src/ui/__tests__/mark.test.tsx` (new — `mark.ts` is pure and deserves its own assertions)
- Modify: `src/ui/__tests__/render.test.tsx`

**Interfaces:**
- Consumes: everything above; `ResolvedNutrient` from `@/domain/nutrition/types` (read-only).
- Produces:
```ts
export type Mark = 'hollow' | 'solid' | 'hatch' | 'inverted';
export function markFor(nutrient: ResolvedNutrient, intake: number): Mark;

export function NutrientBar(p: {
  name: string; unit: string; intake: number; target: number;
  mark: Mark; ul?: number | null; onPress?: () => void;
}): JSX.Element;

export function StatBlock(p: { label: string; value: number; unit?: string; precision?: number }): JSX.Element;

export function SunMap(p: {
  latitude: number | null; longitude: number | null;
  onPick: (latitude: number, longitude: number, zone: SunZoneRow) => void;
}): JSX.Element;

export function DietSpectrum(p: { value: number; onChange: (v: number) => void }): JSX.Element;
```

`markFor` precedence, highest first: `nutrient.over_ul` → `inverted`; `nutrient.approaching_ul` → `hatch`; `intake >= nutrient.value` → `solid`; otherwise `hollow`.

Rendering per spec §2.3:
- `hollow` — full-width track outlined `grade[40]` at `stroke.hair`; achieved fraction filled `grade[50]`.
- `solid` — achieved fraction filled `grade[100]`, track outline dropped.
- `hatch` — filled `grade[100]`, then overlaid with ``fill={`url(#${HATCH_ID})`}``, importing `HATCH_ID` from `@/ui/plot` rather than restating the string.
- `inverted` — filled `grade[100]`, value text knocked out in `grade[0]`, `stroke.heavy` rule at the UL position.

The fill width springs on change; the mark cross-fades on change. These are independent animations — do not couple them.

**`SunMap` must keep the finite-coordinate guard** from the current implementation: react-native-web yields `undefined` for `locationX`/`locationY` when the target's bounding rect is unavailable, which writes `NaN` into the store. Carry `if (!Number.isFinite(locationX) || !Number.isFinite(locationY)) return;` into the rebuild, with its comment.

- [ ] **Step 1:** Write `mark.ts` and its test first — it is pure and has four branches with a precedence order that is easy to get wrong.
- [ ] **Step 2:** `npx jest --selectProjects ui mark.test` → PASS.
- [ ] **Step 3:** Write the four components and the barrel.
- [ ] **Step 4:** Append a `describe('data')` block covering all four marks on `NutrientBar`.
- [ ] **Step 5:** `npm test`, `npm run typecheck` → clean.
- [ ] **Step 6:** Commit — `feat(ui): add nutrient bar with form-encoded status`.

---

## Phase 3 — Screens

Each screen task: rewrite the file against `src/ui/`, delete every import of `@/components/*` and of `ink`/`text`/`signal`/`type`/`radius`/`glow` from it, verify, commit. Screen logic (hooks, handlers, data selection) is preserved unless the task says otherwise — this is a visual rebuild, not a behavioural one.

### Task 11: Root layout and gate

**Files:**
- Modify: `app/_layout.tsx`, `app/index.tsx`

- [ ] **Step 1:** In `app/_layout.tsx`, delete the three `Newsreader_*` imports and their `useFonts` entries. Keep the six Plex faces and the per-weight subpath import style, including the comment explaining why the barrel is avoided.
- [ ] **Step 2:** Ground the root on `grade[0]`; set the `Stack` `screenOptions` to a custom fade-slide (`animation: 'fade'`, `contentStyle: { backgroundColor: grade[0] }`).
- [ ] **Step 3:** Leave `app/index.tsx`'s gate logic alone; restyle its loading state onto `Screen`.
- [ ] **Step 4:** `npm test`, `npm run typecheck` → clean. Launch the app and confirm it still boots to the old tabs.
- [ ] **Step 5:** Commit — `feat(app): drop the serif register and ground the root in black`.

### Task 12: Tabs shell

**Files:**
- Modify: `app/(tabs)/_layout.tsx`

- [ ] **Step 1:** Rebuild the tab bar as a hairline-ruled axis: `grade[0]` ground, `stroke.hair` `grade[40]` top rule, labels in the `label` register (`grade[60]` inactive, `grade[100]` active).
- [ ] **Step 2:** Replace the per-tab underline `View` with a single shared indicator that spring-slides between tabs. Measure tab widths with `onLayout`; drive `translateX` with `withSpring(motion.spring)`.
- [ ] **Step 3:** Keep the `StyleSheet.flatten` on the `TabList asChild` child — expo-router's Slot shim throws on an array style, on every platform.
- [ ] **Step 4:** `npm test`, `npm run typecheck` → clean.
- [ ] **Step 5:** Commit — `feat(tabs): rebuild the tab bar as a ruled axis`.

### Task 13: References page

**Files:**
- Create: `app/references.tsx`

**Interfaces:**
- Consumes: `sourcesById` and `dataset.sources` from `@/data/nutrition`; `Screen`, `Header`, `Divider`, text registers.

- [ ] **Step 1:** Build the page. Sort `dataset.sources` by `source_id`. Render each as: index `[01]`-style in the `label` register, `full_citation ?? citation` in `prose`, `year` and `url` in `figureSmall`, separated by `Divider`. Header reads `REFERENCES` with a `20 SOURCES` count in the `label` register.
- [ ] **Step 2:** Entries with a `url` open it via `Linking.openURL` inside a `Press`. **Entries without a `url` must not be pressable** — no `Press` wrapper, no press affordance.
- [ ] **Step 3:** Stagger entries in with `Reveal`.
- [ ] **Step 4:** `npm test`, `npm run typecheck` → clean. Navigate to `/references` and confirm all 20 render.
- [ ] **Step 5:** Commit — `feat(app): add the references page`.

### Task 14: Plan tab

**Files:** Modify `app/(tabs)/index.tsx`

- [ ] **Step 1:** Rebuild against `Screen`/`Header`/`Section`. `Header` gets `refButton`.
- [ ] **Step 2:** **Delete line 89's "The same meals every day."** and any other sentence that is not a label, number or unit.
- [ ] **Step 3:** Never render the recipe `description` field.
- [ ] **Step 4:** On regenerate, animate the meal list out and stagger it back in.
- [ ] **Step 5:** `npm test`, `npm run typecheck` → clean. Commit — `feat(plan): rebuild the plan tab`.

### Task 15: Nutrition tab

**Files:** Modify `app/(tabs)/nutrition.tsx`

- [ ] **Step 1:** Rebuild against `Screen`/`Header` (`refButton`) / `Plot` / `NutrientBar`, deriving each bar's `mark` via `markFor`.
- [ ] **Step 2:** Render `<Hatch />` once inside the screen's `Svg` so hatched bars resolve their pattern.
- [ ] **Step 3:** Headline figures use `AnimatedNumber`.
- [ ] **Step 4:** `npm test`, `npm run typecheck` → clean. **Check frame rate on a device build here** — a staggered list of animated numbers is the plausible drop site (spec §8). If it drops, cap concurrent `AnimatedNumber`s to the on-screen window.
- [ ] **Step 5:** Commit — `feat(nutrition): rebuild the nutrition tab on plots`.

### Task 16: Grocery tab

**Files:** Modify `app/(tabs)/grocery.tsx`

- [ ] **Step 1:** Rebuild against `Screen`/`Header` (`refButton`) / `Check` / `Section` / `Segmented` (for the cycle selector).
- [ ] **Step 2:** Check marks animate in; strikethrough sweeps rather than appears.
- [ ] **Step 3:** `npm test`, `npm run typecheck` → clean. Commit — `feat(grocery): rebuild the grocery tab`.

### Task 17: Pantry tab

**Files:** Modify `app/(tabs)/pantry.tsx`

- [ ] **Step 1:** Rebuild against `Screen`/`Header` (`refButton`), rendering the depletion projection as a step plot via `Plot` + `Axis` + `Rule`.
- [ ] **Step 2:** `npm test`, `npm run typecheck` → clean. Commit — `feat(pantry): rebuild the pantry tab as a step plot`.

### Task 18: Nutrient detail

**Files:** Modify `app/nutrient/[id].tsx`

- [ ] **Step 1:** Rebuild against `Screen`/`Header` (`refButton`) / `StatBlock` / `NutrientBar`.
- [ ] **Step 2:** **Replace the inline citation block** (currently lines ~243–256, rendering `full_citation ?? citation` in `Body`) with bracketed reference numbers in the `label` register that navigate to `/references`. Keep the `source_ids` collection logic exactly as it is — only the rendering changes.
- [ ] **Step 3:** `npm test`, `npm run typecheck` → clean. Commit — `feat(nutrient): rebuild detail and link citations to the references page`.

### Task 19: Recipe detail

**Files:** Modify `app/recipe/[id].tsx`

- [ ] **Step 1:** Rebuild against `Screen`/`Header`/`Section`/`Row`.
- [ ] **Step 2:** **Never render `recipe.description`.** This is the source of "Simple, easy, and tastes great" and "Great for lunches, picnics, cook outs, snacks, finger foods, etc." Leave the field on the type; simply do not read it.
- [ ] **Step 3:** `npm test`, `npm run typecheck` → clean. Commit — `feat(recipe): rebuild recipe detail and drop dataset blurbs`.

### Task 20: Onboarding

Largest screen at 573 lines. Last, so every primitive is proven before it lands.

**Files:** Modify `app/onboarding/index.tsx`

- [ ] **Step 1:** Rebuild against `Screen` / `ProgressRail` / `Option` / `Chip` / `Slider` / `Segmented` / `SunMap` / `DietSpectrum`.
- [ ] **Step 2:** Replace the twine progress rail with `ProgressRail` driven by answered-question count.
- [ ] **Step 3:** **Delete every question's `note` paragraph.** Where a note carries real information, compress it to one `label` line — the sun question becomes `LATITUDE ONLY`. Questions keep `title` only.
- [ ] **Step 4:** `Option` no longer accepts `description`; delete the prose at each call site rather than working around the type.
- [ ] **Step 5:** Step transitions cross-fade and slide.
- [ ] **Step 6:** `npm test`, `npm run typecheck` → clean. Walk the whole flow on a device and confirm it completes and writes a profile.
- [ ] **Step 7:** Commit — `feat(onboarding): rebuild onboarding on the new controls`.

---

## Phase 4 — Deletion

### Task 21: Delete the old UI and the old tokens

**Files:**
- Delete: `src/components/` (entire tree), `src/theme/twine.ts`, `src/theme/__tests__/twine.test.ts`
- Move: `src/components/__tests__/storeHooks.test.tsx` → `src/ui/__tests__/storeHooks.test.tsx`
- Modify: `src/theme/tokens.ts`, `package.json`

- [ ] **Step 1:** Move `storeHooks.test.tsx` to `src/ui/__tests__/` unchanged. It guards the zustand selector loop and has nothing to do with the visual work — it must survive.
- [ ] **Step 2:** Delete `src/components/`, `src/theme/twine.ts`, `src/theme/__tests__/twine.test.ts`.
- [ ] **Step 3:** Run `npm run typecheck`. Every remaining import of a deleted module is now a hard error — fix each by pointing at the `src/ui/` equivalent. A clean typecheck is the proof that nothing still depends on the old tree.
- [ ] **Step 4:** In `src/theme/tokens.ts`, delete `ink`, `text`, `signal`, `glow`, the old `type`, and the old `radius`. Rename `registers` → `type` and `sharp` → `radius`, and update `src/ui/` call sites.
- [ ] **Step 5:** In `package.json`, drop `<rootDir>/src/components/**/__tests__/**/*.test.tsx` from the `ui` project's `testMatch` — that directory no longer exists.
- [ ] **Step 6:** Run `npm test` — expect the 101 domain tests plus the `src/ui/` suites, all green. Run `npm run typecheck` → clean.
- [ ] **Step 7:** Grep for leftovers: `grep -rn "ink\.\|signal\.\|@/components\|twine" src app` should return nothing.
- [ ] **Step 8:** Commit — `refactor: delete the old component tree and token palette`.

---

## Verification checklist

Run before calling the rebuild done:

- [ ] `npm test` — 101 domain tests green, proving no number moved.
- [ ] `npm run typecheck` — clean.
- [ ] `grep -rn "@/components\|twine\|Newsreader\|signal\.\|ink\." src app` — no hits.
- [ ] Grep `src/ui` for hex literals: every colour resolves through `grade`.
- [ ] Walk onboarding end to end on a device build; confirm a profile is written.
- [ ] Visit all four tabs, both detail routes, and `/references`.
- [ ] Enable OS reduced-motion and confirm the app is fully usable with no animation.
- [ ] Confirm `hatch` and `inverted` bars are distinguishable at the narrowest bar width the nutrition list produces.
