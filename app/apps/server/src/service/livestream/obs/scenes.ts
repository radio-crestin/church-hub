import { eq } from 'drizzle-orm'

import { obsConnection } from './websocket-client'
import { getDatabase } from '../../../db'
import { obsScenes } from '../../../db/schema'
import type { OBSScene } from '../types'

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
  data: { displayName?: string; isVisible?: boolean },
): Promise<OBSScene | null> {
  const db = getDatabase()
  const [updated] = await db
    .update(obsScenes)
    .set({
      ...(data.displayName !== undefined && { displayName: data.displayName }),
      ...(data.isVisible !== undefined && { isVisible: data.isVisible }),
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
