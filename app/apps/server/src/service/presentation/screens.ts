import { and, asc, eq, ne, sql } from 'drizzle-orm'

import type {
  ContentType,
  DisplayOpenMode,
  NextSlideSectionConfig,
  OperationResult,
  Screen,
  ScreenGlobalSettings,
  ScreenType,
  ScreenWithConfigs,
  UpdateContentConfigInput,
  UpdateNextSlideConfigInput,
  UpsertScreenInput,
} from './types'
import { getDatabase } from '../../db'
import {
  contentTypes,
  screenContentConfigs,
  screenNextSlideConfigs,
  screenSceneOverrides,
  screens,
} from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('screens')

// ============================================================================
// DEFAULT CONFIGURATIONS
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

function getDefaultGlobalSettings(): ScreenGlobalSettings {
  return {
    defaultBackground: {
      type: 'color',
      color: '#000000',
      opacity: 1,
    },
    clockConfig: getDefaultClockConfig(),
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
    // Song key ("gama") — shown on the FIRST slide. Separately positionable /
    // styleable element (like the Bible reference). Top-left by default.
    songKey: {
      constraints: constraints(2, 5),
      size: sizeWithUnits(40, 6),
      style: getDefaultTextStyle({
        maxFontSize: 32,
        autoScale: false,
        alignment: 'left',
        bold: true,
      }),
      animationIn: getDefaultAnimation('in'),
      animationOut: getDefaultAnimation('out'),
    },
    // "Amin" — shown on the LAST slide. Bottom band, centered, by default.
    amen: {
      constraints: constraints(85, 5),
      size: sizeWithUnits(90, 10),
      style: getDefaultTextStyle({
        maxFontSize: 48,
        autoScale: false,
        alignment: 'center',
        italic: true,
      }),
      animationIn: getDefaultAnimation('in'),
      animationOut: getDefaultAnimation('out'),
    },
    clockEnabled: false,
  }
}

// Layout for a song's FIRST slide only ("Cântec - Primul Slide"): two elements — the
// song key (gama) and the slide lyrics (strofa) — positioned/styled separately
// from the rest of the song's slides (which keep the `song` config). Defaults
// mirror the `song` config so there is no visual jump until the operator
// repositions them. Chord/keyline display stay on the `song` config (single
// source), so this layout has no displayChords/displayKeyLine of its own.
function getDefaultSongFirstSlideConfig() {
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
    songKey: {
      constraints: constraints(2, 5),
      size: sizeWithUnits(40, 6),
      style: getDefaultTextStyle({
        maxFontSize: 32,
        autoScale: false,
        alignment: 'left',
        bold: true,
      }),
      animationIn: getDefaultAnimation('in'),
      animationOut: getDefaultAnimation('out'),
    },
    clockEnabled: false,
  }
}

// Layout for a song's LAST slide only ("Cântec - Ultimul Slide"): two elements — the
// slide lyrics (strofa) and the "Amin" — positioned/styled separately from the
// rest of the song's slides (which keep the `song` config). Defaults mirror the
// `song` config so there is no visual jump until the operator repositions them.
function getDefaultSongLastSlideConfig() {
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
    amen: {
      constraints: constraints(85, 5),
      size: sizeWithUnits(90, 10),
      style: getDefaultTextStyle({
        maxFontSize: 48,
        autoScale: false,
        alignment: 'center',
        italic: true,
      }),
      animationIn: getDefaultAnimation('in'),
      animationOut: getDefaultAnimation('out'),
    },
    clockEnabled: false,
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
      animationIn: getDefaultAnimation('in'),
      animationOut: getDefaultAnimation('out'),
    },
    contentText: {
      constraints: constraints(12, 5),
      size: sizeWithUnits(90, 83),
      style: getDefaultTextStyle({ maxFontSize: 100 }),
      padding: 20,
      animationIn: getDefaultAnimation('in'),
      animationOut: getDefaultAnimation('out'),
    },
    clockEnabled: false,
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
    clockEnabled: false,
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
      animationIn: getDefaultAnimation('in'),
      animationOut: getDefaultAnimation('out'),
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
      animationIn: getDefaultAnimation('in'),
      animationOut: getDefaultAnimation('out'),
    },
    contentText: {
      constraints: constraints(18, 5),
      size: sizeWithUnits(90, 77),
      style: getDefaultTextStyle({ maxFontSize: 90 }),
      padding: 20,
      animationIn: getDefaultAnimation('in'),
      animationOut: getDefaultAnimation('out'),
    },
    clockEnabled: false,
  }
}

