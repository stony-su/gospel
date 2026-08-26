/**
 * A continuous value on a ruled track.
 *
 * Built as an instrument rather than a form control: the track is an axis
 * with real tick marks at round values, and the readout above it is an
 * animated number, so dragging feels like moving a needle across a scale.
 *
 * Uses the pan responder rather than gesture-handler because the interaction
 * is one-dimensional and the responder is already what react-native gives a
 * View for free.
 */

import { useMemo, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { linearScale, niceTicks } from '@/theme/plot';
import { grade, space, stroke } from '@/theme/tokens';
import { AnimatedNumber } from '@/ui/motion';
import { Label } from '@/ui/text';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  precision?: number;
  label?: string;
  onChange: (value: number) => void;
}

const TRACK = 28;
const THUMB = 2;

export function Slider({
  value,
  min,
  max,
  step = 1,
  unit,
  precision = 0,
  label,
  onChange,
}: SliderProps) {
  const [width, setWidth] = useState(0);

  const scale = useMemo(() => linearScale([min, max], [0, width]), [min, max, width]);
  const ticks = useMemo(
    () => niceTicks(min, max, 4).filter((t) => t >= min && t <= max),
    [min, max],
  );

  const commit = (event: GestureResponderEvent) => {
    if (width <= 0) return;

    const { locationX } = event.nativeEvent;
    // react-native-web derives locationX from the target's bounding rect and
    // yields undefined when that rect is unavailable, which would put NaN
    // straight into the answer.
    if (!Number.isFinite(locationX)) return;

    const raw = scale.invert(Math.max(0, Math.min(width, locationX)));
    const snapped = Math.round(raw / step) * step;
    const bounded = Math.max(min, Math.min(max, snapped));

    if (bounded !== value) {
      Haptics.selectionAsync().catch(() => {});
      onChange(Number(bounded.toFixed(precision)));
    }
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: commit,
        onPanResponderMove: commit,
      }),
    // Recreated when the geometry or the committed value changes, so the
    // closure above never reads a stale width.
    [width, value, min, max, step, precision],
  );

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const filled = width > 0 ? scale(Math.max(min, Math.min(max, value))) : 0;

  return (
    <View>
      <View style={styles.head}>
        {label ? <Label>{label}</Label> : <View />}
        <AnimatedNumber
          value={value}
          precision={precision}
          suffix={unit ? ` ${unit}` : ''}
          color={grade[96]}
        />
      </View>

      <View style={styles.track} onLayout={onLayout} {...responder.panHandlers}>
        <View style={styles.rule} />
        <View style={[styles.rule, styles.ruleFilled, { width: filled }]} />

        {width > 0 &&
          ticks.map((tick) => (
            <View key={tick} style={[styles.tick, { left: scale(tick) }]} />
          ))}

        {width > 0 && <View style={[styles.thumb, { left: filled - THUMB / 2 }]} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space.xs,
  },
  track: {
    height: TRACK,
    justifyContent: 'center',
  },
  rule: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: stroke.hair,
    backgroundColor: grade[40],
  },
  ruleFilled: {
    right: undefined,
    height: stroke.thin,
    backgroundColor: grade[96],
  },
  tick: {
    position: 'absolute',
    bottom: 0,
    width: stroke.hair,
    height: 5,
    backgroundColor: grade[40],
  },
  thumb: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    width: THUMB,
    backgroundColor: grade[96],
  },
});
