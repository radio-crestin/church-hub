import { requirePermission } from '../middleware/permissions'
import type { RequestContext } from '../middleware/types'
import {
  notifyScreenDesignChanged,
  setSceneTemplate,
} from '../service/presentation'
import { deleteSlideTemplate } from '../service/slide-templates/deleteSlideTemplate'
import {
  getSlideTemplate,
  getSlideTemplates,
} from '../service/slide-templates/getSlideTemplates'
import { getTemplateUsage } from '../service/slide-templates/getTemplateUsage'
import { notifyTemplateChanged } from '../service/slide-templates/notifyTemplateChanged'
import { SlideTemplateError } from '../service/slide-templates/SlideTemplateError'
import type { SaveSlideTemplateInput } from '../service/slide-templates/types'
import {
  duplicateSlideTemplate,
  upsertSlideTemplate,
} from '../service/slide-templates/upsertSlideTemplate'
import { createLogger } from '../utils/logger'

type HandleCors = (req: Request, res: Response) => Response

const logger = createLogger('slide-templates')
const TEMPLATE_PATH = /^\/api\/slide-templates\/(\d+)$/
const SCENE_TEMPLATE_PATH = /^\/api\/screens\/(\d+)\/scene-templates\/([^/]+)$/

/**
 * Slide templates (CH-184), for who can see or change the displays.
 *
 * - GET    /api/slide-templates          every template
 * - GET    /api/slide-templates/:id      one, with who draws with it (`usage`)
 * - POST   /api/slide-templates          a new one: `{ name, fromId? }` copies fromId
 * - PUT    /api/slide-templates/:id      save its name and/or design
 * - DELETE /api/slide-templates/:id      only one nothing draws with
 * - PUT    /api/screens/:id/scene-templates/:scene  `{ templateId | null }`:
 *          the template the screen draws with while that OBS scene is live
 */
export async function handleSlideTemplateRoutes(
  req: Request,
  url: URL,
  handleCors: HandleCors,
  context: RequestContext | null,
): Promise<Response | null> {
  const { pathname } = url
  const sceneMatch = pathname.match(SCENE_TEMPLATE_PATH)
  if (!pathname.startsWith('/api/slide-templates') && !sceneMatch) return null

  const respond = (status: number, payload: unknown): Response =>
    handleCors(
      req,
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  if (!context) return respond(401, { error: 'Unauthorized' })
  const permission =
    req.method === 'GET'
      ? 'displays.view'
      : req.method === 'DELETE'
        ? 'displays.delete'
        : 'displays.edit'
  const denied = requirePermission(permission)(context)
  if (denied) return handleCors(req, denied)

  try {
    if (sceneMatch && req.method === 'PUT') {
      const screenId = Number(sceneMatch[1])
      const body = (await req.json()) as { templateId: number | null }
      const result = setSceneTemplate(
        screenId,
        decodeURIComponent(sceneMatch[2] as string),
        body.templateId ?? null,
      )
      if (!result.success) return respond(400, { error: result.error })
      notifyScreenDesignChanged(screenId)
      return respond(200, { data: { success: true } })
    }

    if (pathname === '/api/slide-templates') {
      if (req.method === 'GET')
        return respond(200, { data: getSlideTemplates() })
      if (req.method === 'POST') {
        const body = (await req.json()) as { name?: string; fromId?: number }
        const template =
          body.fromId !== undefined
            ? duplicateSlideTemplate(body.fromId, body.name)
            : upsertSlideTemplate({ name: body.name ?? '' })
        notifyTemplateChanged(template.id)
        return respond(201, { data: template })
      }
      return null
    }

    const match = pathname.match(TEMPLATE_PATH)
    if (!match) return null
    const id = Number(match[1])
    if (req.method === 'GET') {
      const template = getSlideTemplate(id)
      if (!template) return respond(404, { error: 'Template not found' })
      return respond(200, {
        data: { ...template, usage: getTemplateUsage(id) },
      })
    }
    if (req.method === 'PUT') {
      const body = (await req.json()) as SaveSlideTemplateInput
      const template = upsertSlideTemplate({ ...body, id })
      notifyTemplateChanged(id)
      return respond(200, { data: template })
    }
    if (req.method === 'DELETE') {
      deleteSlideTemplate(id)
      notifyTemplateChanged(id)
      return respond(200, { data: { success: true } })
    }
    return null
  } catch (error) {
    if (error instanceof SlideTemplateError) {
      return respond(error.status, { error: error.message })
    }
    if (error instanceof SyntaxError) {
      return respond(400, { error: 'Invalid JSON body' })
    }
    logger.error(`Slide template request failed: ${error}`)
    return respond(500, { error: 'Slide template request failed' })
  }
}
