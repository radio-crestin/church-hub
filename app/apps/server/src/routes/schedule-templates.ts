import { requirePermission } from '../middleware/permissions'
import type { RequestContext } from '../middleware/types'
import {
  getPresentationState,
  updatePresentationState,
} from '../service/presentation'
import {
  setScheduleItemTemplate,
  setScheduleTemplate,
} from '../service/schedules'
import { broadcastPresentationState } from '../websocket'

type HandleCors = (req: Request, res: Response) => Response

const SCHEDULE_PATH = /^\/api\/schedules\/(\d+)\/template$/
const ITEM_PATH = /^\/api\/schedules\/(\d+)\/items\/(\d+)\/template$/

/** A presentation on screen now redraws with its new template. */
function redrawIfLive(scheduleId: number): void {
  const { temporaryContent } = getPresentationState()
  const data = temporaryContent?.data as { scheduleId?: number } | undefined
  if (data?.scheduleId !== scheduleId) return
  broadcastPresentationState(updatePresentationState({ temporaryContent }))
}

/**
 * The slide template of a presentation and of its items (CH-184), for who
 * can edit presentations. `{ templateId: number | null }`:
 *
 * - PUT /api/schedules/:id/template               null: each screen's own
 * - PUT /api/schedules/:id/items/:itemId/template null: the presentation's
 */
export async function handleScheduleTemplateRoutes(
  req: Request,
  url: URL,
  handleCors: HandleCors,
  context: RequestContext | null,
): Promise<Response | null> {
  if (req.method !== 'PUT') return null
  const scheduleMatch = url.pathname.match(SCHEDULE_PATH)
  const itemMatch = url.pathname.match(ITEM_PATH)
  if (!scheduleMatch && !itemMatch) return null

  const respond = (status: number, payload: unknown): Response =>
    handleCors(
      req,
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  if (!context) return respond(401, { error: 'Unauthorized' })
  const denied = requirePermission('programs.edit')(context)
  if (denied) return handleCors(req, denied)

  const body = (await req.json().catch(() => null)) as {
    templateId?: unknown
  } | null
  const templateId = body?.templateId
  if (templateId !== null && typeof templateId !== 'number') {
    return respond(400, { error: 'templateId must be a number or null' })
  }

  const scheduleId = Number((scheduleMatch ?? itemMatch)?.[1])
  const result = scheduleMatch
    ? setScheduleTemplate(scheduleId, templateId)
    : setScheduleItemTemplate(scheduleId, Number(itemMatch?.[2]), templateId)
  if (!result.success) return respond(404, { error: result.error })
  redrawIfLive(scheduleId)
  return respond(200, { data: result })
}