function getDefaultEmptyConfig() {
  return {
    background: getDefaultBackground(),
    clockEnabled: true, // Clock typically enabled on empty/idle screen
  }
}

function getDefaultScreenShareConfig() {
  return {
    background: getDefaultBackground(),
    videoElement: {
      constraints: constraintsAll(0, 0, 0, 0), // Fullscreen by default
      size: sizeWithUnits(100, 100),
      objectFit: 'contain' as const,
    },
    clockEnabled: false, // Clock typically not needed during screen share
  }
}

function getDefaultContentConfig(
  contentType: ContentType,
): Record<string, unknown> {
  switch (contentType) {
    case 'song':
      return getDefaultSongConfig()
    case 'song_first_slide':
      return getDefaultSongFirstSlideConfig()
    case 'song_last_slide':
      return getDefaultSongLastSlideConfig()
    case 'bible':
    case 'bible_passage':
      return getDefaultBibleConfig()
    case 'announcement':
      return getDefaultAnnouncementConfig()
    case 'versete_tineri':
      return getDefaultVerseteTineriConfig()
    case 'empty':
      return getDefaultEmptyConfig()
    case 'screen_share':
      return getDefaultScreenShareConfig()
  }
}

function getDefaultNextSlideConfig(): NextSlideSectionConfig {
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
    }) as NextSlideSectionConfig['labelStyle'],
    contentStyle: getDefaultTextStyle({
      maxFontSize: 32,
      autoScale: true,
      alignment: 'left',
    }) as NextSlideSectionConfig['contentStyle'],
    background: {
      type: 'color',
      color: '#1a1a1a',
      opacity: 0.8,
    },
  }
}

// ============================================================================
// PARSING HELPERS
// ============================================================================

function parseGlobalSettings(json: string): ScreenGlobalSettings {
  try {
    const parsed = JSON.parse(json) as Partial<ScreenGlobalSettings>
    return { ...getDefaultGlobalSettings(), ...parsed }
  } catch {
    return getDefaultGlobalSettings()
  }
}

function parseConfig(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json)
  } catch {
    return {}
  }
}

/**
 * Parse a stored content config and merge it over the per-type default so
 * configs persisted by older app versions (or saved partially) always have the
 * required top-level fields like `background`. Without this, the editor crashes
 * reading `config.background.type` on a drifted config (same defensive pattern
 * as parseNextSlideConfig).
 */
export function parseContentConfig(
  contentType: ContentType,
  json: string,
): Record<string, unknown> {
  return {
    ...getDefaultContentConfig(contentType),
    ...parseConfig(json),
  }
}

export function parseNextSlideConfig(json: string): NextSlideSectionConfig {
  try {
    const defaults = getDefaultNextSlideConfig()
    const parsed = JSON.parse(json) as Partial<NextSlideSectionConfig>
    return {
      ...defaults,
      ...parsed,
      labelStyle: { ...defaults.labelStyle, ...parsed.labelStyle },
      contentStyle: { ...defaults.contentStyle, ...parsed.contentStyle },
      background: { ...defaults.background, ...parsed.background },
    }
  } catch {
    return getDefaultNextSlideConfig()
  }
}

// ============================================================================
// CONVERTERS
// ============================================================================

