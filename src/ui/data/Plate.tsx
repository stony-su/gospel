/**
 * A recipe photograph.
 *
 * The interface around it has no colour at all - one neutral ramp, and every
 * state said with fill, weight or inversion. The photograph is the single
 * exception, and it is deliberate: a plate of food is the one thing on screen
 * that is not a measurement, and desaturating it threw away the only
 * information it carries. Whether a curry is deep red or pale yellow is the
 * point of the picture.
 *
 * It used to run through a Rec. 709 luma matrix in react-native-svg. That is
 * gone, and with it the last reason for this component to reach for SVG at
 * all: a plain Image composites faster, decodes progressively, and - because
 * it resolves under react-native-web - can actually be render-tested.
 *
 * The frame is what keeps a colour photograph from shouting down the figures
 * beside it: a hairline in the ramp's own grey, a small radius, and a fixed
 * footprint that a missing photograph fills identically so the layout never
 * shifts.
 */

import { Image, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

import { grade, radius, stroke } from '@/theme/tokens';
import { Label } from '@/ui/text';

interface PlateProps {
  /** A bundled asset from `recipeImage()`, or null when there is none. */
  source: ImageSourcePropType | null;
  width: number;
  height: number;
  /** Shown in place of a missing photograph. */
  fallbackLabel?: string;
  /** Describes the dish for screen readers. */
  accessibilityLabel?: string;
}

export function Plate({
  source,
  width,
  height,
  fallbackLabel,
  accessibilityLabel,
}: PlateProps) {
  if (!source) {
    return (
      <View style={[styles.fallback, { width, height }]}>
        {fallbackLabel ? (
          <Label color={grade[50]} numberOfLines={1}>
            {fallbackLabel}
          </Label>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.frame, { width, height }]}>
      <Image
        source={source}
        style={{ width, height }}
        resizeMode="cover"
        accessible={accessibilityLabel !== undefined}
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.lg,
    borderWidth: stroke.hair,
    borderColor: grade[40],
    overflow: 'hidden',
    backgroundColor: grade[10],
  },
  // Same footprint as a real plate, so a missing photograph never shifts the
  // layout around it.
  fallback: {
    borderRadius: radius.lg,
    borderWidth: stroke.hair,
    borderColor: grade[30],
    backgroundColor: grade[10],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
