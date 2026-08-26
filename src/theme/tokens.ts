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
