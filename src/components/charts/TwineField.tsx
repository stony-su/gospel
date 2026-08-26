/**
 * Ambient twining lines.
 *
 * The signature mark at its quietest: bands of braided curves at very low
 * opacity, sitting behind content. Same geometry as the data plots, so the
 * background and the charts are visibly the same idea at different volumes.
 *
 * Static by design. An animated background would compete with the numbers,
 * which are the thing worth looking at.
 */

import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { ink, signal } from '@/theme/tokens';
import { ambientTwine } from '@/theme/twine';

interface TwineFieldProps {
  width: number;
  height: number;
  bands?: number;
  /** 0-1. Higher lifts the whole field out of the background. */
  intensity?: number;
  /** Tint the crossing nodes with the accent. Use sparingly. */
  liveNodes?: boolean;
}

function TwineFieldComponent({
  width,
  height,
  bands = 5,
  intensity = 1,
  liveNodes = false,
}: TwineFieldProps) {
  if (width <= 0 || height <= 0) return null;

  const fields = ambientTwine(width, height, bands);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height}>
        {fields.map((field, index) => {
          const fade = 1 - index / (fields.length + 1);
          const opacity = 0.055 * fade * intensity;

          return (
            <Path
              key={`a-${index}`}
              d={field.a}
              stroke={ink.dim}
              strokeWidth={1}
              fill="none"
              opacity={opacity}
            />
          );
        })}
        {fields.map((field, index) => {
          const fade = 1 - index / (fields.length + 1);
          return (
            <Path
              key={`b-${index}`}
              d={field.b}
              stroke={ink.muted}
              strokeWidth={1}
              fill="none"
              opacity={0.055 * fade * intensity}
            />
          );
        })}
        {liveNodes &&
          fields.flatMap((field, fieldIndex) =>
            field.nodes.map((node, nodeIndex) => (
              <Circle
                key={`n-${fieldIndex}-${nodeIndex}`}
                cx={node.x}
                cy={node.y}
                r={1.4}
                fill={signal.endpoint}
                opacity={0.14 * intensity}
              />
            )),
          )}
      </Svg>
    </View>
  );
}

export const TwineField = memo(TwineFieldComponent);
