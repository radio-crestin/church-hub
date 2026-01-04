import type {
  AnimationConfig,
  BackgroundConfig,
  Constraints,
  ContentTypeConfig,
  Position,
  PositionUnit,
  Size,
  SizeWithUnits,
  TextStyle,
} from '../../../types'

interface ScreenDimensions {
  width: number
  height: number
}

export function toPixels(
  value: number,
  unit: '%' | 'px',
  total: number,
): number {
  return unit === '%' ? (value / 100) * total : value
}

export function toPercent(pixelValue: number, totalPixels: number): number {
  if (totalPixels === 0) return 0
  return (pixelValue / totalPixels) * 100
}

export function convertUnit(
  value: number,
  fromUnit: '%' | 'px',
  toUnit: '%' | 'px',
  totalPixels: number,
): number {
  if (fromUnit === toUnit) return value
  return fromUnit === '%'
    ? toPixels(value, '%', totalPixels)
    : toPercent(value, totalPixels)
}

export function roundForDisplay(value: number): number {
  return Math.round(value * 10) / 10
}

export function calculatePixelPosition(
  position: Position,
  screenDimensions: ScreenDimensions,
): { x: number; y: number } {
  return {
    x:
      position.unit === '%'
        ? (position.x / 100) * screenDimensions.width
        : position.x,
    y:
      position.unit === '%'
        ? (position.y / 100) * screenDimensions.height
        : position.y,
  }
}

export function calculatePixelSize(
  size: Size,
  screenDimensions: ScreenDimensions,
): { width: number; height: number } {
  return {
    width:
      size.unit === '%'
        ? (size.width / 100) * screenDimensions.width
        : size.width,
    height:
      size.unit === '%'
        ? (size.height / 100) * screenDimensions.height
        : size.height,
  }
}

export function getTextStyleCSS(style: TextStyle): React.CSSProperties {
  return {
    fontFamily: style.fontFamily,
    color: style.color,
    fontWeight: style.bold ? 'bold' : 'normal',
    fontStyle: style.italic ? 'italic' : 'normal',
    textDecoration: style.underline ? 'underline' : 'none',
    textAlign: style.alignment,
    lineHeight: style.lineHeight,
    textShadow: style.shadow ? '2px 2px 4px rgba(0,0,0,0.5)' : 'none',
  }
}

export function getJustifyContent(
  alignment: 'left' | 'center' | 'right' | 'justify',
): React.CSSProperties['justifyContent'] {
  switch (alignment) {
    case 'left':
    case 'justify': // Justified text spans full width, use flex-start for container
      return 'flex-start'
    case 'center':
      return 'center'
    case 'right':
      return 'flex-end'
    default:
      return 'flex-start'
  }
}

export function getAlignItems(
  verticalAlignment: 'top' | 'middle' | 'bottom',
): React.CSSProperties['alignItems'] {
  switch (verticalAlignment) {
    case 'top':
      return 'flex-start'
    case 'middle':
      return 'center'
    case 'bottom':
      return 'flex-end'
    default:
      return 'center'
  }
}

