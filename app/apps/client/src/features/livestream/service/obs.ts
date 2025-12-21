import { fetcher } from '../../../utils/fetcher'
import type {
  OBSConfig,
  OBSScene,
  OBSStatus,
  SceneShortcut,
  StartStreamResponse,
} from '../types'

export async function getOBSStatus(): Promise<OBSStatus> {
  const response = await fetcher<{ data: OBSStatus }>(
    '/api/livestream/obs/status',
  )
  return response.data
}

export async function connectToOBS(): Promise<OBSStatus> {
  const response = await fetcher<{ data: OBSStatus }>(
    '/api/livestream/obs/connect',
    { method: 'POST' },
  )
  return response.data
}

export async function disconnectFromOBS(): Promise<OBSStatus> {
  const response = await fetcher<{ data: OBSStatus }>(
    '/api/livestream/obs/disconnect',
    { method: 'POST' },
  )
  return response.data
}

export async function getOBSScenes(visibleOnly = false): Promise<OBSScene[]> {
  const response = await fetcher<{ data: OBSScene[] }>(
    `/api/livestream/obs/scenes${visibleOnly ? '?visible=true' : ''}`,
  )
  return response.data
}

export async function updateOBSScene(
  id: number,
  data: { displayName?: string; isVisible?: boolean; shortcuts?: string[] },
): Promise<OBSScene> {
  const response = await fetcher<{ data: OBSScene }>(
    `/api/livestream/obs/scenes/${id}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  )
  return response.data
}

export async function getSceneShortcuts(): Promise<SceneShortcut[]> {
  const response = await fetcher<{ data: SceneShortcut[] }>(
    '/api/livestream/obs/shortcuts',
  )
  return response.data
}

export async function reorderOBSScenes(
  sceneIds: number[],
): Promise<OBSScene[]> {
  const response = await fetcher<{ data: OBSScene[] }>(
    '/api/livestream/obs/scenes/reorder',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sceneIds }),
    },
  )
  return response.data
}

export async function switchOBSScene(
  sceneName: string,
): Promise<{ success: boolean; sceneName: string }> {
  const response = await fetcher<{
    data: { success: boolean; sceneName: string }
  }>(`/api/livestream/obs/scene/${encodeURIComponent(sceneName)}`, {
    method: 'POST',
  })
  return response.data
}

export async function startStream(): Promise<StartStreamResponse> {
  const response = await fetcher<{ data: StartStreamResponse }>(
    '/api/livestream/obs/stream/start',
    { method: 'POST' },
  )
  return response.data
}

export async function stopStream(): Promise<{ success: boolean }> {
  const response = await fetcher<{ data: { success: boolean } }>(
    '/api/livestream/obs/stream/stop',
    { method: 'POST' },
  )
  return response.data
}

export async function getOBSConfig(): Promise<OBSConfig> {
  const response = await fetcher<{ data: OBSConfig }>(
    '/api/livestream/obs/config',
  )
  return response.data
}

export async function updateOBSConfig(
  config: Partial<OBSConfig>,
): Promise<OBSConfig> {
  const response = await fetcher<{ data: OBSConfig }>(
    '/api/livestream/obs/config',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    },
  )
  return response.data
}
