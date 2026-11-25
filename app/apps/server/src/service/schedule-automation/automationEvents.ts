import { runTriggers } from './runTriggers'
import type { OBSStreamingStatus } from '../livestream/types'

let lastScene: string | undefined
/** OBS's outputs as last seen while connected; unknown until then. */
let lastOutputs: OBSStreamingStatus | undefined

/**
 * OBS's program scene changed, in OBS or from Church Hub. Only a change
 * counts: the same scene reported again (a reconnect) fires nothing.
 */
export function onSceneSelected(sceneName: string): void {
  if (sceneName === lastScene) return
  lastScene = sceneName
  void runTriggers({ event: 'scene_selected', sceneName })
}

/**
 * OBS's stream or recording status, as it reports it. The first status after
 * connecting is only where things stand (a stream already live when Church
 * Hub starts starts nothing), and losing OBS is not the stream ending.
 */
export function onOutputsChanged(
  status: OBSStreamingStatus,
  connected: boolean,
): void {
  const previous = lastOutputs
  lastOutputs = connected ? status : undefined
  if (!connected || !previous) return
  if (status.isStreaming !== previous.isStreaming) {
    void runTriggers({
      event: status.isStreaming ? 'stream_started' : 'stream_stopped',
    })
  }
  if (status.isRecording !== previous.isRecording) {
    void runTriggers({
      event: status.isRecording ? 'recording_started' : 'recording_stopped',
    })
  }
}