function toScreen(record: typeof screens.$inferSelect): Screen {
  return {
    id: record.id,
    name: record.name,
    type: record.type as ScreenType,
    isActive: record.isActive,
    openMode: (record.openMode as DisplayOpenMode) || 'browser',
    isFullscreen: record.isFullscreen,
    alwaysOnTop: record.alwaysOnTop,
    closeOnEscape: record.closeOnEscape,
    isPreviewScreen: record.isPreviewScreen,
    width: record.width,
    height: record.height,
    globalSettings: parseGlobalSettings(record.globalSettings),
    sortOrder: record.sortOrder,
    createdAt:
      record.createdAt instanceof Date
        ? Math.floor(record.createdAt.getTime() / 1000)
        : (record.createdAt as unknown as number),
    updatedAt:
      record.updatedAt instanceof Date
        ? Math.floor(record.updatedAt.getTime() / 1000)
        : (record.updatedAt as unknown as number),
  }
}

// ============================================================================
// SCREEN CRUD OPERATIONS
// ============================================================================

export function getAllScreens(): Screen[] {
  try {
    logger.debug('Getting all screens')

    const db = getDatabase()
    const records = db
      .select()
      .from(screens)
      .orderBy(asc(screens.sortOrder), asc(screens.createdAt))
      .all()

    return records.map(toScreen)
  } catch (error) {
    logger.error(`Failed to get all screens: ${error}`)
    return []
  }
}

export function getActiveScreens(): Screen[] {
  try {
    logger.debug('Getting active screens')

    const db = getDatabase()
    const records = db
      .select()
      .from(screens)
      .where(eq(screens.isActive, true))
      .orderBy(asc(screens.sortOrder), asc(screens.createdAt))
      .all()

    return records.map(toScreen)
  } catch (error) {
    logger.error(`Failed to get active screens: ${error}`)
    return []
  }
}

export function getScreenById(id: number): Screen | null {
  try {
    logger.debug(`Getting screen by ID: ${id}`)

    const db = getDatabase()
    const record = db.select().from(screens).where(eq(screens.id, id)).get()

    if (!record) {
      logger.debug(`Screen not found: ${id}`)
      return null
    }

    return toScreen(record)
  } catch (error) {
    logger.error(`Failed to get screen: ${error}`)
    return null
  }
}

export function getScreenWithConfigs(id: number): ScreenWithConfigs | null {
  try {
    logger.debug(`Getting screen with configs: ${id}`)

    const screen = getScreenById(id)
    if (!screen) return null

    const db = getDatabase()

    // Get all content configs for this screen
    const configRecords = db
      .select()
      .from(screenContentConfigs)
      .where(eq(screenContentConfigs.screenId, id))
      .all()

    // Build config map with defaults for missing types
    const configMap: Record<
      ContentType,
      Record<string, unknown>
    > = {} as Record<ContentType, Record<string, unknown>>

    for (const type of contentTypes) {
      const existing = configRecords.find((r) => r.contentType === type)
      if (existing) {
        configMap[type] = parseContentConfig(type, existing.config)
      } else {
        configMap[type] = getDefaultContentConfig(type)
      }
    }

    // Get next slide config for all screen types
    let nextSlideConfig: NextSlideSectionConfig | undefined
    const nextSlideRecord = db
      .select()
      .from(screenNextSlideConfigs)
      .where(eq(screenNextSlideConfigs.screenId, id))
      .get()

    if (nextSlideRecord) {
      nextSlideConfig = parseNextSlideConfig(nextSlideRecord.config)
    } else {
      // Create default config - enabled by default only for stage screens
      nextSlideConfig = {
        ...getDefaultNextSlideConfig(),
        enabled: screen.type === 'stage',
      }
    }

    // Get scene overrides for this screen
    const overrideRecords = db
      .select()
      .from(screenSceneOverrides)
      .where(eq(screenSceneOverrides.screenId, id))
      .all()

    // Build scene overrides map: sceneName → contentType → config
    const sceneOverrides: Record<
      string,
      Record<string, Record<string, unknown>>
    > = {}
    for (const record of overrideRecords) {
      if (!sceneOverrides[record.obsSceneName]) {
        sceneOverrides[record.obsSceneName] = {}
      }
      sceneOverrides[record.obsSceneName][record.contentType] = parseConfig(
        record.config,
      )
    }

    return {
      ...screen,
      contentConfigs: configMap,
      nextSlideConfig,
      sceneOverrides:
        Object.keys(sceneOverrides).length > 0 ? sceneOverrides : undefined,
    }
  } catch (error) {
    logger.error(`Failed to get screen with configs (id=${id}): ${error}`)
    // biome-ignore lint/suspicious/noConsole: critical error debug
    console.error(`[screens] getScreenWithConfigs(${id}) error:`, error)
    return null
  }
}

