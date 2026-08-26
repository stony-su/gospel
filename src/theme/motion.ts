/**
 * Motion tokens.
 *
 * Nothing in the interface changes state instantly. A number that jumps is a
 * number you have to re-read; a number that travels tells you which way it
 * went and roughly how far, before you have finished looking at it.
 *
 * Every animated primitive reads its timing from `useMotion()` rather than
 * importing the constants below directly. That is the whole point of the
 * hook: it is the single place reduced-motion is honoured, so no call site
 * can forget it. The shape it returns is identical either way, so components
 * run the same code path and simply land on their target immediately.
 */

import { useMemo } from 'react';
import { Easing, useReducedMotion } from 'react-native-reanimated';

export const duration = {
  instant: 90,
  fast: 160,
  base: 240,
  slow: 420,
  reveal: 700,
} as const;

export const spring = {
  damping: 22,
  stiffness: 210,
  mass: 0.9,
} as const;

/** Milliseconds between successive children in a staggered reveal. */
export const STAGGER = 40;

export const easing = {
  /** Almost everything. Fast out of the gate, long settle. */
  standard: Easing.bezier(0.2, 0, 0, 1),
  /** Entrances. */
  decel: Easing.bezier(0, 0, 0, 1),
  /** Exits. */
  accel: Easing.bezier(0.3, 0, 1, 1),
} as const;

/** Widened shapes: the exported constants are `as const`, but the reduced
 *  variants carry different values and must satisfy the same contract. */
export interface DurationScale {
  instant: number;
  fast: number;
  base: number;
  slow: number;
  reveal: number;
}

export interface SpringConfig {
  damping: number;
  stiffness: number;
  mass: number;
}

export interface Motion {
  duration: DurationScale;
  spring: SpringConfig;
  stagger: number;
  easing: typeof easing;
  /** False when the OS has asked for reduced motion. */
  enabled: boolean;
}

const STILL: DurationScale = {
  instant: 0,
  fast: 0,
  base: 0,
  slow: 0,
  reveal: 0,
};

/**
 * Timing for one component, with reduced motion already applied.
 *
 * The returned object is stable for as long as the OS preference is, because
 * callers put it in dependency arrays and in worklet closures.
 */
export function useMotion(): Motion {
  const reduced = useReducedMotion();

  return useMemo(
    () => ({
      // Zero-duration timings still run - they just complete on the first
      // frame - so an animated value always ends up where it should be.
      duration: reduced ? STILL : duration,
      // Overdamped past the point of visible travel, for the same reason.
      spring: reduced ? { damping: 200, stiffness: 1000, mass: 0.1 } : spring,
      stagger: reduced ? 0 : STAGGER,
      easing,
      enabled: !reduced,
    }),
    [reduced],
  );
}
