import type {
  AnimationConfig,
  AnnouncementContentConfig,
  BibleContentConfig,
  ClockElementConfig,
  Constraint,
  Constraints,
  ContentConfigMap,
  EmptyContentConfig,
  NextSlideSectionConfig,
  PositionUnit,
  ScreenBackgroundConfig,
  ScreenGlobalSettings,
  ScreenType,
  SizeWithUnits,
  SongContentConfig,
  TextStyle,
  VerseteTineriContentConfig,
} from '../types'

// ============================================================================
// DEFAULT STYLES
// ============================================================================

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

export function getDefaultAnimationIn(): AnimationConfig {
  return {
    type: 'fade',
    duration: 300,
    delay: 0,
    easing: 'ease-out',
  }
}

export function getDefaultAnimationOut(): AnimationConfig {
  return {
    type: 'fade',
    duration: 200,
    delay: 0,
    easing: 'ease-in',
  }
}

export function getDefaultBackground(): ScreenBackgroundConfig {
  return {
    type: 'color',
    color: '#000000',
    opacity: 1,
  }
}

// ============================================================================
// CONSTRAINT AND SIZE HELPERS
// ============================================================================

function constraint(
  enabled: boolean,
  value: number,
  unit: PositionUnit = '%',
): Constraint {
  return { enabled, value, unit }
}

/**
 * Create constraints with top+left enabled (mimics old x,y positioning)
 */
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

/**
 * Create constraints with all four edges configurable
 */
