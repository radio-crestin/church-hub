import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: seed logging
  console.log(`[seed-screens:${level}] ${message}`)
}

// Screen types
type ScreenType = 'primary' | 'stage' | 'livestream'

// Content types that can be rendered on screens
const contentTypes = [
  'song',
  'bible',
  'bible_passage',
  'announcement',
  'versete_tineri',
  'empty',
] as const

type ContentType = (typeof contentTypes)[number]

// Default screens to create
const DEFAULT_SCREENS: Array<{
  name: string
  type: ScreenType
  sortOrder: number
}> = [
  { name: 'Main Projector', type: 'primary', sortOrder: 0 },
  { name: 'Stage Monitor', type: 'stage', sortOrder: 1 },
  { name: 'Live Stream', type: 'livestream', sortOrder: 2 },
]

// ============================================================================
// HELPER FUNCTIONS (copied from screens.ts to keep seed self-contained)
// ============================================================================

type PositionUnit = '%' | 'px'

function constraint(enabled: boolean, value: number, unit: PositionUnit = '%') {
  return { enabled, value, unit }
}

function constraints(top: number, left: number, unit: PositionUnit = '%') {
  return {
    top: constraint(true, top, unit),
    bottom: constraint(false, 0, unit),
    left: constraint(true, left, unit),
    right: constraint(false, 0, unit),
  }
}

function constraintsAll(
  top: number | null,
  right: number | null,
  bottom: number | null,
  left: number | null,
  unit: PositionUnit = '%',
) {
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
) {
  return { width, widthUnit, height, heightUnit }
}

function getDefaultGlobalSettings() {
  return {
    defaultBackground: {
      type: 'color',
      color: '#000000',
      opacity: 1,
    },
    clockEnabled: false,
  }
}

function getDefaultTextStyle(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  }
}

function getDefaultAnimation(type: 'in' | 'out') {
  return {
    type: 'fade',
    duration: type === 'in' ? 300 : 200,
    delay: 0,
    easing: type === 'in' ? 'ease-out' : 'ease-in',
  }
}

function getDefaultBackground() {
  return {
    type: 'color' as const,
    color: '#000000',
    opacity: 1,
  }
}

function getDefaultClockConfig(enabled = false) {
  return {
    enabled,
    constraints: constraints(2, 85),
    size: sizeWithUnits(10, 5),
    style: getDefaultTextStyle({
      maxFontSize: 32,
      autoScale: false,
      alignment: 'right',
    }),
    format: '24h' as const,
    showSeconds: false,
  }
}

function getDefaultSongConfig() {
  return {
    background: getDefaultBackground(),
    mainText: {
      constraints: constraints(10, 5),
      size: sizeWithUnits(90, 80),
      style: getDefaultTextStyle({ maxFontSize: 120 }),
      padding: 20,
      animationIn: getDefaultAnimation('in'),
      animationOut: getDefaultAnimation('out'),
    },
    clock: getDefaultClockConfig(),
  }
}

function getDefaultBibleConfig() {
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
      animationIn: getDefaultAnimation('in'),
      animationOut: getDefaultAnimation('out'),
    },
    clock: getDefaultClockConfig(),
  }
}

function getDefaultAnnouncementConfig() {
  return {
    background: getDefaultBackground(),
    mainText: {
      constraints: constraints(10, 5),
      size: sizeWithUnits(90, 85),
      style: getDefaultTextStyle({ maxFontSize: 100 }),
      padding: 20,
      animationIn: getDefaultAnimation('in'),
      animationOut: getDefaultAnimation('out'),
    },
    clock: getDefaultClockConfig(),
  }
}

function getDefaultVerseteTineriConfig() {
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
      animationIn: getDefaultAnimation('in'),
      animationOut: getDefaultAnimation('out'),
    },
    clock: getDefaultClockConfig(),
  }
}

function getDefaultEmptyConfig() {
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
      format: '24h' as const,
      showSeconds: true,
    },
  }
}

function getDefaultContentConfig(
  contentType: ContentType,
): Record<string, unknown> {
  switch (contentType) {
    case 'song':
      return getDefaultSongConfig()
    case 'bible':
    case 'bible_passage':
      return getDefaultBibleConfig()
    case 'announcement':
      return getDefaultAnnouncementConfig()
    case 'versete_tineri':
      return getDefaultVerseteTineriConfig()
    case 'empty':
      return getDefaultEmptyConfig()
  }
}

