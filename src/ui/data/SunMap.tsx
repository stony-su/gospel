/**
 * Sun exposure picker.
 *
 * Tap anywhere to set a location. Only the latitude matters - the workbook
 * maps abs(latitude) to a vitamin D multiplier and a count of winter months -
 * so the zone bands are the primary layer and the coastline sits underneath
 * at low contrast, present for orientation rather than detail.
 *
 * Drawing the bands makes the boundaries visible, which is more honest than a
 * dropdown: it shows that 45 degrees is a real threshold and that you are
 * near one. With colour gone the bands separate by grade alone, which is
 * enough because they are ordered - a reader only needs to see that the
 * ramp climbs toward the poles.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { sunZoneForLatitude, sunZonesByLatitude } from '@/data/nutrition';
import { LANDMASSES, REFERENCE_CITIES } from '@/data/worldOutline';
import type { SunZoneRow } from '@/domain/nutrition/types';
import { useMotion } from '@/theme/motion';
import { grade, registers, space, stroke } from '@/theme/tokens';
import { Figure, Label } from '@/ui/text';

interface SunMapProps {
  latitude: number | null;
  longitude: number | null;
  onPick: (latitude: number, longitude: number, zone: SunZoneRow) => void;
}

const MAP_RATIO = 0.52;

/** Bands climb the ramp toward the poles, where synthesis gets harder. */
const ZONE_FILL: Record<string, string> = {
  tropical: 'rgba(255, 255, 255, 0.020)',
  subtropical: 'rgba(255, 255, 255, 0.040)',
  temperate: 'rgba(255, 255, 255, 0.065)',
  high_latitude: 'rgba(255, 255, 255, 0.095)',
  very_high_latitude: 'rgba(255, 255, 255, 0.130)',
};

export function SunMap({ latitude, longitude, onPick }: SunMapProps) {
  const motion = useMotion();
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
    return LANDMASSES.map(
      (polygon) =>
        polygon
          .map(
            ([lon, lat], index) =>
              `${index === 0 ? 'M' : 'L'} ${project.x(lon).toFixed(1)} ${project
                .y(lat)
                .toFixed(1)}`,
          )
          .join(' ') + ' Z',
    );
  }, [project, width]);

  const zone = latitude !== null ? sunZoneForLatitude(latitude) : null;

  const handlePress = (event: { nativeEvent: { locationX: number; locationY: number } }) => {
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

  // The crosshair springs to a new pick rather than jumping, so a mistaken
  // tap is visibly a movement and not a fresh reading.
  const pinX = useSharedValue(0);
  const pinY = useSharedValue(0);

  useEffect(() => {
    if (latitude === null || longitude === null || width <= 0) return;
    pinX.value = withSpring(project.x(longitude), motion.spring);
    pinY.value = withSpring(project.y(latitude), motion.spring);
  }, [pinX, pinY, latitude, longitude, project, width, motion]);

  const crossH = useAnimatedStyle(() => ({ transform: [{ translateY: pinY.value }] }));
  const crossV = useAnimatedStyle(() => ({ transform: [{ translateX: pinX.value }] }));

  return (
    <View style={styles.root}>
      <Pressable onPress={handlePress} onLayout={onLayout} style={styles.mapFrame}>
        {width > 0 && (
          <>
            <Svg width={width} height={height}>
              {/* Latitude zone bands, mirrored across the equator. */}
              {sunZonesByLatitude.map((band) =>
                [1, -1].map((sign) => {
                  const top = sign === 1 ? band.abs_latitude_max : -band.abs_latitude_min;
                  const bottom = sign === 1 ? band.abs_latitude_min : -band.abs_latitude_max;
                  const y = project.y(top);
                  const bandHeight = project.y(bottom) - y;
                  if (!(bandHeight > 0)) return null;
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
                    fill={grade[15]}
                    stroke={grade[35]}
                    strokeWidth={stroke.hair}
                  />
                ))}
              </G>

              {/* Zone boundaries - the numbers that decide the answer. */}
              {sunZonesByLatitude.map((band) =>
                [1, -1].map((sign) => {
                  const value = band.abs_latitude_max * sign;
                  // NaN fails every comparison, so test for the value being
                  // in range rather than out of it.
                  if (!(Math.abs(value) < 90)) return null;
                  return (
                    <Line
                      key={`line-${band.sun_zone}-${sign}`}
                      x1={0}
                      x2={width}
                      y1={project.y(value)}
                      y2={project.y(value)}
                      stroke={grade[40]}
                      strokeWidth={stroke.hair}
                      strokeDasharray="3 4"
                    />
                  );
                }),
              )}

              {/* The equator, solid, so the mirror is readable. */}
              <Line
                x1={0}
                x2={width}
                y1={project.y(0)}
                y2={project.y(0)}
                stroke={grade[50]}
                strokeWidth={stroke.thin}
              />

              {REFERENCE_CITIES.map((city) => (
                <Circle
                  key={city.name}
                  cx={project.x(city.lon)}
                  cy={project.y(city.lat)}
                  r={1.4}
                  fill={grade[50]}
                />
              ))}

              {latitude !== null && longitude !== null && (
                <SvgText
                  x={Math.min(project.x(longitude) + 8, width - 46)}
                  y={Math.max(project.y(latitude) - 7, 11)}
                  fill={grade[100]}
                  fontSize={registers.figureSmall.fontSize}
                  fontFamily={registers.figureSmall.fontFamily}
                >
                  {`${Math.abs(latitude).toFixed(1)}°${latitude >= 0 ? 'N' : 'S'}`}
                </SvgText>
              )}
            </Svg>

            {/* Crosshairs as views rather than SVG, so they can be animated
                without re-rendering the whole map on every frame. */}
            {latitude !== null && longitude !== null && (
              <>
                <Animated.View style={[styles.crossH, { width }, crossH]} pointerEvents="none" />
                <Animated.View style={[styles.crossV, { height }, crossV]} pointerEvents="none" />
              </>
            )}
          </>
        )}
      </Pressable>

      {zone ? (
        <View style={styles.readout}>
          <View style={styles.readoutHead}>
            <Label color={grade[100]}>{zone.label}</Label>
            <Figure small>
              {`${zone.abs_latitude_min}–${zone.abs_latitude_max}° · vit D ×${zone.vitamin_d_multiplier}`}
            </Figure>
          </View>
          <Figure small color={grade[60]}>
            {zone.vitamin_d_winter_months > 0
              ? `${zone.vitamin_d_winter_months} months no synthesis`
              : 'year-round synthesis'}
          </Figure>
        </View>
      ) : (
        <Label color={grade[50]} style={styles.prompt}>
          tap to set latitude
        </Label>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingVertical: space.sm,
  },
  mapFrame: {
    position: 'relative',
    borderWidth: stroke.hair,
    borderColor: grade[40],
  },
  crossH: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: stroke.thin,
    backgroundColor: grade[100],
    opacity: 0.75,
  },
  crossV: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: stroke.thin,
    backgroundColor: grade[100],
    opacity: 0.4,
  },
  readout: {
    marginTop: space.sm,
  },
  readoutHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space.xxs,
  },
  prompt: {
    marginTop: space.sm,
  },
});
