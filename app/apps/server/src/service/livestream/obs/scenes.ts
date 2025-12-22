import { eq } from 'drizzle-orm'

import { obsConnection } from './websocket-client'
import { getDatabase } from '../../../db'
import { obsScenes } from '../../../db/schema'
import type { ContentType, MixerChannelActions, OBSScene } from '../types'

function parseShortcuts(shortcuts: string): string[] {
  try {
    return JSON.parse(shortcuts) as string[]
  } catch {
    return []
  }
}

function parseContentTypes(contentTypes: string): ContentType[] {
  try {
    return JSON.parse(contentTypes) as ContentType[]
  } catch {
    return []
  }
}

function parseMixerChannelActions(actions: string): MixerChannelActions {
  try {
    return JSON.parse(actions) as MixerChannelActions
  } catch {
    return { mute: [], unmute: [] }
  }
}

export async function getScenes(): Promise<OBSScene[]> {
  const db = getDatabase()
  const currentScene = obsConnection.getCurrentScene()
  const dbScenes = await db
    .select()
    .from(obsScenes)
    .orderBy(obsScenes.sortOrder)

  if (!obsConnection.isConnected()) {
    return dbScenes.map((scene) => ({
      id: scene.id,
      obsSceneName: scene.obsSceneName,
      displayName: scene.displayName,
      isVisible: scene.isVisible,
      sortOrder: scene.sortOrder,
      shortcuts: parseShortcuts(scene.shortcuts),
      contentTypes: parseContentTypes(scene.contentTypes),
      mixerChannelActions: parseMixerChannelActions(scene.mixerChannelActions),
      isCurrent: scene.obsSceneName === currentScene,
    }))
  }

  try {
    const obsSceneList = await obsConnection.getSceneList()
    const result: OBSScene[] = []
    const existingSceneNames = new Set<string>()

    for (const dbScene of dbScenes) {
      const obsScene = obsSceneList.find(
        (s) => s.sceneName === dbScene.obsSceneName,
      )
      if (obsScene) {
        existingSceneNames.add(dbScene.obsSceneName)
        result.push({
          id: dbScene.id,
          obsSceneName: dbScene.obsSceneName,
          displayName: dbScene.displayName,
          isVisible: dbScene.isVisible,
          sortOrder: dbScene.sortOrder,
          shortcuts: parseShortcuts(dbScene.shortcuts),
          contentTypes: parseContentTypes(dbScene.contentTypes),
          mixerChannelActions: parseMixerChannelActions(
            dbScene.mixerChannelActions,
          ),
          isCurrent: dbScene.obsSceneName === currentScene,
        })
      }
    }

    let maxSortOrder = Math.max(...dbScenes.map((s) => s.sortOrder), -1)

    for (const obsScene of obsSceneList) {
      if (!existingSceneNames.has(obsScene.sceneName)) {
        maxSortOrder++
        const [newScene] = await db
          .insert(obsScenes)
          .values({
            obsSceneName: obsScene.sceneName,
            displayName: obsScene.sceneName,
            isVisible: true,
            sortOrder: maxSortOrder,
          })
          .returning()

        result.push({
          id: newScene.id,
          obsSceneName: newScene.obsSceneName,
          displayName: newScene.displayName,
          isVisible: newScene.isVisible,
          sortOrder: newScene.sortOrder,
          shortcuts: parseShortcuts(newScene.shortcuts),
          contentTypes: parseContentTypes(newScene.contentTypes),
          mixerChannelActions: parseMixerChannelActions(
            newScene.mixerChannelActions,
          ),
          isCurrent: obsScene.sceneName === currentScene,
        })
      }
    }

    result.sort((a, b) => a.sortOrder - b.sortOrder)
    return result
  } catch {
    return dbScenes.map((scene) => ({
      id: scene.id,
      obsSceneName: scene.obsSceneName,
      displayName: scene.displayName,
      isVisible: scene.isVisible,
      sortOrder: scene.sortOrder,
      shortcuts: parseShortcuts(scene.shortcuts),
      contentTypes: parseContentTypes(scene.contentTypes),
      mixerChannelActions: parseMixerChannelActions(scene.mixerChannelActions),
      isCurrent: scene.obsSceneName === currentScene,
    }))
  }
}

export async function getVisibleScenes(): Promise<OBSScene[]> {
  const scenes = await getScenes()
  return scenes.filter((s) => s.isVisible)
}

export async function updateScene(
  id: number,
  data: {
    displayName?: string
    isVisible?: boolean
    shortcuts?: string[]
    contentTypes?: ContentType[]
    mixerChannelActions?: MixerChannelActions
  },
): Promise<OBSScene | null> {
  const db = getDatabase()
  const [updated] = await db
    .update(obsScenes)
    .set({
      ...(data.displayName !== undefined && { displayName: data.displayName }),
      ...(data.isVisible !== undefined && { isVisible: data.isVisible }),
      ...(data.shortcuts !== undefined && {
        shortcuts: JSON.stringify(data.shortcuts),
      }),
      ...(data.contentTypes !== undefined && {
        contentTypes: JSON.stringify(data.contentTypes),
      }),
      ...(data.mixerChannelActions !== undefined && {
        mixerChannelActions: JSON.stringify(data.mixerChannelActions),
      }),
      updatedAt: new Date(),
    })
    .where(eq(obsScenes.id, id))
    .returning()

  if (!updated) return null

  const currentScene = obsConnection.getCurrentScene()
  return {
    id: updated.id,
    obsSceneName: updated.obsSceneName,
    displayName: updated.displayName,
    isVisible: updated.isVisible,
    sortOrder: updated.sortOrder,
    shortcuts: parseShortcuts(updated.shortcuts),
    contentTypes: parseContentTypes(updated.contentTypes),
    mixerChannelActions: parseMixerChannelActions(updated.mixerChannelActions),
    isCurrent: updated.obsSceneName === currentScene,
  }
}

export async function reorderScenes(sceneIds: number[]): Promise<OBSScene[]> {
  const db = getDatabase()
  for (let i = 0; i < sceneIds.length; i++) {
    await db
      .update(obsScenes)
      .set({
        sortOrder: i,
        updatedAt: new Date(),
      })
      .where(eq(obsScenes.id, sceneIds[i]))
  }

  return getScenes()
}

export async function switchScene(sceneName: string): Promise<void> {
  await obsConnection.switchScene(sceneName)
}

export interface SceneShortcut {
  shortcut: string
  sceneName: string
}

export async function getAllSceneShortcuts(): Promise<SceneShortcut[]> {
  const db = getDatabase()
  const scenes = await db.select().from(obsScenes)

  const shortcuts: SceneShortcut[] = []
  for (const scene of scenes) {
    const sceneShortcuts = parseShortcuts(scene.shortcuts)
    for (const shortcut of sceneShortcuts) {
      shortcuts.push({ shortcut, sceneName: scene.obsSceneName })
    }
  }
  return shortcuts
}
