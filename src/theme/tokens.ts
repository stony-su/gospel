/**
 * Gospel's design tokens.
 *
 * Colour discipline: the palette is almost entirely black. One accent carries
 * meaning and nothing else does.
 *
 * `signal.endpoint` is phenolphthalein magenta - the colour an acid-base
 * indicator turns at the titration endpoint. A nutrient bar is grey while it
 * is short of target and turns at the moment it arrives, so colour reports a
 * result rather than decorating a surface. `caution` and `breach` are reserved
 * strictly for the workbook's approaching-UL and over-UL states. Everything
 * else in the app is a shade of black or a grey.
 */

// --- The black scale ---------------------------------------------------------
// Faintly cool, so stacked surfaces separate without ever reading as blue.

export const ink = {
  void: '#000000',
  abyss: '#050607',
  base: '#08090B',
  raised: '#0D0F12',
  card: '#12151A',
  elevated: '#181C22',
  line: '#20252D',
  lineHot: '#2C333D',
  muted: '#3D4653',
  dim: '#5A6573',
} as const;

export const text = {
  faint: '#6E7987',
  tertiary: '#8A95A3',
  secondary: '#AAB4C0',
  primary: '#DEE4EC',
  bright: '#F4F7FA',
} as const;

export const signal = {
  /** Target reached. The indicator has turned. */
  endpoint: '#F0468C',
  endpointSoft: '#8E2B54',
  endpointGlow: 'rgba(240, 70, 140, 0.16)',
  /** At or above 80% of the tolerable upper intake level. */
  caution: '#E8963C',
  cautionSoft: '#6B4720',
  /** Above the upper limit. */
  breach: '#E5484D',
  breachSoft: '#6B2427',
  /** Data with no verdict attached yet. */
  inert: '#3D4653',
} as const;

/**
 * The accent glow, expressed as a boxShadow.
 *
 * The New Architecture deprecates the `shadow*` style props in favour of the
 * CSS-style `boxShadow` string, which also renders identically on both
 * platforms - the old props needed `elevation` alongside them on Android and
 * still produced a grey shadow rather than a coloured one.
 */
export function glow(radius = 6, opacity = 0.8): string {
  return `0px 0px ${radius}px rgba(240, 70, 140, ${opacity})`;
}

// --- Typography --------------------------------------------------------------
// Three registers for the three things the app is: a creed, a tool, an
// instrument. Doctrine is set in Newsreader italic, interface chrome in Plex
// Sans, and every numeral and unit in Plex Mono - so a number always looks
// like a measurement.

export const font = {
  doctrine: 'Newsreader_400Regular_Italic',
  doctrineSolid: 'Newsreader_500Medium',
  ui: 'IBMPlexSans_400Regular',
  uiMedium: 'IBMPlexSans_500Medium',
  uiSemi: 'IBMPlexSans_600SemiBold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoSemi: 'IBMPlexMono_600SemiBold',
} as const;

export const type = {
  /** The motto, and section epigraphs. */
  doctrine: { fontFamily: font.doctrine, fontSize: 19, lineHeight: 28 },
  doctrineLarge: { fontFamily: font.doctrine, fontSize: 26, lineHeight: 36 },
  /** Screen titles. */
  title: { fontFamily: font.uiSemi, fontSize: 25, lineHeight: 31, letterSpacing: -0.4 },
  heading: { fontFamily: font.uiMedium, fontSize: 17, lineHeight: 23, letterSpacing: -0.1 },
  body: { fontFamily: font.ui, fontSize: 15, lineHeight: 23 },
  bodySmall: { fontFamily: font.ui, fontSize: 13.5, lineHeight: 20 },
  /** Small-caps-ish eyebrow labels. Always uppercase at the call site. */
  eyebrow: { fontFamily: font.monoMedium, fontSize: 10.5, letterSpacing: 1.5 },
  /** Every number in the app. */
  readout: { fontFamily: font.monoSemi, fontSize: 32, letterSpacing: -1 },
  readoutSmall: { fontFamily: font.monoMedium, fontSize: 16, letterSpacing: -0.3 },
  figure: { fontFamily: font.mono, fontSize: 13, letterSpacing: -0.2 },
  figureTiny: { fontFamily: font.mono, fontSize: 11, letterSpacing: 0 },
} as const;

// --- Space and shape ---------------------------------------------------------

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  huge: 64,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

/** Standard screen gutter. */
export const GUTTER = space.lg;

export const duration = {
  fast: 140,
  base: 260,
  slow: 480,
  reveal: 900,
} as const;

// --- Monochrome rebuild ------------------------------------------------------
// Added alongside the palette above rather than replacing it: every existing
// component still imports `ink`/`text`/`signal`, and they are deleted only
// once nothing does. New code uses the names below and nothing else.

/**
 * The grade ramp - the entire palette.
 *
 * Neutral rather than the cool-tinted black above. Cool greys read as screen;
 * neutral greys read as ink on paper, which is what a sheet of graph paper
 * wants to be. Numbered by approximate lightness so a call site says how far
 * up the ramp it is rather than inventing a name for every step.
 */
export const grade = {
  0: '#000000',
  5: '#060606',
  10: '#0B0B0B',
  15: '#111111',
  20: '#171717',
  30: '#262626',
  35: '#303030',
  40: '#3D3D3D',
  50: '#565656',
  60: '#6E6E6E',
  70: '#909090',
  80: '#B4B4B4',
  90: '#D6D6D6',
  100: '#FFFFFF',
} as const;

/**
 * Line weights.
 *
 * With colour gone, weight is what separates a gridline from a rule from a
 * breach marker, so the weights need names as much as the greys do.
 */
export const stroke = {
  hair: 0.5,
  thin: 1,
  medium: 1.5,
  heavy: 2,
} as const;

/**
 * The type registers.
 *
 * Mono carries everything the app measures, states or labels - which is
 * almost everything. Sans survives for the rare running sentence. Every line
 * height is a multiple of 4 so text sits on the graticule's minor grid.
 */
export const registers = {
  display: { fontFamily: font.monoSemi, fontSize: 34, lineHeight: 40, letterSpacing: -1.5 },
  title: { fontFamily: font.monoSemi, fontSize: 20, lineHeight: 28, letterSpacing: 0.5 },
  heading: { fontFamily: font.monoMedium, fontSize: 14, lineHeight: 20, letterSpacing: 1 },
  label: { fontFamily: font.monoMedium, fontSize: 10, lineHeight: 14, letterSpacing: 2 },
  figure: { fontFamily: font.mono, fontSize: 13, lineHeight: 18, letterSpacing: -0.2 },
  figureSmall: { fontFamily: font.mono, fontSize: 11, lineHeight: 16, letterSpacing: 0 },
  prose: { fontFamily: font.ui, fontSize: 14, lineHeight: 22, letterSpacing: 0 },
} as const;

/**
 * Corner radii, such as they are.
 *
 * Rounded shapes read as consumer software. An instrument has corners.
 */
export const sharp = {
  none: 0,
  sm: 2,
} as const;
