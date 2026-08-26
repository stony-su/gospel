/**
 * Application state.
 *
 * Three things are persisted: the onboarding answers, the generated plan, and
 * what the user has ticked off. Everything else - resolved targets, the
 * grocery projection, the pantry ledger - is derived on demand, because
 * deriving is cheap and stale derived state is a bug factory.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { ingredientPanels } from '@/data/ingredientNutrition';
import { ingredientsById, recipes, recipesById } from '@/data/recipes';
import { averageDailyIntake, type IntakeResult } from '@/domain/nutrition/intake';
import { resolveTargets } from '@/domain/nutrition/resolver';
import type {
  ActivityLevel,
  DietType,
  NutritionProfile,
  ResolvedTargets,
  Sex,
  SunZone,
} from '@/domain/nutrition/types';
import { simulatePantry } from '@/domain/pantry/depletion';
import type { PantrySimulation } from '@/domain/pantry/types';
import {
  buildPlan,
  consumptionForPlan,
  equipmentForPlan,
} from '@/domain/planner/planner';
import type {
  CycleLength,
  MealPlan,
  MealSlot,
  PlanPreferences,
} from '@/domain/planner/types';

/** How many cycles ahead the grocery projection looks. */
const PROJECTION_CYCLES = 8;

export interface OnboardingAnswers {
  sex: Sex | null;
  weight_kg: number | null;
  age_years: number | null;
  diet_type: DietType | null;
  /** Continuous position on the diet spectrum, as animal food fraction. */
  animal_food_fraction: number | null;
  activity_level: ActivityLevel | null;
  sun_zone: SunZone | null;
  latitude: number | null;
  longitude: number | null;
  cuisines: string[];
  maxDifficulty: number | null;
  maxMinutes: number | null;
  weeklyBudget: number | null;
}

const EMPTY_ANSWERS: OnboardingAnswers = {
  sex: null,
  weight_kg: null,
  age_years: null,
  diet_type: null,
  animal_food_fraction: null,
  activity_level: null,
  sun_zone: null,
  latitude: null,
  longitude: null,
  cuisines: [],
  maxDifficulty: null,
  maxMinutes: null,
  weeklyBudget: null,
};

interface GospelState {
  answers: OnboardingAnswers;
  onboardingComplete: boolean;
  cycleDays: CycleLength;
  mealsPerDay: MealSlot[];
  plan: MealPlan | null;
  /** Grocery ticks, keyed `${scope}:${itemId}` where scope is a cycle index, 'setup' or 'equipment'. */
  checked: Record<string, boolean>;
  /** Which cycle of the plan the user is currently shopping for. */
  activeCycle: number;

  setAnswer: <K extends keyof OnboardingAnswers>(
    key: K,
    value: OnboardingAnswers[K],
  ) => void;
  setCycleDays: (days: CycleLength) => void;
  setMealsPerDay: (slots: MealSlot[]) => void;
  completeOnboarding: () => void;
  regeneratePlan: (seed?: number) => void;
  toggleChecked: (scope: number | string, itemId: string) => void;
  clearChecked: (cycleIndex: number) => void;
  setActiveCycle: (cycleIndex: number) => void;
  reset: () => void;
}

/** The six nutrition inputs, or null when onboarding is incomplete. */
export function profileFrom(answers: OnboardingAnswers): NutritionProfile | null {
  if (
    !answers.sex ||
    answers.weight_kg === null ||
    answers.age_years === null ||
    !answers.diet_type ||
    !answers.activity_level ||
    !answers.sun_zone
  ) {
    return null;
  }

  return {
    sex: answers.sex,
    weight_kg: answers.weight_kg,
    age_years: answers.age_years,
    diet_type: answers.diet_type,
    activity_level: answers.activity_level,
    sun_zone: answers.sun_zone,
    ...(answers.animal_food_fraction !== null
      ? { animal_food_fraction: answers.animal_food_fraction }
      : {}),
  };
}

export function preferencesFrom(
  answers: OnboardingAnswers,
  mealsPerDay: MealSlot[],
): PlanPreferences {
  return {
    cuisines: answers.cuisines,
    maxDifficulty: answers.maxDifficulty ?? 3,
    maxMinutes: answers.maxMinutes ?? 45,
    weeklyBudget: answers.weeklyBudget ?? 70,
    mealsPerDay,
  };
}

