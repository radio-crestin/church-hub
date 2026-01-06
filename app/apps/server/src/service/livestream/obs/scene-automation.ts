import { eq } from 'drizzle-orm'

import type { ContentType } from './content-types'
import { broadcastOBSCurrentScene } from './index'
import { switchScene } from './scenes'
import { obsConnection } from './websocket-client'
import { getDatabase } from '../../../db'
import { obsScenes, sceneAutomationState } from '../../../db/schema'
import type { OBSScene, SceneAutomationState } from '../types'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [scene-automation] ${message}`)
}

function parseContentTypes(contentTypesJson: string): ContentType[] {
  try {
    return JSON.parse(contentTypesJson) as ContentType[]
  } catch {
    return []
  }
}

/**
 * Gets the current scene automation state
 */
export function getSceneAutomationState(): SceneAutomationState {
  const db = getDatabase()
  const record = db
    .select()
    .from(sceneAutomationState)
    .where(eq(sceneAutomationState.id, 1))
    .get()

  if (!record) {
    return {
      isEnabled: true,
      previousSceneName: null,
      currentAutoScene: null,
      lastContentType: null,
    }
  }

  return {
    isEnabled: record.isEnabled,
    previousSceneName: record.previousSceneName,
    currentAutoScene: record.currentAutoScene,
    lastContentType: record.lastContentType as ContentType | null,
  }
}

/**
 * Enables or disables scene automation
 */
export function setSceneAutomationEnabled(
  enabled: boolean,
): SceneAutomationState {
  const db = getDatabase()

  db.update(sceneAutomationState)
    .set({
      isEnabled: enabled,
      updatedAt: new Date(),
    })
    .where(eq(sceneAutomationState.id, 1))
    .run()

  // If disabling, clear the automation state
  if (!enabled) {
    db.update(sceneAutomationState)
      .set({
        previousSceneName: null,
        currentAutoScene: null,
        lastContentType: null,
        updatedAt: new Date(),
      })
      .where(eq(sceneAutomationState.id, 1))
      .run()
  }

  return getSceneAutomationState()
}

/**
 * Gets the first scene configured for the given content type
 * Returns the scene with the lowest sortOrder (highest priority)
 */
export function getSceneForContentType(
  contentType: ContentType,
): OBSScene | null {
  const db = getDatabase()
  const scenes = db.select().from(obsScenes).orderBy(obsScenes.sortOrder).all()

  for (const scene of scenes) {
    const contentTypes = parseContentTypes(scene.contentTypes)
    if (contentTypes.includes(contentType)) {
      const currentScene = obsConnection.getCurrentScene()
      return {
        id: scene.id,
        obsSceneName: scene.obsSceneName,
        displayName: scene.displayName,
        isVisible: scene.isVisible,
        sortOrder: scene.sortOrder,
        shortcuts: JSON.parse(scene.shortcuts) as string[],
        contentTypes,
        isCurrent: scene.obsSceneName === currentScene,
      }
    }
  }

  return null
}

/**
 * Updates the automation state in the database
 */
function updateAutomationState(data: {
  previousSceneName?: string | null
  currentAutoScene?: string | null
  lastContentType?: ContentType | null
}): void {
  const db = getDatabase()
  db.update(sceneAutomationState)
    .set({
      ...(data.previousSceneName !== undefined && {
        previousSceneName: data.previousSceneName,
      }),
      ...(data.currentAutoScene !== undefined && {
        currentAutoScene: data.currentAutoScene,
      }),
      ...(data.lastContentType !== undefined && {
        lastContentType: data.lastContentType,
      }),
      updatedAt: new Date(),
    })
    .where(eq(sceneAutomationState.id, 1))
    .run()
}

/**
 * Handles content type changes and automatically switches scenes if configured
 * This is the main entry point called when presentation state changes
 */
export async function handleContentTypeChange(
  contentType: ContentType,
  isPresenting: boolean,
): Promise<void> {
  const state = getSceneAutomationState()

  // Skip if automation is disabled
  if (!state.isEnabled) {
    log('debug', 'Scene automation is disabled, skipping')
    return
  }

  // Skip if not presenting
  if (!isPresenting) {
    log('debug', 'Not presenting, clearing scene automation state')
    // Always clear state when not presenting
    // This ensures the next presentation triggers automation
    updateAutomationState({
      previousSceneName: null,
      currentAutoScene: null,
      lastContentType: null,
    })
    return
  }

  // Skip if content type hasn't changed
  if (state.lastContentType === contentType) {
    log('debug', `Content type unchanged: ${contentType}`)
    return
  }

  log(
    'info',
    `Content type changed: ${state.lastContentType} -> ${contentType}`,
  )

  // Find scene configured for this content type
  const targetScene = getSceneForContentType(contentType)
  const currentOBSScene = obsConnection.getCurrentScene()

  if (targetScene) {
    // We have a scene configured for this content type
    if (targetScene.obsSceneName !== currentOBSScene) {
      // Save the previous scene if we're not already in auto mode
      if (!state.currentAutoScene && currentOBSScene) {
        log('debug', `Saving previous scene: ${currentOBSScene}`)
        updateAutomationState({ previousSceneName: currentOBSScene })
      }

      // Switch to the target scene
      log(
        'info',
        `Auto-switching to scene: ${targetScene.displayName} (${targetScene.obsSceneName})`,
      )
      try {
        await switchScene(targetScene.obsSceneName)
        broadcastOBSCurrentScene(targetScene.obsSceneName)
        updateAutomationState({
          currentAutoScene: targetScene.obsSceneName,
          lastContentType: contentType,
        })
      } catch (error) {
        log('error', `Failed to switch scene: ${error}`)
      }
    } else {
      // Already on the correct scene, just update state
      updateAutomationState({
        currentAutoScene: targetScene.obsSceneName,
        lastContentType: contentType,
      })
    }
  } else {
    // No scene configured for this content type
    if (state.currentAutoScene && state.previousSceneName) {
      // We were in auto mode, revert to previous scene
      log(
        'info',
        `No scene for ${contentType}, reverting to previous: ${state.previousSceneName}`,
      )
      try {
        await switchScene(state.previousSceneName)
        broadcastOBSCurrentScene(state.previousSceneName)
        updateAutomationState({
          previousSceneName: null,
          currentAutoScene: null,
          lastContentType: contentType,
        })
      } catch (error) {
        log('error', `Failed to revert scene: ${error}`)
      }
    } else {
      // Just update the last content type
      updateAutomationState({ lastContentType: contentType })
    }
  }
}

/**
 * Resets the automation state (clears previous scene and auto scene tracking)
 */
export function resetAutomationState(): void {
  updateAutomationState({
    previousSceneName: null,
    currentAutoScene: null,
    lastContentType: null,
  })
}
