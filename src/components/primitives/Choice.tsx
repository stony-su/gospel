/**
 * Selection controls for onboarding.
 *
 * Selection is shown by a magenta rule and a brightened label rather than a
 * filled block, keeping the surface black and reserving the accent for
 * "this is the answer".
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { Body, Eyebrow, Figure } from '@/components/primitives/Text';
import { glow, ink, radius, signal, space, text } from '@/theme/tokens';

function tap() {
  Haptics.selectionAsync().catch(() => {});
}

interface OptionRowProps {
  label: string;
  description?: string;
  meta?: string;
  selected: boolean;
  onPress: () => void;
}

/** A full-width option with room for an explanation. */
export function OptionRow({
  label,
  description,
  meta,
  selected,
  onPress,
}: OptionRowProps) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && styles.pressed,
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={[styles.marker, selected && styles.markerSelected]} />

      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Body color={selected ? text.bright : text.primary}>{label}</Body>
          {meta && <Figure tiny color={text.faint}>{meta}</Figure>}
        </View>
        {description && (
          <Body small color={text.faint} style={styles.description}>
            {description}
          </Body>
        )}
      </View>
    </Pressable>
  );
}

interface ChipProps {
  label: string;
  meta?: string;
  selected: boolean;
  onPress: () => void;
}

/** A compact toggle, for multi-select sets like cuisines. */
export function Chip({ label, meta, selected, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
    >
      <Body small color={selected ? ink.void : text.secondary}>
        {label}
      </Body>
      {meta && (
        <Figure tiny color={selected ? ink.raised : text.faint}>
          {meta}
        </Figure>
      )}
    </Pressable>
  );
}

interface SegmentedProps<T extends string | number> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** A horizontal switch, for short mutually exclusive sets. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => {
              tap();
              onChange(option.value);
            }}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.segmentSelected,
              pressed && styles.pressed,
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Eyebrow color={selected ? signal.endpoint : text.faint}>
              {option.label}
            </Eyebrow>
          </Pressable>
        );
      })}
    </View>
  );
}

interface CheckRowProps {
  label: string;
  meta?: string;
  checked: boolean;
  onPress: () => void;
  children?: ReactNode;
}

/** A grocery tick. Struck through once checked, so progress is legible. */
export function CheckRow({ label, meta, checked, onPress, children }: CheckRowProps) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <View style={styles.boxInner} />}
      </View>

      <View style={styles.checkBody}>
        <Body
          small
          color={checked ? text.faint : text.primary}
          style={checked ? styles.struck : undefined}
        >
          {label}
        </Body>
        {children}
      </View>

      {meta && (
        <Figure tiny color={checked ? ink.muted : text.faint}>
          {meta}
        </Figure>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: space.sm,
    paddingRight: space.sm,
    gap: space.sm,
  },
  rowSelected: {},
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: space.sm,
  },
  description: {
    lineHeight: 18,
  },
  marker: {
    width: 2,
    alignSelf: 'stretch',
    minHeight: 20,
    borderRadius: radius.pill,
    backgroundColor: ink.line,
    marginTop: 2,
  },
  markerSelected: {
    backgroundColor: signal.endpoint,
    boxShadow: glow(5, 0.8),
  },
  pressed: {
    opacity: 0.6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ink.line,
    backgroundColor: ink.card,
  },
  chipSelected: {
    backgroundColor: signal.endpoint,
    borderColor: signal.endpoint,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: ink.card,
    borderRadius: radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: ink.line,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.xs + 2,
    borderRadius: radius.sm,
  },
  segmentSelected: {
    backgroundColor: ink.elevated,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
  },
  checkBody: {
    flex: 1,
    gap: 2,
  },
  box: {
    width: 18,
    height: 18,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: ink.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    borderColor: signal.endpoint,
    backgroundColor: signal.endpointGlow,
  },
  boxInner: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: signal.endpoint,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
});
