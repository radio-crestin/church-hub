import { requirePermission } from '../middleware/permissions'
import type { RequestContext } from '../middleware/types'
import { getDefaultTranslation } from '../service/bible'
import {
  getBibleTopicPassages,
  listBibleTopics,
  setBibleTopicPassageTemplate,
} from '../service/bible/topics'
import type { BibleTopicReference } from '../service/bible/topics/types'

type HandleCors = (req: Request, res: Response) => Response

const TOPIC_PASSAGES_PATH = /^\/api\/bible\/topics\/(\d+)$/
const PASSAGE_TEMPLATE_PATH = /^\/api\/bible\/topics\/(\d+)\/passage-template$/

type Respond = (status: number, payload: unknown) => Response

const isWholeNumber = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value)

/** `{ book, chapter, startVerse, endVerse, templateId }`, or null. */
function readPassageTemplate(body: unknown) {
  const input = body as
    | (Partial<BibleTopicReference> & { templateId?: unknown })
    | null
  if (
    !input ||
    typeof input.book !== 'string' ||
    ![input.chapter, input.startVerse, input.endVerse].every(isWholeNumber) ||
    (input.templateId !== null && !isWholeNumber(input.templateId))
  ) {
    return null
  }
  return {
    passage: {
      book: input.book,
      chapter: input.chapter as number,
      startVerse: input.startVerse as number,
      endVerse: input.endVerse as number,
    },
    templateId: input.templateId as number | null,
  }
}

/** PUT /api/bible/topics/:id/passage-template */
async function putPassageTemplate(
  req: Request,
  topicId: number,
  respond: Respond,
): Promise<Response> {
  const input = readPassageTemplate(await req.json().catch(() => null))
  if (!input) {
    return respond(400, {
      error:
        'book, chapter, startVerse, endVerse and templateId (a number or null) are required',
    })
  }
  const result = setBibleTopicPassageTemplate(
    topicId,
    input.passage,
    input.templateId,
  )
  if (result === 'topic-not-found') {
    return respond(404, { error: 'Topic not found' })
  }
  if (result === 'template-not-found') {
    return respond(404, { error: 'Template not found' })
  }
  return respond(200, { data: { success: true } })
}

/**
 * Bible verses by topic, for who can see the Bible.
 *
 * - GET /api/bible/topics                         every topic
 * - GET /api/bible/topics/:id?translationId=:tid  a topic with its passages
 *   in that translation (the default one when not given)
 * - PUT /api/bible/topics/:id/passage-template     a passage's own slide
 *   template (null: the topic's), for who can present Bible verses
 */
export async function handleBibleTopicRoutes(
  req: Request,
  url: URL,
  handleCors: HandleCors,
  context: RequestContext | null,
): Promise<Response | null> {
  const { pathname } = url
  if (!pathname.startsWith('/api/bible/topics')) return null
  const passageTemplate =
    req.method === 'PUT' ? pathname.match(PASSAGE_TEMPLATE_PATH) : null
  if (req.method !== 'GET' && !passageTemplate) return null

  const respond = (status: number, payload: unknown): Response =>
    handleCors(
      req,
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  if (!context) return respond(401, { error: 'Unauthorized' })
  const denied = requirePermission(
    passageTemplate ? 'bible.present_now' : 'bible.view',
  )(context)
  if (denied) return handleCors(req, denied)
  if (passageTemplate) {
    return putPassageTemplate(req, Number(passageTemplate[1]), respond)
  }

  if (pathname === '/api/bible/topics') {
    return respond(200, { data: listBibleTopics() })
  }

  const match = pathname.match(TOPIC_PASSAGES_PATH)
  if (!match) return null
  const translationId =
    Number(url.searchParams.get('translationId')) || getDefaultTranslation()?.id
  if (!translationId) {
    return respond(404, { error: 'No Bible translation installed' })
  }
  const topic = getBibleTopicPassages(Number(match[1]), translationId)
  if (!topic) return respond(404, { error: 'Topic not found' })
  return respond(200, { data: topic })
}
