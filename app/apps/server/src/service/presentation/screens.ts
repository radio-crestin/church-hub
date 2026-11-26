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
import { screenSceneTemplates, screens } from '../../db/schema'
import { createLogger } from '../../utils/logger'
import { BUNDLED_KEY_FOR_SCREEN } from '../slide-templates/bundledTemplates'
import { deleteSlideTemplate } from '../slide-templates/deleteSlideTemplate'
import {
  getBundledTemplateId,
  getSlideTemplate,
} from '../slide-templates/getSlideTemplates'
import {
  getTemplateUsage,
  isTemplateUsed,
} from '../slide-templates/getTemplateUsage'
import { saveTemplateLayout } from '../slide-templates/saveTemplateLayout'
import type { SlideTemplate } from '../slide-templates/types'
import {
  duplicateSlideTemplate,
  upsertSlideTemplate,
} from '../slide-templates/upsertSlideTemplate'

const logger = createLogger('screens')

// ============================================================================
// CONVERTERS
// ============================================================================

const toSeconds = (value: Date | number) =>
  value instanceof Date ? Math.floor(value.getTime() / 1000) : value

function getSceneTemplates(screenId: number): Record<string, number> {
  const rows = getDatabase()
    .select()
    .from(screenSceneTemplates)
    .where(eq(screenSceneTemplates.screenId, screenId))
    .all()
  return Object.fromEntries(rows.map((r) => [r.obsSceneName, r.templateId]))
}

/** The template a screen draws with; the bundled one of its type when it has none. */
function templateOf(record: typeof screens.$inferSelect): SlideTemplate {
  const own = record.templateId ? getSlideTemplate(record.templateId) : null
  if (own) return own
  const bundledId = getBundledTemplateId(BUNDLED_KEY_FOR_SCREEN[record.type])
  const bundled = bundledId ? getSlideTemplate(bundledId) : null
  if (!bundled) throw new Error(`Screen ${record.id} has no template`)
  logger.warning(`Screen ${record.id} has no template: drawing the bundled one`)
  return bundled
}

function toScreenWithConfigs(
  record: typeof screens.$inferSelect,
): ScreenWithConfigs {
  const template = templateOf(record)
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
    openOnStartup: record.openOnStartup,
    monitorName: record.monitorName,
    templateId: template.id,
    followsPresentation: record.followsPresentation,
    sceneTemplates: getSceneTemplates(record.id),
    width: template.width,
    height: template.height,
    globalSettings: template.globalSettings,
    contentConfigs: template.layouts,
    nextSlideConfig: template.nextSlide,
    sortOrder: record.sortOrder,
    createdAt: toSeconds(record.createdAt),
    updatedAt: toSeconds(record.updatedAt),
  }
}

function toScreen(record: typeof screens.$inferSelect): Screen {
  const {
    contentConfigs: _c,
    nextSlideConfig: _n,
    ...screen
  } = toScreenWithConfigs(record)
  return screen
}

function getRecord(id: number) {
  return getDatabase().select().from(screens).where(eq(screens.id, id)).get()
}

// ============================================================================
// SCREEN CRUD OPERATIONS
// ============================================================================

export function getAllScreens(): Screen[] {
  try {
    return getDatabase()
      .select()
      .from(screens)
      .orderBy(asc(screens.sortOrder), asc(screens.createdAt))
      .all()
      .map(toScreen)
  } catch (error) {
    logger.error(`Failed to get all screens: ${error}`)
    return []
  }
}

export function getActiveScreens(): Screen[] {
  try {
    return getDatabase()
      .select()
      .from(screens)
      .where(eq(screens.isActive, true))
      .orderBy(asc(screens.sortOrder), asc(screens.createdAt))
      .all()
      .map(toScreen)
  } catch (error) {
    logger.error(`Failed to get active screens: ${error}`)
    return []
  }
}

export function getScreenById(id: number): Screen | null {
  try {
    const record = getRecord(id)
    return record ? toScreen(record) : null
  } catch (error) {
    logger.error(`Failed to get screen: ${error}`)
    return null
  }
}

export function getScreenWithConfigs(id: number): ScreenWithConfigs | null {
  try {
    const record = getRecord(id)
    return record ? toScreenWithConfigs(record) : null
  } catch (error) {
    logger.error(`Failed to get screen with configs (id=${id}): ${error}`)
    return null
  }
}

/**
 * The template a screen's own design is saved into. A bundled template is
 * read-only, so a screen drawing with one gets a copy named after it first.
 */
function writableTemplateId(screenId: number): number {
  const record = getRecord(screenId)
  if (!record) throw new Error(`Screen ${screenId} not found`)
  const template = templateOf(record)
  if (!template.bundledKey) return template.id
  const copy = duplicateSlideTemplate(template.id, record.name)
  getDatabase()
    .update(screens)
    .set({
      templateId: copy.id,
      updatedAt: sql`(unixepoch())` as unknown as Date,
    })
    .where(eq(screens.id, screenId))
    .run()
  logger.info(`Screen ${screenId} now draws with its own copy ${copy.id}`)
  return copy.id
}

