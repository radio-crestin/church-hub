import { musicFileIds } from './musicFileIds'
import { shuffle } from './shuffle'
import type { MusicItemConfig } from './types'
import { createLogger } from '../../utils/logger'
import { broadcastMusicState } from '../../websocket'
import {
  addMultipleToNowPlaying,
  clearNowPlayingQueue,
  executeCommand,
  getPlayerState,
  refreshQueueState,
} from '../music-player'

const logger = createLogger('schedule-items')

/**
 * Plays music items from their first track: their tracks replace the player's
 * queue, each item's in a new random order when it shuffles. The music then
 * keeps playing under whatever is shown, at the player's volume.
 */
export async function startMusicItems(
  configs: MusicItemConfig[],
): Promise<void> {
  const ids = configs.flatMap((config) => {
    const itemIds = musicFileIds(config)
    return config.shuffle ? shuffle(itemIds) : itemIds
  })
  if (ids.length === 0) {
    logger.warning('A music item has no tracks to play')
    return
  }
  clearNowPlayingQueue()
  addMultipleToNowPlaying(ids)
  refreshQueueState()
  await executeCommand({ type: 'play_index', index: 0 })
  broadcastMusicState(getPlayerState())
  logger.info(`Music started: ${ids.length} tracks`)
}
