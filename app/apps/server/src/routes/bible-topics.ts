import { requirePermission } from '../middleware/permissions'
import type { RequestContext } from '../middleware/types'
import { getDefaultTranslation } from '../service/bible'
import { getBibleTopicPassages, listBibleTopics } from '../service/bible/topics'

type HandleCors = (req: Request, res: Response) => Response

const TOPIC_PASSAGES_PATH = /^\/api\/bible\/topics\/(\d+)$/

/**
 * Bible verses by topic, for who can see the Bible.
 *
 * - GET /api/bible/topics                         every topic
 * - GET /api/bible/topics/:id?translationId=:tid  a topic with its passages
 *   in that translation (the default one when not given)
 */
export async function handleBibleTopicRoutes(
  req: Request,
  url: URL,
  handleCors: HandleCors,
  context: RequestContext | null,
): Promise<Response | null> {
  const { pathname } = url
  if (!pathname.startsWith('/api/bible/topics') || req.method !== 'GET') {
    return null
  }

  const respond = (status: number, payload: unknown): Response =>
    handleCors(
      req,
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  if (!context) return respond(401, { error: 'Unauthorized' })
  const denied = requirePermission('bible.view')(context)
  if (denied) return handleCors(req, denied)

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
