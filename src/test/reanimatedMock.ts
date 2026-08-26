/**
 * Reanimated, stubbed for jsdom.
 *
 * The render suite runs components through react-native-web into jsdom, where
 * Reanimated has no native module. Its own shipped `mock.js` is not usable
 * here: it re-imports the real `src/index.ts`, which pulls the whole
 * initializer chain - and the TurboModule lookup - straight back in.
 *
 * So this stub resolves every animation to its final value immediately.
 * `withTiming(x)` simply returns `x`. That is the right behaviour for these
 * tests: they assert what a component renders, not how it travels, and a
 * settled component is the state worth asserting on. Anything that depends on
 * intermediate frames is not testable in this environment and belongs in the
 * pure-geometry suite instead.
 */

import { ScrollView, Text, View } from 'react-native';
import type { ComponentType } from 'react';

interface Shared<T> {
  value: T;
}

export function useSharedValue<T>(initial: T): Shared<T> {
  return { value: initial };
}

export function useAnimatedStyle<T>(factory: () => T): T {
  return factory();
}

export function useAnimatedProps<T>(factory: () => T): T {
  return factory();
}

export function useDerivedValue<T>(factory: () => T): Shared<T> {
  return { value: factory() };
}

/** Every animation helper collapses to its target value. */
export function withTiming<T>(toValue: T): T {
  return toValue;
}

export function withSpring<T>(toValue: T): T {
  return toValue;
}

export function withDelay<T>(_delay: number, animation: T): T {
  return animation;
}

export function withSequence<T>(...animations: T[]): T {
  return animations[animations.length - 1];
}

export function withRepeat<T>(animation: T): T {
  return animation;
}

export function cancelAnimation(): void {}

export function runOnJS<F extends (...args: never[]) => unknown>(fn: F): F {
  return fn;
}

export function runOnUI<F extends (...args: never[]) => unknown>(fn: F): F {
  return fn;
}

export function useReducedMotion(): boolean {
  return false;
}

export const Extrapolation = {
  CLAMP: 'clamp',
  EXTEND: 'extend',
  IDENTITY: 'identity',
} as const;

export function interpolate(
  value: number,
  input: readonly number[],
  output: readonly number[],
): number {
  if (input.length < 2 || input.length !== output.length) return output[0] ?? 0;

  for (let i = 0; i < input.length - 1; i += 1) {
    const [a, b] = [input[i], input[i + 1]];
    if (value >= a && value <= b) {
      const t = b === a ? 0 : (value - a) / (b - a);
      return output[i] + t * (output[i + 1] - output[i]);
    }
  }

  return value <= input[0] ? output[0] : output[output.length - 1];
}

const identity = (t: number) => t;

export const Easing = {
  bezier: () => identity,
  linear: identity,
  ease: identity,
  in: () => identity,
  out: () => identity,
  inOut: () => identity,
};

const Animated = {
  View,
  Text,
  ScrollView,
  createAnimatedComponent: <P,>(component: ComponentType<P>) => component,
};

export default Animated;