export function upsertScreen(input: UpsertScreenInput): Screen | null {
  try {
    const db = getDatabase()
    const globalSettingsJson = JSON.stringify(
      input.globalSettings ?? getDefaultGlobalSettings(),
    )
    const openMode = input.openMode ?? 'browser'
    const screenType = input.type ?? 'primary'

    // Get default dimensions for screen type
    const defaultDimensions = getScreenDimensions(screenType)
    const width = input.width ?? defaultDimensions.width
    const height = input.height ?? defaultDimensions.height

    if (input.id) {
      // Update existing screen
      logger.debug(`Updating screen: ${input.id}`)

      // Build update object - only update fields that are explicitly provided
      const updateData: Record<string, unknown> = {
        name: input.name,
        type: screenType,
        updatedAt: sql`(unixepoch())`,
      }

      // Only update optional fields if explicitly provided
      if (input.openMode !== undefined) {
        updateData.openMode = input.openMode
      }
      if (input.isFullscreen !== undefined) {
        updateData.isFullscreen = input.isFullscreen
      }
      if (input.width !== undefined) {
        updateData.width = input.width
      }
      if (input.height !== undefined) {
        updateData.height = input.height
      }
      if (input.globalSettings !== undefined) {
        updateData.globalSettings = JSON.stringify(input.globalSettings)
      }
      if (input.sortOrder !== undefined) {
        updateData.sortOrder = input.sortOrder
      }
      if (input.isActive !== undefined) {
        updateData.isActive = input.isActive
      }
      if (input.alwaysOnTop !== undefined) {
        updateData.alwaysOnTop = input.alwaysOnTop
      }
      if (input.closeOnEscape !== undefined) {
        updateData.closeOnEscape = input.closeOnEscape
      }
      if (input.isPreviewScreen !== undefined) {
        updateData.isPreviewScreen = input.isPreviewScreen
        // Enforce a single preview screen: clear the flag on every other screen
        if (input.isPreviewScreen) {
          db.update(screens)
            .set({
              isPreviewScreen: false,
              updatedAt: sql`(unixepoch())` as unknown as Date,
            })
            .where(ne(screens.id, input.id))
            .run()
        }
      }

      db.update(screens).set(updateData).where(eq(screens.id, input.id)).run()

      logger.info(`Screen updated: ${input.id}`)
      return getScreenById(input.id)
    }

    // Create new screen
    logger.debug(`Creating screen: ${input.name}`)

    const inserted = db
      .insert(screens)
      .values({
        name: input.name,
        type: screenType,
        isActive: input.isActive === true,
        openMode,
        isFullscreen: input.isFullscreen === true,
        alwaysOnTop: input.alwaysOnTop === true,
        closeOnEscape: input.closeOnEscape === true,
        isPreviewScreen: input.isPreviewScreen === true,
        width,
        height,
        globalSettings: globalSettingsJson,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning({ id: screens.id })
      .get()

    // Enforce a single preview screen: if this new screen is the preview, clear
    // the flag on every other screen.
    if (input.isPreviewScreen === true) {
      db.update(screens)
        .set({
          isPreviewScreen: false,
          updatedAt: sql`(unixepoch())` as unknown as Date,
        })
        .where(ne(screens.id, inserted.id))
        .run()
    }

    // Create default content configs for all content types
    for (const contentType of contentTypes) {
      const config = getDefaultContentConfig(contentType)
      // Adjust for stage screen
      if (screenType === 'stage') {
        adjustConfigForStage(config)
      }
      // Adjust for livestream
      if (screenType === 'livestream') {
        adjustConfigForLivestream(config)
      }

      db.insert(screenContentConfigs)
        .values({
          screenId: inserted.id,
          contentType,
          config: JSON.stringify(config),
        })
        .run()
    }

    // Create default next slide config for all screen types
    // Stage screens have it enabled by default, others have it disabled
    const nextSlideConfig = {
      ...getDefaultNextSlideConfig(),
      enabled: screenType === 'stage',
    }
    db.insert(screenNextSlideConfigs)
      .values({
        screenId: inserted.id,
        config: JSON.stringify(nextSlideConfig),
      })
      .run()

    logger.info(`Screen created: ${inserted.id}`)
    return getScreenById(inserted.id)
  } catch (error) {
    logger.error(`Failed to upsert screen: ${error}`)
    return null
  }
}

function getScreenDimensions(type: ScreenType): {
  width: number
  height: number
} {
  switch (type) {
    case 'primary':
    case 'stage':
    case 'kiosk':
      return { width: 1920, height: 1080 }
    case 'livestream':
      return { width: 1080, height: 420 }
  }
}

function adjustConfigForStage(config: Record<string, unknown>) {
  // Reduce content height to 78% to leave room for next slide section
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

export function deleteScreen(id: number): OperationResult {
  try {
    logger.debug(`Deleting screen: ${id}`)

    const db = getDatabase()
    // Content configs and next slide configs are deleted via CASCADE
    db.delete(screens).where(eq(screens.id, id)).run()

    logger.info(`Screen deleted: ${id}`)
    return { success: true }
  } catch (error) {
    logger.error(`Failed to delete screen: ${error}`)
    return { success: false, error: String(error) }
  }
}

// ============================================================================
// CONTENT CONFIG OPERATIONS
// ============================================================================

export function updateContentConfig(
  input: UpdateContentConfigInput,
): OperationResult {
  try {
    logger.debug(
      `Updating content config: screen=${input.screenId}, type=${input.contentType}`,
    )

    const db = getDatabase()
    const configJson = JSON.stringify(input.config)

    // Check if config exists - use and() to combine conditions
    const existing = db
      .select()
      .from(screenContentConfigs)
      .where(
        and(
          eq(screenContentConfigs.screenId, input.screenId),
          eq(screenContentConfigs.contentType, input.contentType),
        ),
      )
      .get()

    if (existing) {
      db.update(screenContentConfigs)
        .set({
          config: configJson,
          updatedAt: sql`(unixepoch())` as unknown as Date,
        })
        .where(eq(screenContentConfigs.id, existing.id))
        .run()
    } else {
      db.insert(screenContentConfigs)
        .values({
          screenId: input.screenId,
          contentType: input.contentType,
          config: configJson,
        })
        .run()
    }

    logger.info(
      `Content config updated: screen=${input.screenId}, type=${input.contentType}`,
    )
    return { success: true }
  } catch (error) {
    logger.error(`Failed to update content config: ${error}`)
    return { success: false, error: String(error) }
  }
}

export function getContentConfig(
  screenId: number,
  contentType: ContentType,
): Record<string, unknown> {
  try {
    const db = getDatabase()
    const record = db
      .select()
      .from(screenContentConfigs)
      .where(
        and(
          eq(screenContentConfigs.screenId, screenId),
          eq(screenContentConfigs.contentType, contentType),
        ),
      )
      .get()

    if (record) {
      return parseContentConfig(contentType, record.config)
    }

    return getDefaultContentConfig(contentType)
  } catch (error) {
    logger.error(`Failed to get content config: ${error}`)
    return getDefaultContentConfig(contentType)
  }
}

// ============================================================================
// NEXT SLIDE CONFIG OPERATIONS
// ============================================================================

export function updateNextSlideConfig(
  input: UpdateNextSlideConfigInput,
): OperationResult {
  try {
    logger.debug(`Updating next slide config: screen=${input.screenId}`)

    const db = getDatabase()
    const configJson = JSON.stringify(input.config)

    // Check if config exists
    const existing = db
      .select()
      .from(screenNextSlideConfigs)
      .where(eq(screenNextSlideConfigs.screenId, input.screenId))
      .get()

    if (existing) {
      db.update(screenNextSlideConfigs)
        .set({
          config: configJson,
          updatedAt: sql`(unixepoch())` as unknown as Date,
        })
        .where(eq(screenNextSlideConfigs.id, existing.id))
        .run()
    } else {
      db.insert(screenNextSlideConfigs)
        .values({
          screenId: input.screenId,
          config: configJson,
        })
        .run()
    }

    logger.info(`Next slide config updated: screen=${input.screenId}`)
    return { success: true }
  } catch (error) {
    logger.error(`Failed to update next slide config: ${error}`)
    return { success: false, error: String(error) }
  }
}

export function getNextSlideConfig(screenId: number): NextSlideSectionConfig {
  try {
    const db = getDatabase()
    const record = db
      .select()
      .from(screenNextSlideConfigs)
      .where(eq(screenNextSlideConfigs.screenId, screenId))
      .get()

    if (record) {
      return parseNextSlideConfig(record.config)
    }

    return getDefaultNextSlideConfig()
  } catch (error) {
    logger.error(`Failed to get next slide config: ${error}`)
    return getDefaultNextSlideConfig()
  }
}

// ============================================================================
// GLOBAL SETTINGS OPERATIONS
// ============================================================================

export function updateGlobalSettings(
  screenId: number,
  settings: ScreenGlobalSettings,
): OperationResult {
  try {
    logger.debug(`Updating global settings: screen=${screenId}`)

    const db = getDatabase()
    const settingsJson = JSON.stringify(settings)

    db.update(screens)
      .set({
        globalSettings: settingsJson,
        updatedAt: sql`(unixepoch())` as unknown as Date,
      })
      .where(eq(screens.id, screenId))
      .run()

    logger.info(`Global settings updated: screen=${screenId}`)
    return { success: true }
  } catch (error) {
    logger.error(`Failed to update global settings: ${error}`)
    return { success: false, error: String(error) }
  }
}

// ============================================================================
// BATCH UPDATE OPERATIONS
// ============================================================================

export interface BatchUpdateScreenConfigInput {
  screenId: number
  globalSettings: ScreenGlobalSettings
  contentConfigs: Record<ContentType, Record<string, unknown>>
  nextSlideConfig?: NextSlideSectionConfig
  width?: number
  height?: number
}

export function batchUpdateScreenConfigs(
  input: BatchUpdateScreenConfigInput,
): OperationResult {
  try {
    logger.debug(`Batch updating screen configs: screen=${input.screenId}`)

    const db = getDatabase()

    // Update global settings and screen dimensions
    const settingsJson = JSON.stringify(input.globalSettings)
    const updateData: Record<string, unknown> = {
      globalSettings: settingsJson,
      updatedAt: sql`(unixepoch())` as unknown as Date,
    }
    if (input.width !== undefined) {
      updateData.width = input.width
    }
    if (input.height !== undefined) {
      updateData.height = input.height
    }
    db.update(screens)
      .set(updateData)
      .where(eq(screens.id, input.screenId))
      .run()

    // Update each content config
    for (const [contentType, config] of Object.entries(input.contentConfigs)) {
      const configJson = JSON.stringify(config)

      // Check if config exists - use and() to combine conditions
      const existing = db
        .select()
        .from(screenContentConfigs)
        .where(
          and(
            eq(screenContentConfigs.screenId, input.screenId),
            eq(screenContentConfigs.contentType, contentType),
          ),
        )
        .get()

      if (existing) {
        db.update(screenContentConfigs)
          .set({
            config: configJson,
            updatedAt: sql`(unixepoch())` as unknown as Date,
          })
          .where(eq(screenContentConfigs.id, existing.id))
          .run()
      } else {
        db.insert(screenContentConfigs)
          .values({
            screenId: input.screenId,
            contentType: contentType as ContentType,
            config: configJson,
          })
          .run()
      }
    }

    // Update next slide config if provided
    if (input.nextSlideConfig) {
      const nextSlideJson = JSON.stringify(input.nextSlideConfig)

      const existingNextSlide = db
        .select()
        .from(screenNextSlideConfigs)
        .where(eq(screenNextSlideConfigs.screenId, input.screenId))
        .get()

      if (existingNextSlide) {
        db.update(screenNextSlideConfigs)
          .set({
            config: nextSlideJson,
            updatedAt: sql`(unixepoch())` as unknown as Date,
          })
          .where(eq(screenNextSlideConfigs.id, existingNextSlide.id))
          .run()
      } else {
        db.insert(screenNextSlideConfigs)
          .values({
            screenId: input.screenId,
            config: nextSlideJson,
          })
          .run()
      }
    }

    logger.info(`Batch update complete: screen=${input.screenId}`)
    return { success: true }
  } catch (error) {
    logger.error(`Failed to batch update screen configs: ${error}`)
    return { success: false, error: String(error) }
  }
}

// ============================================================================
// SCENE OVERRIDE OPERATIONS
// ============================================================================

export function upsertSceneOverride(
  screenId: number,
  obsSceneName: string,
  contentType: ContentType,
  config: Record<string, unknown>,
): OperationResult {
  try {
    logger.debug(
      `Upserting scene override: screen=${screenId}, scene=${obsSceneName}, type=${contentType}`,
    )

    const db = getDatabase()
    const configJson = JSON.stringify(config)

    const existing = db
      .select()
      .from(screenSceneOverrides)
      .where(
        and(
          eq(screenSceneOverrides.screenId, screenId),
          eq(screenSceneOverrides.obsSceneName, obsSceneName),
          eq(screenSceneOverrides.contentType, contentType),
        ),
      )
      .get()

    if (existing) {
      db.update(screenSceneOverrides)
        .set({
          config: configJson,
          updatedAt: sql`(unixepoch())` as unknown as Date,
        })
        .where(eq(screenSceneOverrides.id, existing.id))
        .run()
    } else {
      db.insert(screenSceneOverrides)
        .values({
          screenId,
          obsSceneName,
          contentType,
          config: configJson,
        })
        .run()
    }

    logger.info(
      `Scene override upserted: screen=${screenId}, scene=${obsSceneName}, type=${contentType}`,
    )
    return { success: true }
  } catch (error) {
    logger.error(`Failed to upsert scene override: ${error}`)
    return { success: false, error: String(error) }
  }
}

export function deleteSceneOverride(
  screenId: number,
  obsSceneName: string,
  contentType: ContentType,
): OperationResult {
  try {
    logger.debug(
      `Deleting scene override: screen=${screenId}, scene=${obsSceneName}, type=${contentType}`,
    )

    const db = getDatabase()
    db.delete(screenSceneOverrides)
      .where(
        and(
          eq(screenSceneOverrides.screenId, screenId),
          eq(screenSceneOverrides.obsSceneName, obsSceneName),
          eq(screenSceneOverrides.contentType, contentType),
        ),
      )
      .run()

    logger.info(
      `Scene override deleted: screen=${screenId}, scene=${obsSceneName}, type=${contentType}`,
    )
    return { success: true }
  } catch (error) {
    logger.error(`Failed to delete scene override: ${error}`)
    return { success: false, error: String(error) }
  }
}

export function deleteAllSceneOverrides(screenId: number): OperationResult {
  try {
    logger.debug(`Deleting all scene overrides for screen=${screenId}`)

    const db = getDatabase()
    db.delete(screenSceneOverrides)
      .where(eq(screenSceneOverrides.screenId, screenId))
      .run()

    logger.info(`All scene overrides deleted for screen=${screenId}`)
    return { success: true }
  } catch (error) {
    logger.error(`Failed to delete all scene overrides: ${error}`)
    return { success: false, error: String(error) }
  }
}
