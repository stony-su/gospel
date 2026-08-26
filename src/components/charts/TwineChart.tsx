/**
 * Energy across the cycle: target against what the plan delivers.
 *
 * A line chart is only honest where the x axis is a real sequence, so this
 * plots days - not nutrients. (Nutrients are categories; they get bars.) The
 * two strands braid wherever the plan crosses its target, which is the same
 * mark the app uses everywhere else, here carrying actual data.
 *
 * Both strands are directly labelled, so the two series are never
 * distinguished by colour alone.
 */

import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { Eyebrow, Figure } from '@/components/primitives/Text';
import { ink, signal, space, text } from '@/theme/tokens';
import { twineSeries } from '@/theme/twine';

interface TwineChartProps {
  /** Achieved value per day. */
  values: number[];
  /** The flat reference the plan is aiming at. */
  target: number;
  width: number;
  height?: number;
  unit?: string;
}

function TwineChartComponent({
  values,
  target,
  width,
  height = 130,
  unit = 'kcal',
}: TwineChartProps) {
  if (width <= 0 || values.length === 0 || target <= 0) return null;

  // Scale so the target sits at the vertical middle, giving equal visual room
  // to overshoot and shortfall. A chart that crops one of them lies.
  const span = Math.max(
    ...values.map((value) => Math.abs(value - target)),
    target * 0.25,
  );
  const low = target - span;
  const high = target + span;
  const toFraction = (value: number) => (value - low) / (high - low);

  const plotHeight = height - 26;
  const { a, b, nodes } = twineSeries(
    values.map(() => toFraction(target)),
    values.map(toFraction),
    width - 8,
    plotHeight,
  );

  const targetY = plotHeight - toFraction(target) * plotHeight;

  return (
    <View style={styles.root}>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: ink.dim }]} />
          <Figure tiny color={text.faint}>
            Target {Math.round(target)} {unit}
          </Figure>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: signal.endpoint }]} />
          <Figure tiny color={text.faint}>
            This plan
          </Figure>
        </View>
      </View>

      <Svg width={width} height={height}>
        {/* The reference line, drawn flat and recessive. */}
        <Line
          x1={0}
          x2={width - 8}
          y1={targetY}
          y2={targetY}
          stroke={ink.dim}
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        <Path d={a} stroke={ink.lineHot} strokeWidth={1} fill="none" />
        <Path d={b} stroke={signal.endpoint} strokeWidth={2} fill="none" />

        {/* Crossings: the days the plan lands exactly on target. */}
        {nodes.map((node, index) => (
          <Circle
            key={index}
            cx={node.x}
            cy={node.y}
            r={2.5}
            fill={signal.endpoint}
          />
        ))}

        <SvgText
          x={0}
          y={plotHeight + 15}
          fill={ink.dim}
          fontSize={9}
          fontFamily="IBMPlexMono_400Regular"
        >
          day 1
        </SvgText>
        <SvgText
          x={width - 8}
          y={plotHeight + 15}
          fill={ink.dim}
          fontSize={9}
          textAnchor="end"
          fontFamily="IBMPlexMono_400Regular"
        >
          day {values.length}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: space.xs,
  },
  legend: {
    flexDirection: 'row',
    gap: space.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
  },
  swatch: {
    width: 10,
    height: 2,
    borderRadius: 1,
  },
});

export const TwineChart = memo(TwineChartComponent);
