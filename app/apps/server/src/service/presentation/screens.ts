import { and, asc, eq, sql } from 'drizzle-orm'

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
  screens,
} from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [screens] ${message}`)
}

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
    log('debug', 'Getting all screens')

    const db = getDatabase()
    const records = db
      .select()
      .from(screens)
      .orderBy(asc(screens.sortOrder), asc(screens.createdAt))
      .all()

    return records.map(toScreen)
  } catch (error) {
    log('error', `Failed to get all screens: ${error}`)
    return []
  }
}

export function getActiveScreens(): Screen[] {
  try {
    log('debug', 'Getting active screens')

    const db = getDatabase()
    const records = db
      .select()
      .from(screens)
      .where(eq(screens.isActive, true))
      .orderBy(asc(screens.sortOrder), asc(screens.createdAt))
      .all()

    return records.map(toScreen)
  } catch (error) {
    log('error', `Failed to get active screens: ${error}`)
    return []
  }
}

export function getScreenById(id: number): Screen | null {
  try {
    log('debug', `Getting screen by ID: ${id}`)

    const db = getDatabase()
    const record = db.select().from(screens).where(eq(screens.id, id)).get()

    if (!record) {
      log('debug', `Screen not found: ${id}`)
      return null
    }

    return toScreen(record)
  } catch (error) {
    log('error', `Failed to get screen: ${error}`)
    return null
  }
}

export function getScreenWithConfigs(id: number): ScreenWithConfigs | null {
  try {
    log('debug', `Getting screen with configs: ${id}`)

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
        configMap[type] = parseConfig(existing.config)
      } else {
        configMap[type] = getDefaultContentConfig(type)
      }
    }

    // Get next slide config if stage screen
    let nextSlideConfig: NextSlideSectionConfig | undefined
    if (screen.type === 'stage') {
      const nextSlideRecord = db
        .select()
        .from(screenNextSlideConfigs)
        .where(eq(screenNextSlideConfigs.screenId, id))
        .get()

      if (nextSlideRecord) {
        nextSlideConfig = parseConfig(
          nextSlideRecord.config,
        ) as NextSlideSectionConfig
      } else {
        nextSlideConfig = getDefaultNextSlideConfig()
      }
    }

    return {
      ...screen,
      contentConfigs: configMap,
      nextSlideConfig,
    }
  } catch (error) {
    log('error', `Failed to get screen with configs: ${error}`)
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
      log('debug', `Updating screen: ${input.id}`)

      db.update(screens)
        .set({
          name: input.name,
          type: screenType,
          isActive: input.isActive !== false,
          openMode,
          isFullscreen: input.isFullscreen === true,
          width,
          height,
          globalSettings: globalSettingsJson,
          sortOrder: input.sortOrder ?? 0,
          updatedAt: sql`(unixepoch())` as unknown as Date,
        })
        .where(eq(screens.id, input.id))
        .run()

      log('info', `Screen updated: ${input.id}`)
      return getScreenById(input.id)
    }

    // Create new screen
    log('debug', `Creating screen: ${input.name}`)

    const inserted = db
      .insert(screens)
      .values({
        name: input.name,
        type: screenType,
        isActive: input.isActive !== false,
        openMode,
        isFullscreen: input.isFullscreen === true,
        width,
        height,
        globalSettings: globalSettingsJson,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning({ id: screens.id })
      .get()

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

    // Create default next slide config for stage screens
    if (screenType === 'stage') {
      db.insert(screenNextSlideConfigs)
        .values({
          screenId: inserted.id,
          config: JSON.stringify(getDefaultNextSlideConfig()),
        })
        .run()
    }

    log('info', `Screen created: ${inserted.id}`)
    return getScreenById(inserted.id)
  } catch (error) {
    log('error', `Failed to upsert screen: ${error}`)
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
    log('debug', `Deleting screen: ${id}`)

    const db = getDatabase()
    // Content configs and next slide configs are deleted via CASCADE
    db.delete(screens).where(eq(screens.id, id)).run()

    log('info', `Screen deleted: ${id}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to delete screen: ${error}`)
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
    log(
      'debug',
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

    log(
      'info',
      `Content config updated: screen=${input.screenId}, type=${input.contentType}`,
    )
    return { success: true }
  } catch (error) {
    log('error', `Failed to update content config: ${error}`)
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
      return parseConfig(record.config)
    }

    return getDefaultContentConfig(contentType)
  } catch (error) {
    log('error', `Failed to get content config: ${error}`)
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
    log('debug', `Updating next slide config: screen=${input.screenId}`)

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

    log('info', `Next slide config updated: screen=${input.screenId}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to update next slide config: ${error}`)
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
      return parseConfig(record.config) as NextSlideSectionConfig
    }

    return getDefaultNextSlideConfig()
  } catch (error) {
    log('error', `Failed to get next slide config: ${error}`)
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
    log('debug', `Updating global settings: screen=${screenId}`)

    const db = getDatabase()
    const settingsJson = JSON.stringify(settings)

    db.update(screens)
      .set({
        globalSettings: settingsJson,
        updatedAt: sql`(unixepoch())` as unknown as Date,
      })
      .where(eq(screens.id, screenId))
      .run()

    log('info', `Global settings updated: screen=${screenId}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to update global settings: ${error}`)
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
}

export function batchUpdateScreenConfigs(
  input: BatchUpdateScreenConfigInput,
): OperationResult {
  try {
    log('debug', `Batch updating screen configs: screen=${input.screenId}`)

    const db = getDatabase()

    // Update global settings
    const settingsJson = JSON.stringify(input.globalSettings)
    db.update(screens)
      .set({
        globalSettings: settingsJson,
        updatedAt: sql`(unixepoch())` as unknown as Date,
      })
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

    log('info', `Batch update complete: screen=${input.screenId}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to batch update screen configs: ${error}`)
    return { success: false, error: String(error) }
  }
}
