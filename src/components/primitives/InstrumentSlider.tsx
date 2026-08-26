/**
 * A slider shaped like a measuring instrument rather than a media control.
 *
 * The thumb is a needle, not a knob; the track carries graduations; and the
 * value is always shown in mono above it. Dragging feels like setting a dial
 * on a device, which is the register the whole app is written in.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { Eyebrow, Figure, Readout } from '@/components/primitives/Text';
import { glow, ink, radius, signal, space, text } from '@/theme/tokens';

interface InstrumentSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Rendered next to the value, e.g. "kg". */
  unit?: string;
  /** Override the readout text entirely, e.g. "45 min". */
  format?: (value: number) => string;
  /** Labels under the track at the extremes. */
  minLabel?: string;
  maxLabel?: string;
  /** How many graduation marks to draw. */
  graduations?: number;
}

export function InstrumentSlider({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  format,
  minLabel,
  maxLabel,
  graduations = 21,
}: InstrumentSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const widthRef = useRef(0);
  const lastValueRef = useRef(value);

  const clamp = useCallback(
    (raw: number) => {
      const stepped = Math.round(raw / step) * step;
      const bounded = Math.min(max, Math.max(min, stepped));
      // Round away floating point noise from the step division.
      return Math.round(bounded * 1000) / 1000;
    },
    [max, min, step],
  );

  const setFromPosition = useCallback(
    (x: number) => {
      const width = widthRef.current;
      if (width <= 0) return;
      const fraction = Math.min(1, Math.max(0, x / width));
      const next = clamp(min + fraction * (max - min));
      if (next !== lastValueRef.current) {
        lastValueRef.current = next;
        Haptics.selectionAsync().catch(() => {
          // Haptics are a nicety; a device without them must not break input.
        });
        onChange(next);
      }
    },
    [clamp, max, min, onChange],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          setFromPosition(event.nativeEvent.locationX);
        },
        onPanResponderMove: (event) => {
          setFromPosition(event.nativeEvent.locationX);
        },
      }),
    [setFromPosition],
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    widthRef.current = width;
    setTrackWidth(width);
  };

  const fraction = max > min ? (value - min) / (max - min) : 0;
  const thumbX = fraction * trackWidth;

  const readout = format ? format(value) : `${value}`;

  return (
    <View style={styles.root}>
      <View style={styles.readoutRow}>
        <Readout>{readout}</Readout>
        {unit && !format && (
          <Figure color={text.tertiary} style={styles.unit}>
            {unit}
          </Figure>
        )}
      </View>

      <View
        style={styles.trackArea}
        onLayout={onLayout}
        {...panResponder.panHandlers}
      >
        <View style={styles.graduations}>
          {Array.from({ length: graduations }).map((_, index) => {
            const isMajor = index % 5 === 0;
            return (
              <View
                key={index}
                style={[
                  styles.graduation,
                  isMajor ? styles.graduationMajor : null,
                ]}
              />
            );
          })}
        </View>

        <View style={styles.track}>
          <View style={[styles.trackFill, { width: Math.max(thumbX, 0) }]} />
        </View>

        <View
          style={[styles.needle, { left: Math.max(0, Math.min(thumbX - 1, trackWidth - 2)) }]}
        />
      </View>

      {(minLabel || maxLabel) && (
        <View style={styles.labels}>
          <Eyebrow>{minLabel ?? `${min}`}</Eyebrow>
          <Eyebrow>{maxLabel ?? `${max}`}</Eyebrow>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: space.md,
  },
  readoutRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.xs,
  },
  unit: {
    marginBottom: 4,
  },
  trackArea: {
    height: 56,
    justifyContent: 'center',
    // A generous hit area; the visible track is much thinner.
    paddingVertical: space.md,
  },
  graduations: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  graduation: {
    width: 1,
    height: 5,
    backgroundColor: ink.line,
  },
  graduationMajor: {
    height: 9,
    backgroundColor: ink.lineHot,
  },
  track: {
    height: 2,
    backgroundColor: ink.line,
    borderRadius: radius.pill,
  },
  trackFill: {
    height: 2,
    backgroundColor: signal.endpoint,
    borderRadius: radius.pill,
  },
  needle: {
    position: 'absolute',
    width: 2,
    height: 30,
    backgroundColor: signal.endpoint,
    boxShadow: glow(6, 0.8),
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
