/**
 * A recipe photograph, desaturated.
 *
 * The corpus ships colour food photography and the app has no colour, so the
 * image is run through a luminance matrix before it is drawn. That is a real
 * decision rather than a stylistic tic: a full-colour photograph on a
 * monochrome screen becomes the brightest thing on the page by an enormous
 * margin, and would out-shout every measurement the screen exists to show.
 *
 * React Native has no CSS filter, so this uses react-native-svg's FeColorMatrix
 * with Rec. 709 luma coefficients. True perceptual greyscale, identical on
 * iOS, Android and web, and no new dependency.
 */

import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, FeColorMatrix, Filter, Image as SvgImage } from 'react-native-svg';

import { grade, radius, stroke } from '@/theme/tokens';
import { Label } from '@/ui/text';

interface PlateProps {
  uri: string | null;
  width: number;
  height: number;
  /** Shown in place of a missing photograph. */
  fallbackLabel?: string;
}

/**
 * Rec. 709 luma: 0.2126 R + 0.7152 G + 0.0722 B, written into all three
 * output channels. Averaging the channels instead would make reds too light
 * and greens too dark - which on food photography is most of the frame.
 */
const LUMA =
  '0.2126 0.7152 0.0722 0 0 ' +
  '0.2126 0.7152 0.0722 0 0 ' +
  '0.2126 0.7152 0.0722 0 0 ' +
  '0 0 0 1 0';

export function Plate({ uri, width, height, fallbackLabel }: PlateProps) {
  // Several plates render at once on the plan tab, and a shared filter id
  // would make them collide.
  const filterId = `plate-${useId().replace(/:/g, '')}`;

  if (!uri) {
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
      <Svg width={width} height={height}>
        <Defs>
          <Filter id={filterId}>
            <FeColorMatrix type="matrix" values={LUMA} />
          </Filter>
        </Defs>
        <SvgImage
          href={{ uri }}
          x={0}
          y={0}
          width={width}
          height={height}
          preserveAspectRatio="xMidYMid slice"
          filter={`url(#${filterId})`}
        />
      </Svg>
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