function saveDesign(
  screenId: number,
  design: Parameters<typeof upsertSlideTemplate>[0],
) {
  upsertSlideTemplate({ ...design, id: writableTemplateId(screenId) })
}

/** One flag per screen: only one screen is mirrored in the in-app preview. */
function clearOtherPreviewScreens(id: number) {
  getDatabase()
    .update(screens)
    .set({
      isPreviewScreen: false,
      updatedAt: sql`(unixepoch())` as unknown as Date,
    })
    .where(ne(screens.id, id))
    .run()
}

export function upsertScreen(input: UpsertScreenInput): Screen | null {
  try {
    const db = getDatabase()
    const screenType = input.type ?? 'primary'

    if (input.id) {
      const updateData: Record<string, unknown> = {
        name: input.name,
        type: screenType,
        updatedAt: sql`(unixepoch())`,
      }
      const optional = [
        'openMode',
        'isFullscreen',
        'sortOrder',
        'isActive',
        'alwaysOnTop',
        'closeOnEscape',
        'openOnStartup',
        'monitorName',
        'isPreviewScreen',
        'templateId',
        'followsPresentation',
      ] as const
      for (const key of optional) {
        if (input[key] !== undefined) updateData[key] = input[key]
      }
      if (input.isPreviewScreen) clearOtherPreviewScreens(input.id)
      db.update(screens).set(updateData).where(eq(screens.id, input.id)).run()

      const { width, height, globalSettings } = input
      if (width ?? height ?? globalSettings) {
        saveDesign(input.id, { width, height, globalSettings })
      }
      logger.info(`Screen updated: ${input.id}`)
      return getScreenById(input.id)
    }

    // A new screen gets a template of its own, from the bundled design of its
    // type, so changing its design never changes another screen's.
    const bundledId = getBundledTemplateId(BUNDLED_KEY_FOR_SCREEN[screenType])
    if (!bundledId) throw new Error(`No bundled template for ${screenType}`)
    const template = duplicateSlideTemplate(bundledId, input.name)
    const inserted = db
      .insert(screens)
      .values({
        name: input.name,
        type: screenType,
        isActive: input.isActive === true,
        openMode: input.openMode ?? 'browser',
        // Projection windows are fullscreen unless the operator says otherwise.
        isFullscreen: input.isFullscreen !== false,
        monitorName: input.monitorName ?? null,
        // Above other windows unless the operator says otherwise (T-026).
        alwaysOnTop: input.alwaysOnTop !== false,
        closeOnEscape: input.closeOnEscape === true,
        isPreviewScreen: input.isPreviewScreen === true,
        openOnStartup: input.openOnStartup !== false,
        templateId: input.templateId ?? template.id,
        followsPresentation:
          input.followsPresentation ??
          (screenType === 'primary' || screenType === 'kiosk'),
        sortOrder: input.sortOrder ?? 0,
      })
      .returning({ id: screens.id })
      .get()
    if (input.isPreviewScreen === true) clearOtherPreviewScreens(inserted.id)

    const { width, height, globalSettings } = input
    if (width ?? height ?? globalSettings) {
      saveDesign(inserted.id, { width, height, globalSettings })
    }
    logger.info(`Screen created: ${inserted.id}`)
    return getScreenById(inserted.id)
  } catch (error) {
    logger.error(`Failed to upsert screen: ${error}`)
    return null
  }
}

/**
 * Clones a screen with everything that belongs to it: its settings, a copy of
 * its template (so the two can be changed apart) and its OBS scene templates.
 *
 * Two flags are deliberately not copied. `isActive` records that a window is
 * currently open, which is never true of a screen that was just created, and
 * `isPreviewScreen` is exclusive — copying it would silently take the preview
 * role away from the screen being duplicated.
 */
export function duplicateScreen(id: number, name?: string): Screen | null {
  try {
    const db = getDatabase()
    const source = getRecord(id)
    if (!source) {
      logger.warning(`Screen not found for duplication: ${id}`)
      return null
    }
    const copyName = name?.trim() || `${source.name} (copy)`
    const template = duplicateSlideTemplate(templateOf(source).id, copyName)

    const inserted = db
      .insert(screens)
      .values({
        name: copyName,
        type: source.type,
        isActive: false,
        openMode: source.openMode,
        isFullscreen: source.isFullscreen,
        alwaysOnTop: source.alwaysOnTop,
        closeOnEscape: source.closeOnEscape,
        isPreviewScreen: false,
        openOnStartup: source.openOnStartup,
        monitorName: source.monitorName,
        templateId: template.id,
        followsPresentation: source.followsPresentation,
        sortOrder: source.sortOrder,
      })
      .returning({ id: screens.id })
      .get()

    const scenes = Object.entries(getSceneTemplates(id))
    for (const [obsSceneName, templateId] of scenes) {
      db.insert(screenSceneTemplates)
        .values({ screenId: inserted.id, obsSceneName, templateId })
        .run()
    }

    logger.info(
      `Screen ${id} duplicated as ${inserted.id} (template ${template.id}, ${scenes.length} OBS scene templates)`,
    )
    return getScreenById(inserted.id)
  } catch (error) {
    logger.error(`Failed to duplicate screen: ${error}`)
    return null
  }
}

