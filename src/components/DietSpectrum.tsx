/**
 * The diet line spectrum.
 *
 * Six anchors on one axis, in the display order the product asked for. The
 * needle snaps to an anchor but can rest between two, which is what makes it a
 * spectrum rather than a six-way switch.
 *
 * One subtlety from the workbook: the display order is NOT monotonic in
 * animal_food_fraction - paleo sits at 0.6 but is shown before IIFYM at 0.5.
 * The axis therefore shows the requested order while interpolation runs on
 * animal_food_fraction, exactly as the _readme requires. Flags and `set` rules
 * never interpolate, so a position between anchors only softens the multiply
 * and add effects.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { Body, Eyebrow, Figure, Heading } from '@/components/primitives/Text';
import { dietAnchors } from '@/data/nutrition';
import type { DietType } from '@/domain/nutrition/types';
import { glow, ink, radius, signal, space, text } from '@/theme/tokens';

interface DietSpectrumProps {
  /** Continuous position across the anchors, 0 .. anchors.length - 1. */
  position: number;
  onChange: (
    position: number,
    dietType: DietType,
    animalFoodFraction: number,
  ) => void;
}

export function DietSpectrum({ position, onChange }: DietSpectrumProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const widthRef = useRef(0);
  const lastAnchorRef = useRef(-1);

  const anchors = dietAnchors;
  const maxIndex = anchors.length - 1;

  /** Interpolate animal food fraction between the two bracketing anchors. */
  const fractionAt = useCallback(
    (pos: number) => {
      const lower = Math.floor(pos);
      const upper = Math.min(lower + 1, maxIndex);
      const t = pos - lower;
      const from = anchors[lower].animal_food_fraction;
      const to = anchors[upper].animal_food_fraction;
      return from + (to - from) * t;
    },
    [anchors, maxIndex],
  );

  /** The nearest anchor decides which diet's set rules and flags apply. */
  const nearestAnchorIndex = useCallback(
    (pos: number) => Math.round(Math.min(maxIndex, Math.max(0, pos))),
    [maxIndex],
  );

  const setFromPosition = useCallback(
    (x: number) => {
      const width = widthRef.current;
      if (width <= 0) return;
      const fraction = Math.min(1, Math.max(0, x / width));
      // Quantise to eighths of a step so the needle feels detented rather
      // than continuous, without collapsing to a plain six-way switch.
      const raw = fraction * maxIndex;
      const next = Math.round(raw * 8) / 8;

      const anchorIndex = nearestAnchorIndex(next);
      if (anchorIndex !== lastAnchorRef.current) {
        lastAnchorRef.current = anchorIndex;
        Haptics.selectionAsync().catch(() => {});
      }

      onChange(next, anchors[anchorIndex].diet_type, fractionAt(next));
    },
    [anchors, fractionAt, maxIndex, nearestAnchorIndex, onChange],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => setFromPosition(event.nativeEvent.locationX),
        onPanResponderMove: (event) => setFromPosition(event.nativeEvent.locationX),
      }),
    [setFromPosition],
  );

  const onLayout = (event: LayoutChangeEvent) => {
    widthRef.current = event.nativeEvent.layout.width;
    setTrackWidth(event.nativeEvent.layout.width);
  };

  const activeIndex = nearestAnchorIndex(position);
  const active = anchors[activeIndex];
  const needleX = maxIndex > 0 ? (position / maxIndex) * trackWidth : 0;
  const betweenAnchors = Math.abs(position - activeIndex) > 0.01;

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Heading color={text.bright}>{active.label}</Heading>
        <Figure tiny color={text.faint}>
          {(fractionAt(position) * 100).toFixed(0)}% animal foods
        </Figure>
      </View>

      <Body small color={text.faint} style={styles.description}>
        {active.description}
      </Body>

      <View style={styles.trackArea} onLayout={onLayout} {...panResponder.panHandlers}>
        <View style={styles.track} />

        {anchors.map((anchor, index) => {
          const x = maxIndex > 0 ? (index / maxIndex) * trackWidth : 0;
          const isActive = index === activeIndex;
          return (
            <View
              key={anchor.diet_type}
              style={[
                styles.anchor,
                { left: x - 3 },
                isActive && styles.anchorActive,
              ]}
            />
          );
        })}

        <View style={[styles.needle, { left: Math.max(0, needleX - 1) }]} />
      </View>

      <View style={styles.labels}>
        {anchors.map((anchor, index) => (
          <View key={anchor.diet_type} style={styles.labelSlot}>
            <Eyebrow
              color={index === activeIndex ? signal.endpoint : text.faint}
              style={styles.label}
            >
              {anchor.label.replace('Veganism', 'Vegan').replace('Vegetarianism', 'Veg')}
            </Eyebrow>
          </View>
        ))}
      </View>

      {betweenAnchors && (
        <Figure tiny color={text.faint} style={styles.blendNote}>
          Between anchors. Multiplier effects are interpolated; {active.label}
          {"'"}s fixed rules still apply.
        </Figure>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: space.sm,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: space.sm,
  },
  description: {
    lineHeight: 19,
    minHeight: 38,
  },
  trackArea: {
    height: 44,
    justifyContent: 'center',
    marginTop: space.xs,
  },
  track: {
    height: 1,
    backgroundColor: ink.lineHot,
  },
  anchor: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ink.muted,
    top: 19,
  },
  anchorActive: {
    backgroundColor: signal.endpoint,
    boxShadow: glow(6, 0.9),
  },
  needle: {
    position: 'absolute',
    width: 2,
    height: 26,
    backgroundColor: signal.endpoint,
  },
  labels: {
    flexDirection: 'row',
  },
  labelSlot: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    fontSize: 9,
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  blendNote: {
    lineHeight: 15,
  },
});
