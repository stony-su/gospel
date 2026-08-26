/**
 * Sun exposure picker.
 *
 * Tap anywhere on the map to set a location. Only the latitude matters - the
 * workbook maps abs(latitude) to a vitamin D multiplier and a count of winter
 * months - so the zone bands are drawn as the primary layer and the coastline
 * sits underneath at low contrast, present for orientation rather than detail.
 *
 * Drawing the bands makes the boundaries visible, which is more honest than a
 * dropdown: it shows the user that 45 degrees is a real threshold and that
 * they are near one.
 */

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { Eyebrow, Figure } from '@/components/primitives/Text';
import { sunZoneForLatitude, sunZonesByLatitude } from '@/data/nutrition';
import { LANDMASSES, REFERENCE_CITIES } from '@/data/worldOutline';
import type { SunZoneRow } from '@/domain/nutrition/types';
import { ink, radius, signal, space, text } from '@/theme/tokens';

interface SunMapProps {
  latitude: number | null;
  longitude: number | null;
  onPick: (latitude: number, longitude: number, zone: SunZoneRow) => void;
}

const MAP_RATIO = 0.52;

/** Distinct fills per zone, built from the accent at varying strength. */
const ZONE_FILL: Record<string, string> = {
  tropical: 'rgba(240, 70, 140, 0.030)',
  subtropical: 'rgba(240, 70, 140, 0.055)',
  temperate: 'rgba(240, 70, 140, 0.085)',
  high_latitude: 'rgba(240, 70, 140, 0.120)',
  very_high_latitude: 'rgba(240, 70, 140, 0.165)',
};

