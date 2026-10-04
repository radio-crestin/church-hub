import { Hono } from 'hono'
import {
  FeatureRequestError,
  getScreenshotStore,
  parseFeatureRequest,
  SCREENSHOT_ROUTE_PREFIX,
  submitFeatureRequest,
} from '../feature-requests'
import type { Bindings } from '../types'

const SCREENSHOT_ID_PATTERN = /^[0-9a-f-]{36}\.(jpg|png|webp)$/

const featureRequests = new Hono<{ Bindings: Bindings }>()

/**
 * POST /feature-requests
 * Creates a public GitHub issue from an in-app "Request a feature" report
 * and notifies the maintainer on WhatsApp. Called by the app's local
 * server (no browser Origin), so CORS does not apply; abuse is capped by a
 * per-IP rate limit instead.
 */
featureRequests.post('/feature-requests', async (c) => {
  const clientIp = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const { success: withinLimit } = await c.env.FEATURE_REQUEST_RATE_LIMITER.limit(
    { key: `feature-request:${clientIp}` }
  )
  if (!withinLimit) {
    return c.json({ success: false, error: 'Too many requests' }, 429)
  }

  try {
    const request = parseFeatureRequest(await c.req.json().catch(() => null))
    const issue = await submitFeatureRequest(
      c.env,
      request,
      new URL(c.req.url).origin
    )
    return c.json({
      success: true,
      issueUrl: issue.url,
      issueNumber: issue.number,
      whatsAppSent: issue.whatsAppSent,
    })
  } catch (error) {
    if (error instanceof FeatureRequestError) {
      return c.json({ success: false, error: error.message }, error.status)
    }
    console.error('[feature-requests] submission failed:', error)
    return c.json(
      { success: false, error: 'Failed to create the feature request' },
      500
    )
  }
})

/**
 * GET /feature-requests/screenshots/:id
 * Serves a stored screenshot so the public GitHub issue can embed it.
 */
featureRequests.get(`${SCREENSHOT_ROUTE_PREFIX}/:id`, async (c) => {
  const id = c.req.param('id')
  if (!SCREENSHOT_ID_PATTERN.test(id)) return c.json({ error: 'Not found' }, 404)

  const screenshot = await getScreenshotStore(c.env).load(id)
  if (!screenshot) return c.json({ error: 'Not found' }, 404)

  return new Response(screenshot.body, {
    headers: {
      'Content-Type': screenshot.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
})

export default featureRequests
