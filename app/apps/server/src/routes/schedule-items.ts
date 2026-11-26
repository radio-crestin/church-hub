import { requirePermission } from '../middleware/permissions'
import type { RequestContext } from '../middleware/types'
import { presentStepAt, repickSchedule } from '../service/schedule-automation'
import { refreshPresentedDeck } from '../service/schedule-automation/refreshPresentedDeck'
import {
  type MusicItemConfig,
  startMusicItems,
} from '../service/schedule-items'
import {
  getScheduleItemById,
  setScheduleItemConfig,
} from '../service/schedules'
import type { Permission } from '../service/users/types'

type HandleCors = (req: Request, res: Response) => Response

const CONFIG_PATH = /^\/api\/schedules\/(\d+)\/items\/(\d+)\/config$/
const PLAY_PATH = /^\/api\/schedules\/(\d+)\/items\/(\d+)\/play$/
const REPICK_PATH = /^\/api\/schedules\/(\d+)\/repick$/
const STEP_PATH = /^\/api\/schedules\/(\d+)\/steps\/(\d+)\/present$/

/**
 * A presentation's items with settings (music, video, verses):
 *
 * - PUT  /api/schedules/:id/items/:itemId/config  `{ itemConfig }` its settings
 *   (a deck's slide on screen is put up again from the new deck)
 * - POST /api/schedules/:id/items/:itemId/play    a music item plays now
 * - POST /api/schedules/:id/repick                new random verses and videos
 * - POST /api/schedules/:id/steps/:index/present  a step goes up, built by the
 *   server like the runner does (a video)
 */
export async function handleScheduleItemRoutes(
  req: Request,
  url: URL,
  handleCors: HandleCors,
  context: RequestContext | null,
): Promise<Response | null> {
  const { pathname } = url
  if (!pathname.startsWith('/api/schedules/')) return null

  const respond = (status: number, payload: unknown): Response =>
    handleCors(
      req,
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  const deny = (permission: Permission): Response | null => {
    if (!context) return respond(401, { error: 'Unauthorized' })
    const denied = requirePermission(permission)(context)
    return denied ? handleCors(req, denied) : null
  }

  const config = pathname.match(CONFIG_PATH)
  if (config && req.method === 'PUT') {
    const denied = deny('programs.edit')
    if (denied) return denied
    const body = (await req.json().catch(() => null)) as {
      itemConfig?: unknown
    } | null
    const result = setScheduleItemConfig(
      Number(config[1]),
      Number(config[2]),
      body?.itemConfig,
    )
    if (!result.success) return respond(400, { error: result.error })
    const item = getScheduleItemById(Number(config[2]))
    // A deck changes nothing random: its slide on screen shows the edit.
    if (item?.itemType === 'slides') {
      await refreshPresentedDeck(Number(config[1]), item.id)
    } else {
      repickSchedule(Number(config[1]))
    }
    return respond(200, { data: item })
  }

  const play = pathname.match(PLAY_PATH)
  if (play && req.method === 'POST') {
    const denied = deny('control_room.control')
    if (denied) return denied
    const item = getScheduleItemById(Number(play[2]))
    if (item?.scheduleId !== Number(play[1]) || item.itemType !== 'music') {
      return respond(404, { error: 'Music item not found' })
    }
    await startMusicItems([item.itemConfig as MusicItemConfig])
    return respond(200, { data: { success: true } })
  }

  const repick = pathname.match(REPICK_PATH)
  if (repick && req.method === 'POST') {
    const denied = deny('control_room.control')
    if (denied) return denied
    const schedule = repickSchedule(Number(repick[1]))
    if (!schedule) return respond(404, { error: 'Presentation not found' })
    return respond(200, { data: schedule })
  }

  const step = pathname.match(STEP_PATH)
  if (step && req.method === 'POST') {
    const denied = deny('control_room.control')
    if (denied) return denied
    const state = await presentStepAt(Number(step[1]), Number(step[2]))
    if (!state) return respond(404, { error: 'Step not found' })
    return respond(200, { data: state })
  }

  return null
}