export function getBackgroundCSS(
  config: BackgroundConfig,
): React.CSSProperties {
  switch (config.type) {
    case 'transparent':
      return { backgroundColor: 'transparent' }
    case 'color':
      return {
        backgroundColor: config.color || '#000000',
        opacity: config.opacity ?? 1,
      }
    case 'image':
      return {
        backgroundImage: config.imageUrl ? `url(${config.imageUrl})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: config.opacity ?? 1,
      }
    case 'video':
      return { backgroundColor: 'transparent' }
    default:
      return { backgroundColor: '#000000' }
  }
}

function formatConstraintValue(value: number, unit: PositionUnit): string {
  return unit === '%' ? `${value}%` : `${value}px`
}

export interface ConstraintStyles {
  position: 'absolute'
  top?: string
  bottom?: string
  left?: string
  right?: string
  width?: string
  height?: string
}

/**
 * Create default constraints (top-left positioned)
 */
function getDefaultConstraints(): Constraints {
  return {
    top: { enabled: true, value: 0, unit: '%' },
    bottom: { enabled: false, value: 0, unit: '%' },
    left: { enabled: true, value: 0, unit: '%' },
    right: { enabled: false, value: 0, unit: '%' },
  }
}

/**
 * Create default size
 */
function getDefaultSize(): SizeWithUnits {
  return {
    width: 100,
    widthUnit: '%',
    height: 100,
    heightUnit: '%',
  }
}

/**
 * Calculate CSS styles from constraints for rendering
 */
export function calculateConstraintStyles(
  constraints: Constraints | undefined,
  size: SizeWithUnits | undefined,
  screenWidth: number,
  screenHeight: number,
): ConstraintStyles {
  // Use defaults if constraints or size are undefined (legacy data)
  const c = constraints ?? getDefaultConstraints()
  const s = size ?? getDefaultSize()

  const styles: ConstraintStyles = { position: 'absolute' }

  // Horizontal positioning
  if (c.left.enabled) {
    styles.left = formatConstraintValue(c.left.value, c.left.unit)
  }
  if (c.right.enabled) {
    styles.right = formatConstraintValue(c.right.value, c.right.unit)
  }

  // If both left and right are enabled, width is automatic (stretch)
  // Otherwise, apply explicit width
  if (!(c.left.enabled && c.right.enabled)) {
    styles.width = formatConstraintValue(s.width, s.widthUnit)
  }

  // Vertical positioning
  if (c.top.enabled) {
    styles.top = formatConstraintValue(c.top.value, c.top.unit)
  }
  if (c.bottom.enabled) {
    styles.bottom = formatConstraintValue(c.bottom.value, c.bottom.unit)
  }

  // If both top and bottom are enabled, height is automatic (stretch)
  // Otherwise, apply explicit height
  if (!(c.top.enabled && c.bottom.enabled)) {
    styles.height = formatConstraintValue(s.height, s.heightUnit)
  }

  // If no horizontal constraints, default to left: 0
  if (!c.left.enabled && !c.right.enabled) {
    styles.left = '0'
  }

  // If no vertical constraints, default to top: 0
  if (!c.top.enabled && !c.bottom.enabled) {
    styles.top = '0'
  }

  return styles
}

export interface PixelBounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Calculate pixel bounds from constraints for canvas editor
 */
export function calculatePixelBounds(
  constraints: Constraints | undefined,
  size: SizeWithUnits | undefined,
  screenWidth: number,
  screenHeight: number,
): PixelBounds {
  // Use defaults if constraints or size are undefined (legacy data)
  const c = constraints ?? getDefaultConstraints()
  const s = size ?? getDefaultSize()

  // Calculate horizontal bounds
  const leftPx = c.left.enabled
    ? toPixels(c.left.value, c.left.unit, screenWidth)
    : 0
  const rightPx = c.right.enabled
    ? toPixels(c.right.value, c.right.unit, screenWidth)
    : 0

  let x: number
  let width: number

  if (c.left.enabled && c.right.enabled) {
    x = leftPx
    width = screenWidth - leftPx - rightPx
  } else if (c.left.enabled) {
    x = leftPx
    width = toPixels(s.width, s.widthUnit, screenWidth)
  } else if (c.right.enabled) {
    width = toPixels(s.width, s.widthUnit, screenWidth)
    x = screenWidth - rightPx - width
  } else {
    x = 0
    width = toPixels(s.width, s.widthUnit, screenWidth)
  }

  // Calculate vertical bounds
  const topPx = c.top.enabled
    ? toPixels(c.top.value, c.top.unit, screenHeight)
    : 0
  const bottomPx = c.bottom.enabled
    ? toPixels(c.bottom.value, c.bottom.unit, screenHeight)
    : 0

  let y: number
  let height: number

  if (c.top.enabled && c.bottom.enabled) {
    y = topPx
    height = screenHeight - topPx - bottomPx
  } else if (c.top.enabled) {
    y = topPx
    height = toPixels(s.height, s.heightUnit, screenHeight)
  } else if (c.bottom.enabled) {
    height = toPixels(s.height, s.heightUnit, screenHeight)
    y = screenHeight - bottomPx - height
  } else {
    y = 0
    height = toPixels(s.height, s.heightUnit, screenHeight)
  }

  return { x, y, width, height }
}

/**
 * Clamp pixel bounds to ensure they stay within the screen boundaries.
 * Useful for preventing elements from being positioned outside the visible area.
 */
export function clampBoundsToScreen(
  bounds: PixelBounds,
  screenWidth: number,
  screenHeight: number,
): PixelBounds {
  // Ensure width and height are at least 1px and don't exceed screen
  const width = Math.max(1, Math.min(bounds.width, screenWidth))
  const height = Math.max(1, Math.min(bounds.height, screenHeight))

  // Clamp x position: ensure element stays within horizontal bounds
  // x must be >= 0 and x + width must be <= screenWidth
  let x = bounds.x
  if (x < 0) x = 0
  if (x + width > screenWidth) x = screenWidth - width

  // Clamp y position: ensure element stays within vertical bounds
  // y must be >= 0 and y + height must be <= screenHeight
  let y = bounds.y
  if (y < 0) y = 0
  if (y + height > screenHeight) y = screenHeight - height

  return { x, y, width, height }
}

/**
 * Calculate pixel size from SizeWithUnits
 */
export function calculatePixelSizeWithUnits(
  size: SizeWithUnits,
  screenDimensions: ScreenDimensions,
): { width: number; height: number } {
  return {
    width: toPixels(size.width, size.widthUnit, screenDimensions.width),
    height: toPixels(size.height, size.heightUnit, screenDimensions.height),
  }
}

/**
 * Calculate the maximum exit animation duration from a content type config.
 * This finds the longest (duration + delay) across all animated elements.
 * Returns 0 if no exit animations are configured.
 */
export function calculateMaxExitAnimationDuration(
  config: ContentTypeConfig | undefined,
): number {
  if (!config) return 0

  const durations: number[] = []

  // Helper to get total duration from an animation config
  const getTotalDuration = (anim: AnimationConfig | undefined): number => {
    if (!anim || anim.type === 'none') return 0
    return (anim.duration ?? 300) + (anim.delay ?? 0)
  }

  // Check all possible animated elements
  if ('mainText' in config && config.mainText?.animationOut) {
    durations.push(getTotalDuration(config.mainText.animationOut))
  }
  if ('contentText' in config && config.contentText?.animationOut) {
    durations.push(getTotalDuration(config.contentText.animationOut))
  }
  if ('referenceText' in config && config.referenceText?.animationOut) {
    durations.push(getTotalDuration(config.referenceText.animationOut))
  }
  if ('personLabel' in config && config.personLabel?.animationOut) {
    durations.push(getTotalDuration(config.personLabel.animationOut))
  }

  // Return the maximum duration, or 0 if none found
  return durations.length > 0 ? Math.max(...durations) : 0
}

/**
 * Calculate the maximum slide transition OUT duration from a content type config.
 * This finds the longest (duration + delay) across all animated elements' slideTransitionOut configs.
 * Returns default of 250ms if no slide transitions are configured.
 */
export function calculateMaxSlideTransitionOutDuration(
  config: ContentTypeConfig | undefined,
): number {
  if (!config) return 250 // Default slide transition duration

  const durations: number[] = []

  // Helper to get total duration from an animation config
  const getTotalDuration = (anim: AnimationConfig | undefined): number => {
    if (!anim || anim.type === 'none') return 0
    return (anim.duration ?? 250) + (anim.delay ?? 0)
  }

  // Check all possible animated elements for slideTransitionOut
  if ('mainText' in config && config.mainText?.slideTransitionOut) {
    durations.push(getTotalDuration(config.mainText.slideTransitionOut))
  }
  if ('contentText' in config && config.contentText?.slideTransitionOut) {
    durations.push(getTotalDuration(config.contentText.slideTransitionOut))
  }
  if ('referenceText' in config && config.referenceText?.slideTransitionOut) {
    durations.push(getTotalDuration(config.referenceText.slideTransitionOut))
  }
  if ('personLabel' in config && config.personLabel?.slideTransitionOut) {
    durations.push(getTotalDuration(config.personLabel.slideTransitionOut))
  }

  // Return the maximum duration, or default of 250ms if none found
  return durations.length > 0 ? Math.max(...durations) : 250
}

/**
 * Calculate the maximum slide transition IN duration from a content type config.
 * This finds the longest (duration + delay) across all animated elements' slideTransitionIn configs.
 * Returns default of 250ms if no slide transitions are configured.
 */
export function calculateMaxSlideTransitionInDuration(
  config: ContentTypeConfig | undefined,
): number {
  if (!config) return 250 // Default slide transition duration

  const durations: number[] = []

  // Helper to get total duration from an animation config
  const getTotalDuration = (anim: AnimationConfig | undefined): number => {
    if (!anim || anim.type === 'none') return 0
    return (anim.duration ?? 250) + (anim.delay ?? 0)
  }

  // Check all possible animated elements for slideTransitionIn
  if ('mainText' in config && config.mainText?.slideTransitionIn) {
    durations.push(getTotalDuration(config.mainText.slideTransitionIn))
  }
  if ('contentText' in config && config.contentText?.slideTransitionIn) {
    durations.push(getTotalDuration(config.contentText.slideTransitionIn))
  }
  if ('referenceText' in config && config.referenceText?.slideTransitionIn) {
    durations.push(getTotalDuration(config.referenceText.slideTransitionIn))
  }
  if ('personLabel' in config && config.personLabel?.slideTransitionIn) {
    durations.push(getTotalDuration(config.personLabel.slideTransitionIn))
  }

  // Return the maximum duration, or default of 250ms if none found
  return durations.length > 0 ? Math.max(...durations) : 250
}
