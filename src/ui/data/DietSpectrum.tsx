/**
 * The diet spectrum.
 *
 * Six anchors on one axis, in the display order the product asked for. The
 * needle snaps to an anchor but can rest between two, which is what makes it
 * a spectrum rather than a six-way switch.
 *
 * One subtlety from the workbook, carried over intact: the display order is
 * NOT monotonic in animal_food_fraction - paleo sits at 0.6 but is shown
 * before IIFYM at 0.5. The axis therefore shows the requested order while
 * interpolation runs on animal_food_fraction, exactly as the _readme
 * requires. Flags and `set` rules never interpolate, so a position between
 * anchors only softens the multiply and add effects.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { dietAnchors } from '@/data/nutrition';
import type { DietType } from '@/domain/nutrition/types';
import { useMotion } from '@/theme/motion';
import { grade, space, stroke } from '@/theme/tokens';
import { Figure, Heading, Label } from '@/ui/text';

interface DietSpectrumProps {
  /** Continuous position across the anchors, 0 .. anchors.length - 1. */
  position: number;
  onChange: (position: number, dietType: DietType, animalFoodFraction: number) => void;
}

const TRACK = 32;

export function DietSpectrum({ position, onChange }: DietSpectrumProps) {
  const motion = useMotion();
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
      // react-native-web yields undefined for locationX when the target's
      // bounding rect is unavailable, which would put NaN into the answer.
      if (!Number.isFinite(x)) return;

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

  const needle = useSharedValue(needleX);

  useEffect(() => {
    needle.value = withSpring(needleX, motion.spring);
  }, [needle, needleX, motion]);

  const needleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: needle.value - stroke.thin / 2 }],
  }));

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Heading>{active.label}</Heading>
        <Figure small>{`${(fractionAt(position) * 100).toFixed(0)}% animal`}</Figure>
      </View>

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
                { left: x - stroke.hair },
                isActive && styles.anchorActive,
              ]}
            />
          );
        })}

        {trackWidth > 0 && <Animated.View style={[styles.needle, needleStyle]} />}
      </View>

      <View style={styles.labels}>
        {anchors.map((anchor, index) => (
          <View key={anchor.diet_type} style={styles.labelSlot}>
            <Label
              color={index === activeIndex ? grade[100] : grade[50]}
              style={styles.label}
            >
              {anchor.label.replace('Veganism', 'Vegan').replace('Vegetarianism', 'Veg')}
            </Label>
          </View>
        ))}
      </View>

      {betweenAnchors && (
        <Label color={grade[50]} style={styles.blend}>
          interpolated
        </Label>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingVertical: space.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  trackArea: {
    height: TRACK,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    height: stroke.hair,
    backgroundColor: grade[40],
  },
  anchor: {
    position: 'absolute',
    top: TRACK / 2 - 4,
    width: stroke.thin,
    height: 8,
    backgroundColor: grade[40],
  },
  anchorActive: {
    backgroundColor: grade[70],
  },
  needle: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 0,
    width: stroke.thin,
    backgroundColor: grade[100],
  },
  labels: {
    flexDirection: 'row',
    marginTop: space.xs,
  },
  labelSlot: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    textAlign: 'center',
  },
  blend: {
    marginTop: space.sm,
  },
});