export function SunMap({ latitude, longitude, onPick }: SunMapProps) {
  const [width, setWidth] = useState(0);
  const height = width * MAP_RATIO;

  const project = useMemo(
    () => ({
      x: (lon: number) => ((lon + 180) / 360) * width,
      y: (lat: number) => ((90 - lat) / 180) * height,
    }),
    [width, height],
  );

  const landPaths = useMemo(() => {
    if (width <= 0) return [];
    return LANDMASSES.map((polygon) =>
      polygon
        .map(
          ([lon, lat], index) =>
            `${index === 0 ? 'M' : 'L'} ${project.x(lon).toFixed(1)} ${project.y(lat).toFixed(1)}`,
        )
        .join(' ') + ' Z',
    );
  }, [project, width]);

  const zone = latitude !== null ? sunZoneForLatitude(latitude) : null;

  const handlePress = (event: {
    nativeEvent: { locationX: number; locationY: number };
  }) => {
    if (width <= 0 || height <= 0) return;
    const { locationX, locationY } = event.nativeEvent;
    // react-native-web derives locationX/Y from the target's bounding rect and
    // yields undefined when that rect is unavailable, which would put NaN into
    // the stored answers and silently pick the wrong sun zone.
    if (!Number.isFinite(locationX) || !Number.isFinite(locationY)) return;
    const lon = (locationX / width) * 360 - 180;
    const lat = 90 - (locationY / height) * 180;
    const bounded = Math.max(-90, Math.min(90, lat));
    Haptics.selectionAsync().catch(() => {});
    onPick(bounded, lon, sunZoneForLatitude(bounded));
  };

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <View style={styles.root}>
      <Pressable onPress={handlePress} onLayout={onLayout} style={styles.mapFrame}>
        {width > 0 && (
          <Svg width={width} height={height}>
            {/* Latitude zone bands, mirrored across the equator. */}
            {sunZonesByLatitude.map((band) =>
              [1, -1].map((sign) => {
                const top = sign === 1 ? band.abs_latitude_max : -band.abs_latitude_min;
                const bottom = sign === 1 ? band.abs_latitude_min : -band.abs_latitude_max;
                const y = project.y(top);
                const bandHeight = project.y(bottom) - y;
                if (bandHeight <= 0) return null;
                return (
                  <Rect
                    key={`${band.sun_zone}-${sign}`}
                    x={0}
                    y={y}
                    width={width}
                    height={bandHeight}
                    fill={ZONE_FILL[band.sun_zone] ?? 'transparent'}
                  />
                );
              }),
            )}

            {/* Coastline, kept faint. */}
            <G>
              {landPaths.map((path, index) => (
                <Path
                  key={index}
                  d={path}
                  fill={ink.elevated}
                  stroke={ink.lineHot}
                  strokeWidth={0.6}
                />
              ))}
            </G>

            {/* Zone boundaries, the numbers that actually decide the answer. */}
            {sunZonesByLatitude.map((band) =>
              [1, -1].map((sign) => {
                const value = band.abs_latitude_max * sign;
                if (Math.abs(value) >= 90) return null;
                return (
                  <Line
                    key={`line-${band.sun_zone}-${sign}`}
                    x1={0}
                    x2={width}
                    y1={project.y(value)}
                    y2={project.y(value)}
                    stroke={ink.muted}
                    strokeWidth={0.5}
                    strokeDasharray="3 4"
                  />
                );
              }),
            )}

            {/* The equator, drawn solid so the mirror is readable. */}
            <Line
              x1={0}
              x2={width}
              y1={project.y(0)}
              y2={project.y(0)}
              stroke={ink.dim}
              strokeWidth={0.8}
            />

            {REFERENCE_CITIES.map((city) => (
              <Circle
                key={city.name}
                cx={project.x(city.lon)}
                cy={project.y(city.lat)}
                r={1.4}
                fill={ink.dim}
              />
            ))}

            {/* The pin: crosshairs rather than a marker, matching the instrument register. */}
            {latitude !== null && longitude !== null && (
              <G>
                <Line
                  x1={0}
                  x2={width}
                  y1={project.y(latitude)}
                  y2={project.y(latitude)}
                  stroke={signal.endpoint}
                  strokeWidth={0.8}
                  opacity={0.75}
                />
                <Line
                  x1={project.x(longitude)}
                  x2={project.x(longitude)}
                  y1={0}
                  y2={height}
                  stroke={signal.endpoint}
                  strokeWidth={0.8}
                  opacity={0.4}
                />
                <Circle
                  cx={project.x(longitude)}
                  cy={project.y(latitude)}
                  r={4}
                  fill="none"
                  stroke={signal.endpoint}
                  strokeWidth={1.4}
                />
                <SvgText
                  x={Math.min(project.x(longitude) + 8, width - 46)}
                  y={Math.max(project.y(latitude) - 7, 11)}
                  fill={signal.endpoint}
                  fontSize={9}
                  fontFamily="IBMPlexMono_500Medium"
                >
                  {`${Math.abs(latitude).toFixed(1)}°${latitude >= 0 ? 'N' : 'S'}`}
                </SvgText>
              </G>
            )}
          </Svg>
        )}
      </Pressable>

      {zone ? (
        <View style={styles.readout}>
          <View style={styles.readoutHead}>
            <Eyebrow color={signal.endpoint}>{zone.label}</Eyebrow>
            <Figure tiny color={text.faint}>
              {zone.abs_latitude_min}–{zone.abs_latitude_max}° · vitamin D ×
              {zone.vitamin_d_multiplier}
            </Figure>
          </View>
          <Figure tiny color={text.faint} style={styles.zoneNote}>
            {zone.vitamin_d_winter_months > 0
              ? `${zone.vitamin_d_winter_months} months a year with no usable synthesis.`
              : 'Year-round synthesis possible.'}
          </Figure>
        </View>
      ) : (
        <View style={styles.readout}>
          <Eyebrow>Tap the map to set your location</Eyebrow>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: space.md,
  },
  mapFrame: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: ink.line,
    backgroundColor: ink.raised,
    overflow: 'hidden',
  },
  readout: {
    gap: space.xxs,
  },
  readoutHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: space.sm,
  },
  zoneNote: {
    lineHeight: 16,
  },
});