export const useGospel = create<GospelState>()(
  persist(
    (set, get) => ({
      answers: EMPTY_ANSWERS,
      onboardingComplete: false,
      cycleDays: 7,
      mealsPerDay: ['breakfast', 'lunch', 'dinner'],
      plan: null,
      checked: {},
      activeCycle: 0,

      setAnswer: (key, value) =>
        set((state) => ({ answers: { ...state.answers, [key]: value } })),

      setCycleDays: (days) => {
        set({ cycleDays: days });
        get().regeneratePlan();
      },

      setMealsPerDay: (slots) => {
        set({ mealsPerDay: slots });
        get().regeneratePlan();
      },

      completeOnboarding: () => {
        set({ onboardingComplete: true });
        get().regeneratePlan();
      },

      regeneratePlan: (seed) => {
        const { answers, cycleDays, mealsPerDay } = get();
        const profile = profileFrom(answers);
        if (!profile) return;

        const plan = buildPlan({
          targets: resolveTargets(profile),
          preferences: preferencesFrom(answers, mealsPerDay),
          recipes,
          cycleDays,
          seed: seed ?? Math.floor(Math.random() * 1_000_000),
          dietType: profile.diet_type,
        });

        // A new plan invalidates the old shopping ticks.
        set({ plan, checked: {}, activeCycle: 0 });
      },

      // Scope is a cycle index for weekly lines, or 'setup' / 'equipment'
      // for the one-time lists, which are not tied to any single cycle.
      toggleChecked: (scope, itemId) =>
        set((state) => {
          const key = `${scope}:${itemId}`;
          return { checked: { ...state.checked, [key]: !state.checked[key] } };
        }),

      clearChecked: (cycleIndex) =>
        set((state) => {
          const next = { ...state.checked };
          for (const key of Object.keys(next)) {
            if (key.startsWith(`${cycleIndex}:`)) delete next[key];
          }
          return { checked: next };
        }),

      setActiveCycle: (cycleIndex) => set({ activeCycle: cycleIndex }),

      reset: () =>
        set({
          answers: EMPTY_ANSWERS,
          onboardingComplete: false,
          plan: null,
          checked: {},
          activeCycle: 0,
          cycleDays: 7,
        }),
    }),
    {
      name: 'gospel-state-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        answers: state.answers,
        onboardingComplete: state.onboardingComplete,
        cycleDays: state.cycleDays,
        mealsPerDay: state.mealsPerDay,
        plan: state.plan,
        checked: state.checked,
        activeCycle: state.activeCycle,
      }),
    },
  ),
);

// --- Derived selectors -------------------------------------------------------
// Kept out of the store so they never go stale. Each derives from a stored
// value rather than inside the selector: zustand compares selector results with
// Object.is, so returning a freshly built object would make every snapshot look
// changed and drive useSyncExternalStore into an infinite render loop. Select
// the stored reference, derive in useMemo.

export function useProfile(): NutritionProfile | null {
  const answers = useGospel((state) => state.answers);
  return useMemo(() => profileFrom(answers), [answers]);
}

export function useTargets(): ResolvedTargets | null {
  const profile = useProfile();
  return useMemo(() => (profile ? resolveTargets(profile) : null), [profile]);
}

let intakeCache: { key: string; value: IntakeResult } | null = null;

/**
 * What the plan delivers across all 43 measurable nutrients.
 *
 * Cached on plan identity like the pantry projection: summing panels over
 * every ingredient of every meal is far too much work to redo on each render.
 */
export function useIntake(): IntakeResult | null {
  const plan = useGospel((state) => state.plan);
  if (!plan) return null;

  const key = `${plan.seed}:${plan.cycleDays}:${plan.meals.length}`;
  if (intakeCache?.key === key) return intakeCache.value;

  const value = averageDailyIntake(
    plan.meals,
    recipesById,
    ingredientPanels,
    plan.cycleDays,
  );

  intakeCache = { key, value };
  return value;
}

let pantryCache: { key: string; value: PantrySimulation } | null = null;

/** Grocery and pantry projection for the current plan. */
export function usePantryProjection(): PantrySimulation | null {
  const plan = useGospel((state) => state.plan);
  if (!plan) return null;

  const key = `${plan.seed}:${plan.cycleDays}:${plan.meals.length}`;
  if (pantryCache?.key === key) return pantryCache.value;

  const consumption = consumptionForPlan(plan, recipesById);
  const value = simulatePantry({
    consumptionPerCycle: consumption,
    ingredients: ingredientsById,
    cycleDays: plan.cycleDays,
    cycleCount: PROJECTION_CYCLES,
    equipment: equipmentForPlan(plan, recipesById),
  });

  pantryCache = { key, value };
  return value;
}
