import type {
  ClockElementConfig,
  Constraint,
  Constraints,
  PositionUnit,
  ScreenBackgroundConfig,
  SizeWithUnits,
  TextStyle,
} from '../types'

// Client-side fallbacks for a screen element saved without its own config.
// The factory design of new screens is the server's
// (apps/server/src/service/presentation/default-design/).

export function getDefaultTextStyle(overrides?: Partial<TextStyle>): TextStyle {
  return {
    fontFamily: 'system-ui',
    maxFontSize: 120,
    autoScale: true,
    color: '#ffffff',
    bold: false,
    italic: false,
    underline: false,
    alignment: 'center',
    verticalAlignment: 'middle',
    lineHeight: 1.3,
    shadow: false,
    compressLines: false,
    lineSeparator: 'space',
    ...overrides,
  }
}

export function getDefaultBackground(): ScreenBackgroundConfig {
  return {
    type: 'color',
    color: '#000000',
    opacity: 1,
  }
}

function constraint(
  enabled: boolean,
  value: number,
  unit: PositionUnit = '%',
): Constraint {
  return { enabled, value, unit }
}

/** Constraints with top+left enabled (mimics old x,y positioning) */
function constraints(
  top: number,
  left: number,
  unit: PositionUnit = '%',
): Constraints {
  return {
    top: constraint(true, top, unit),
    bottom: constraint(false, 0, unit),
    left: constraint(true, left, unit),
    right: constraint(false, 0, unit),
  }
}

function sizeWithUnits(
  width: number,
  height: number,
  widthUnit: PositionUnit = '%',
  heightUnit: PositionUnit = '%',
): SizeWithUnits {
  return { width, widthUnit, height, heightUnit }
}

export function getDefaultClockConfig(
  clockConstraints: Constraints = constraints(2, 85),
  clockSize: SizeWithUnits = sizeWithUnits(10, 5),
): ClockElementConfig {
  return {
    enabled: false,
    constraints: clockConstraints,
    size: clockSize,
    style: getDefaultTextStyle({
      maxFontSize: 32,
      autoScale: false,
      alignment: 'right',
    }),
    format: '24h',
    showSeconds: false,
  }
}
