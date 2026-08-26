/**
 * Gospel's design tokens.
 *
 * Colour discipline: there is no colour. The palette is one neutral ramp from
 * black to white, and everything the interface needs to say - a target met, a
 * limit breached, a selection, a threshold - is said with fill, weight, hatch
 * or inversion instead.
 *
 * That is a stricter constraint than it sounds, and a better one. Form
 * survives a greyscale screenshot, a colour-blind reader and direct sunlight;
 * a magenta-versus-orange distinction survives none of them.
 */

// --- Typography --------------------------------------------------------------
// Mono carries everything the app measures, states or labels - which is almost
// everything. Sans survives for the rare running sentence.

export const font = {
  ui: 'IBMPlexSans_400Regular',
  uiMedium: 'IBMPlexSans_500Medium',
  uiSemi: 'IBMPlexSans_600SemiBold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoSemi: 'IBMPlexMono_600SemiBold',
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

/** Standard screen gutter. */
export const GUTTER = space.lg;

export const duration = {
  fast: 140,
  base: 260,
  slow: 480,
  reveal: 900,
} as const;

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
  3: '#040404',
  5: '#060606',
  8: '#0A0A0A',
  10: '#0D0D0D',
  12: '#101010',
  15: '#131313',
  18: '#171717',
  20: '#1A1A1A',
  25: '#212121',
  30: '#262626',
  35: '#303030',
  40: '#3D3D3D',
  50: '#565656',
  60: '#6E6E6E',
  70: '#909090',
  80: '#B4B4B4',
  85: '#C4C4C4',
  90: '#D6D6D6',
  92: '#E2E2E2',
  96: '#F1F1F1',
  100: '#FFFFFF',
} as const;

/**
 * Line weights.
 *
 * With colour gone, weight is what separates a gridline from a rule from a
 * breach marker, so the weights need names as much as the greys do.
 */
/**
 * Elevation.
 *
 * With no colour and no background texture, depth is the only structural tool
 * left, so it has to be used consistently: a shade means a level, and the same
 * level looks the same everywhere in the app. A row is a row whether it is in
 * the grocery list or the nutrient detail.
 *
 * Deliberately narrow steps. These are all near-black, and the point is that
 * a panel separates from the page without ever announcing itself as a card.
 *
 * Each level has a flat colour and a gradient. Use both together: the flat
 * value as `backgroundColor` and the gradient as `experimental_backgroundImage`,
 * so a platform that does not render the gradient still gets the right level
 * rather than nothing.
 */
export const surface = {
  /** The page itself. */
  ground: grade[0],
  /** A grouped block of related content. */
  panel: grade[10],
  /** One line within a block. */
  row: grade[15],
  /** Pressed, selected, or otherwise the thing being acted on. */
  raised: grade[20],
} as const;

/**
 * A vertical fade between two grades.
 *
 * Surfaces that fade across a few steps rather than sitting at one value are
 * what stop the app reading as a stack of flat blocks. The range is small on
 * purpose - two or three stops - so it registers as depth rather than as a
 * decorative wash.
 */
export function fade(from: string, to: string): string {
  return `linear-gradient(180deg, ${from} 0%, ${to} 100%)`;
}

/** Gradient fills matching the levels above. Pair with the flat colour. */
export const surfaceFade = {
  panel: fade(grade[12], grade[8]),
  row: fade(grade[18], grade[12]),
  raised: fade(grade[25], grade[18]),
} as const;

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
 * height is a multiple of 4 so text sits on a consistent baseline.
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
export const radius = {
  none: 0,
  /** Ticks, bars, small marks. */
  sm: 4,
  /** Rows, chips, controls. */
  md: 8,
  /** Panels, cards, plates. */
  lg: 14,
  pill: 999,
} as const;
