import { buildScheduleSteps } from './buildScheduleSteps'
import { createLogger } from '../../utils/logger'
import { getPlayerState } from '../music-player'
import { type MusicItemConfig, startMusicItems } from '../schedule-items'
import { flattenScheduleItems } from '../schedules/flattenScheduleItems'
import { getScheduleById } from '../schedules/getSchedules'
import type { ScheduleItem } from '../schedules/types'

const logger = createLogger('schedule-automation')

/** The music last started by a presentation, so going back and forth over it does not start it again. */
let playing: string | null = null

/** A run starting over: its music starts again when it is reached. */
export function forgetPresentationMusic(): void {
  playing = null
}

/** The music items right before `item`, in order. */
function musicItemsBefore(items: ScheduleItem[], item: ScheduleItem) {
  const music: ScheduleItem[] = []
  for (let i = items.findIndex((it) => it.id === item.id) - 1; i >= 0; i--) {
    const before = items[i]
    if (before?.itemType !== 'music') break
    music.unshift(before)
  }
  return music.filter((m) => m.itemConfig)
}

/**
 * A presentation's step went up, by its runner or by an operator: when it is
 * the first step after music items, they start playing, and keep playing
 * under the slides that follow. Music already started from the same items and
 * still playing goes on as it is.
 */
export async function cueMusicForStep(
  scheduleId: number,
  stepIndex: number,
): Promise<void> {
  const schedule = getScheduleById(scheduleId)
  if (!schedule) return
  const step = buildScheduleSteps(schedule.items)[stepIndex]
  if (!step || step.index !== 0) return
  const music = musicItemsBefore(
    flattenScheduleItems(schedule.items),
    step.item,
  )
  if (music.length === 0) return

  const key = music.map((m) => m.id).join(',')
  if (playing === key && getPlayerState().isPlaying) return
  playing = key
  logger.info(
    `Presentation ${scheduleId}: music starts before step ${stepIndex}`,
  )
  await startMusicItems(music.map((m) => m.itemConfig as MusicItemConfig))
}

/** A presentation with music and nothing to show plays its music. */
export async function playMusicOnly(items: ScheduleItem[]): Promise<boolean> {
  const music = items.filter((it) => it.itemType === 'music' && it.itemConfig)
  if (music.length === 0) return false
  playing = music.map((m) => m.id).join(',')
  await startMusicItems(music.map((m) => m.itemConfig as MusicItemConfig))
  return true
}
