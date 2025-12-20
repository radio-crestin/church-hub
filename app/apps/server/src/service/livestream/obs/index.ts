import { getOBSConfig } from './config'
import { obsConnection } from './websocket-client'
import {
  broadcastOBSConnectionStatus,
  broadcastOBSCurrentScene,
  broadcastOBSStreamingStatus,
} from '../../../websocket'

export { getOBSConfig, updateOBSConfig } from './config'
export {
  getScenes,
  getVisibleScenes,
  reorderScenes,
  switchScene,
  updateScene,
} from './scenes'
export {
  startRecording,
  startStreaming,
  stopRecording,
  stopStreaming,
} from './streaming'
export { obsConnection }

export function initializeOBSCallbacks() {
  obsConnection.setCurrentSceneCallback((sceneName) => {
    broadcastOBSCurrentScene(sceneName)
  })

  obsConnection.setConnectionStatusCallback((status) => {
    broadcastOBSConnectionStatus({
      ...status,
      updatedAt: Date.now(),
    })
  })

  obsConnection.setStreamingStatusCallback((status) => {
    broadcastOBSStreamingStatus({
      ...status,
      updatedAt: Date.now(),
    })
  })
}

export async function initializeOBSAutoConnect() {
  try {
    const config = await getOBSConfig()

    if (config.autoConnect) {
      // biome-ignore lint/suspicious/noConsole: Startup logging
      console.log(
        `[obs] Auto-connect enabled, connecting to ${config.host}:${config.port}...`,
      )

      // Enable auto-reconnect for permanent connection
      obsConnection.enableAutoReconnect(true)

      // Attempt initial connection
      try {
        await obsConnection.connect(config.host, config.port, config.password)
        // biome-ignore lint/suspicious/noConsole: Startup logging
        console.log('[obs] Successfully connected to OBS')
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: Startup logging
        console.log(
          `[obs] Initial connection failed, will retry automatically: ${error}`,
        )
        // Auto-reconnect will handle retries
      }
    } else {
      // biome-ignore lint/suspicious/noConsole: Startup logging
      console.log('[obs] Auto-connect disabled')
    }
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Startup logging
    console.error('[obs] Failed to initialize auto-connect:', error)
  }
}
