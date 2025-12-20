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