function getDefaultNextSlideConfig() {
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

function getScreenDimensions(type: ScreenType): {
  width: number
  height: number
} {
  switch (type) {
    case 'primary':
    case 'stage':
      return { width: 1920, height: 1080 }
    case 'livestream':
      return { width: 1080, height: 420 }
  }
}

function adjustConfigForStage(config: Record<string, unknown>) {
  // Reduce content height to leave room for next slide section
  if (config.mainText && typeof config.mainText === 'object') {
    const mainText = config.mainText as Record<string, unknown>
    if (mainText.size && typeof mainText.size === 'object') {
      const size = mainText.size as Record<string, unknown>
      if (typeof size.height === 'number') {
        size.height = Math.min(size.height, 65)
      }
    }
  }
  if (config.contentText && typeof config.contentText === 'object') {
    const contentText = config.contentText as Record<string, unknown>
    if (contentText.size && typeof contentText.size === 'object') {
      const size = contentText.size as Record<string, unknown>
      if (typeof size.height === 'number') {
        size.height = Math.min(size.height, 63)
      }
    }
  }
}

function adjustConfigForLivestream(config: Record<string, unknown>) {
  // Use transparent background and add shadows
  config.background = { type: 'transparent', opacity: 1 }

  const addShadow = (element: unknown) => {
    if (element && typeof element === 'object') {
      const el = element as Record<string, unknown>
      if (el.style && typeof el.style === 'object') {
        ;(el.style as Record<string, unknown>).shadow = true
      }
    }
  }

  addShadow(config.mainText)
  addShadow(config.contentText)
  addShadow(config.referenceText)
  addShadow(config.personLabel)
  addShadow(config.clock)
}

// ============================================================================
// SEED FUNCTION
// ============================================================================

/**
 * Seeds default screens with their configurations
 * Uses count check to avoid duplicates on subsequent runs
 */
export function seedDefaultScreens(db: Database): void {
  log('debug', 'Checking if screens need to be seeded...')

  // Check if any screens already exist
  const existingCount = db
    .query('SELECT COUNT(*) as count FROM screens')
    .get() as { count: number }

  if (existingCount.count > 0) {
    log(
      'debug',
      `Screens already exist (${existingCount.count}), skipping seed`,
    )
    return
  }

  log('info', 'Seeding default screens...')

  for (const screen of DEFAULT_SCREENS) {
    const dimensions = getScreenDimensions(screen.type)
    const globalSettings = JSON.stringify(getDefaultGlobalSettings())

    // Insert screen
    db.run(
      `INSERT INTO screens
        (name, type, is_active, open_mode, is_fullscreen, width, height, global_settings, sort_order, created_at, updated_at)
        VALUES (?, ?, 1, 'browser', 0, ?, ?, ?, ?, unixepoch(), unixepoch())`,
      [
        screen.name,
        screen.type,
        dimensions.width,
        dimensions.height,
        globalSettings,
        screen.sortOrder,
      ],
    )

    // Get the inserted screen ID
    const inserted = db
      .query('SELECT id FROM screens WHERE name = ?')
      .get(screen.name) as { id: number } | null

    if (inserted) {
      // Create content configs for all content types
      for (const contentType of contentTypes) {
        const config = getDefaultContentConfig(contentType)

        // Apply screen-type specific adjustments
        if (screen.type === 'stage') {
          adjustConfigForStage(config)
        }
        if (screen.type === 'livestream') {
          adjustConfigForLivestream(config)
        }

        db.run(
          `INSERT INTO screen_content_configs
            (screen_id, content_type, config, created_at, updated_at)
            VALUES (?, ?, ?, unixepoch(), unixepoch())`,
          [inserted.id, contentType, JSON.stringify(config)],
        )
      }

      // Create next slide config for stage screens only
      if (screen.type === 'stage') {
        db.run(
          `INSERT INTO screen_next_slide_configs
            (screen_id, config, created_at, updated_at)
            VALUES (?, ?, unixepoch(), unixepoch())`,
          [inserted.id, JSON.stringify(getDefaultNextSlideConfig())],
        )
      }

      log('debug', `Seeded screen: ${screen.name} (${screen.type})`)
    }
  }

  log('info', `Seeded ${DEFAULT_SCREENS.length} default screens`)
}