function constraintsAll(
  top: number | null,
  right: number | null,
  bottom: number | null,
  left: number | null,
  unit: PositionUnit = '%',
): Constraints {
  return {
    top: constraint(top !== null, top ?? 0, unit),
    right: constraint(right !== null, right ?? 0, unit),
    bottom: constraint(bottom !== null, bottom ?? 0, unit),
    left: constraint(left !== null, left ?? 0, unit),
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

// ============================================================================
// SONG CONTENT CONFIG
// ============================================================================

export function getDefaultSongConfig(): SongContentConfig {
  return {
    background: getDefaultBackground(),
    mainText: {
      constraints: constraints(10, 5),
      size: sizeWithUnits(90, 80),
      style: getDefaultTextStyle({ maxFontSize: 120 }),
      padding: 20,
      animationIn: getDefaultAnimationIn(),
      animationOut: getDefaultAnimationOut(),
    },
    clock: getDefaultClockConfig(),
  }
}

// ============================================================================
// BIBLE CONTENT CONFIG
// ============================================================================

export function getDefaultBibleConfig(): BibleContentConfig {
  return {
    background: getDefaultBackground(),
    referenceText: {
      constraints: constraints(2, 5),
      size: sizeWithUnits(80, 8),
      style: getDefaultTextStyle({
        maxFontSize: 36,
        autoScale: false,
        alignment: 'left',
        bold: true,
      }),
    },
    contentText: {
      constraints: constraints(12, 5),
      size: sizeWithUnits(90, 83),
      style: getDefaultTextStyle({ maxFontSize: 100 }),
      padding: 20,
      animationIn: getDefaultAnimationIn(),
      animationOut: getDefaultAnimationOut(),
    },
    clock: getDefaultClockConfig(),
    includeReferenceInContent: false,
  }
}

// ============================================================================
// ANNOUNCEMENT CONTENT CONFIG
// ============================================================================

export function getDefaultAnnouncementConfig(): AnnouncementContentConfig {
  return {
    background: getDefaultBackground(),
    mainText: {
      constraints: constraints(10, 5),
      size: sizeWithUnits(90, 85),
      style: getDefaultTextStyle({ maxFontSize: 100 }),
      padding: 20,
      animationIn: getDefaultAnimationIn(),
      animationOut: getDefaultAnimationOut(),
    },
    clock: getDefaultClockConfig(),
  }
}

// ============================================================================
// VERSETE TINERI CONTENT CONFIG
// ============================================================================

export function getDefaultVerseteTineriConfig(): VerseteTineriContentConfig {
  return {
    background: getDefaultBackground(),
    personLabel: {
      constraints: constraints(2, 5),
      size: sizeWithUnits(40, 5),
      style: getDefaultTextStyle({
        maxFontSize: 28,
        autoScale: false,
        alignment: 'left',
        italic: true,
      }),
    },
    referenceText: {
      constraints: constraints(8, 5),
      size: sizeWithUnits(80, 8),
      style: getDefaultTextStyle({
        maxFontSize: 32,
        autoScale: false,
        alignment: 'left',
        bold: true,
      }),
    },
    contentText: {
      constraints: constraints(18, 5),
      size: sizeWithUnits(90, 77),
      style: getDefaultTextStyle({ maxFontSize: 90 }),
      padding: 20,
      animationIn: getDefaultAnimationIn(),
      animationOut: getDefaultAnimationOut(),
    },
    clock: getDefaultClockConfig(),
  }
}

// ============================================================================
// EMPTY/IDLE CONTENT CONFIG
// ============================================================================

export function getDefaultEmptyConfig(): EmptyContentConfig {
  return {
    background: getDefaultBackground(),
    clock: {
      enabled: true,
      constraints: constraints(5, 80),
      size: sizeWithUnits(15, 8),
      style: getDefaultTextStyle({
        maxFontSize: 48,
        autoScale: false,
        alignment: 'right',
      }),
      format: '24h',
      showSeconds: true,
    },
  }
}

// ============================================================================
// STAGE SCREEN NEXT SLIDE CONFIG
// ============================================================================

export function getDefaultNextSlideConfig(): NextSlideSectionConfig {
  return {
    enabled: true,
    constraints: constraintsAll(78, 0, 0, 0),
    size: sizeWithUnits(100, 22),
    labelText: 'Urmeaza:',
    labelStyle: getDefaultTextStyle({
      maxFontSize: 24,
      autoScale: false,
      alignment: 'left',
      bold: true,
      color: '#cccccc',
    }),
    contentStyle: getDefaultTextStyle({
      maxFontSize: 32,
      autoScale: true,
      alignment: 'left',
    }),
    background: {
      type: 'color',
      color: '#1a1a1a',
      opacity: 0.8,
    },
  }
}

// ============================================================================
// SCREEN GLOBAL SETTINGS
// ============================================================================

export function getDefaultGlobalSettings(): ScreenGlobalSettings {
  return {
    defaultBackground: getDefaultBackground(),
    clockEnabled: false,
    clockConfig: getDefaultClockConfig(),
  }
}

// ============================================================================
// COMPLETE SCREEN CONFIGS BY TYPE
// ============================================================================

export function getDefaultContentConfigs(
  screenType: ScreenType,
): ContentConfigMap {
  // For stage screens, adjust heights to account for next slide section
  const isStage = screenType === 'stage'
  const isLivestream = screenType === 'livestream'

  // Base configs
  const songConfig = getDefaultSongConfig()
  const bibleConfig = getDefaultBibleConfig()
  const announcementConfig = getDefaultAnnouncementConfig()
  const verseteTineriConfig = getDefaultVerseteTineriConfig()
  const emptyConfig = getDefaultEmptyConfig()

  // Adjust for stage screens (content gets 78% height)
  if (isStage) {
    songConfig.mainText.size.height = 65
    bibleConfig.contentText.size.height = 63
    announcementConfig.mainText.size.height = 65
    verseteTineriConfig.contentText.size.height = 57
  }

  // Adjust for livestream (transparent background, shadow on text)
  if (isLivestream) {
    const transparentBg: ScreenBackgroundConfig = {
      type: 'transparent',
      opacity: 1,
    }
    const addShadow = (config: { style: TextStyle }) => {
      config.style.shadow = true
    }

    songConfig.background = transparentBg
    addShadow(songConfig.mainText)
    songConfig.mainText.animationIn.type = 'slide-up'
    songConfig.mainText.animationIn.duration = 200
    songConfig.mainText.animationOut.type = 'slide-down'
    songConfig.mainText.animationOut.duration = 150

    bibleConfig.background = transparentBg
    addShadow(bibleConfig.referenceText)
    addShadow(bibleConfig.contentText)

    announcementConfig.background = transparentBg
    addShadow(announcementConfig.mainText)

    verseteTineriConfig.background = transparentBg
    addShadow(verseteTineriConfig.personLabel)
    addShadow(verseteTineriConfig.referenceText)
    addShadow(verseteTineriConfig.contentText)

    emptyConfig.background = transparentBg
    addShadow(emptyConfig.clock)
  }

  return {
    song: songConfig,
    bible: bibleConfig,
    bible_passage: bibleConfig, // Same as bible
    announcement: announcementConfig,
    versete_tineri: verseteTineriConfig,
    empty: emptyConfig,
  }
}

/**
 * Get default screen dimensions by type
 */
export function getDefaultScreenDimensions(screenType: ScreenType): {
  width: number
  height: number
} {
  switch (screenType) {
    case 'primary':
    case 'stage':
      return { width: 1920, height: 1080 }
    case 'livestream':
      return { width: 1080, height: 420 }
  }
}

/**
 * Get a complete screen config with all defaults
 */
export function getCompleteDefaultConfigs(screenType: ScreenType): {
  contentConfigs: ContentConfigMap
  nextSlideConfig?: NextSlideSectionConfig
  globalSettings: ScreenGlobalSettings
} {
  return {
    contentConfigs: getDefaultContentConfigs(screenType),
    nextSlideConfig:
      screenType === 'stage' ? getDefaultNextSlideConfig() : undefined,
    globalSettings: getDefaultGlobalSettings(),
  }
}