/**
 * Deletes a screen. Its templates (its own, its OBS scenes') go with it when
 * nothing else draws with them; one shared or bundled stays.
 */
export function deleteScreen(id: number): OperationResult {
  try {
    const record = getRecord(id)
    const templateIds = [
      ...(record?.templateId ? [record.templateId] : []),
      ...Object.values(getSceneTemplates(id)),
    ]
    // Its OBS scene → template mapping goes with it (CASCADE).
    getDatabase().delete(screens).where(eq(screens.id, id)).run()
    for (const templateId of new Set(templateIds)) {
      const template = getSlideTemplate(templateId)
      if (template?.bundledKey) continue
      if (isTemplateUsed(getTemplateUsage(templateId))) continue
      deleteSlideTemplate(templateId)
    }
    logger.info(`Screen deleted: ${id}`)
    return { success: true }
  } catch (error) {
    logger.error(`Failed to delete screen: ${error}`)
    return { success: false, error: String(error) }
  }
}

// ============================================================================
// THE SCREEN'S DESIGN (its template)
// ============================================================================

function designResult(screenId: number, save: () => void): OperationResult {
  try {
    save()
    logger.info(`Design saved: screen=${screenId}`)
    return { success: true }
  } catch (error) {
    logger.error(`Failed to save the design of screen ${screenId}: ${error}`)
    return { success: false, error: String(error) }
  }
}

export function updateContentConfig(
  input: UpdateContentConfigInput,
): OperationResult {
  return designResult(input.screenId, () =>
    saveTemplateLayout(
      writableTemplateId(input.screenId),
      input.contentType,
      input.config,
    ),
  )
}

export function getContentConfig(
  screenId: number,
  contentType: ContentType,
): Record<string, unknown> | null {
  return getScreenWithConfigs(screenId)?.contentConfigs[contentType] ?? null
}

export function updateNextSlideConfig(
  input: UpdateNextSlideConfigInput,
): OperationResult {
  return designResult(input.screenId, () =>
    saveDesign(input.screenId, { nextSlide: input.config }),
  )
}

export function getNextSlideConfig(
  screenId: number,
): NextSlideSectionConfig | null {
  return getScreenWithConfigs(screenId)?.nextSlideConfig ?? null
}

export function updateGlobalSettings(
  screenId: number,
  settings: ScreenGlobalSettings,
): OperationResult {
  return designResult(screenId, () =>
    saveDesign(screenId, { globalSettings: settings }),
  )
}

export interface BatchUpdateScreenConfigInput {
  screenId: number
  globalSettings: ScreenGlobalSettings
  contentConfigs: Record<ContentType, Record<string, unknown>>
  nextSlideConfig?: NextSlideSectionConfig
  width?: number
  height?: number
}

/** Saves the whole design the screen editor shows, in one go. */
export function batchUpdateScreenConfigs(
  input: BatchUpdateScreenConfigInput,
): OperationResult {
  return designResult(input.screenId, () => {
    const screen = getScreenWithConfigs(input.screenId)
    if (!screen) throw new Error('Screen not found')
    saveDesign(input.screenId, {
      globalSettings: input.globalSettings,
      layouts: { ...screen.contentConfigs, ...input.contentConfigs },
      nextSlide: input.nextSlideConfig,
      width: input.width,
      height: input.height,
    })
  })
}

// ============================================================================
// OBS SCENE TEMPLATES
// ============================================================================

/** While an OBS scene is live, the screen draws with this template; null: its own. */
export function setSceneTemplate(
  screenId: number,
  obsSceneName: string,
  templateId: number | null,
): OperationResult {
  try {
    const db = getDatabase()
    db.delete(screenSceneTemplates)
      .where(
        and(
          eq(screenSceneTemplates.screenId, screenId),
          eq(screenSceneTemplates.obsSceneName, obsSceneName),
        ),
      )
      .run()
    if (templateId !== null) {
      if (!getSlideTemplate(templateId)) throw new Error('Template not found')
      db.insert(screenSceneTemplates)
        .values({ screenId, obsSceneName, templateId })
        .run()
    }
    logger.info(
      `Screen ${screenId}, OBS scene "${obsSceneName}" → template ${templateId ?? 'own'}`,
    )
    return { success: true }
  } catch (error) {
    logger.error(`Failed to set the OBS scene template: ${error}`)
    return { success: false, error: String(error) }
  }
}
