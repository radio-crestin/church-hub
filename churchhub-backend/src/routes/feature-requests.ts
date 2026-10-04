import { type Context, Hono } from 'hono'
import {
  consumeDailyQuota,
  FeatureRequestError,
  getScreenshotStore,
  parseFeatureRequest,
  SCREENSHOT_ROUTE_PREFIX,
  submitFeatureRequest,
} from '../feature-requests'
import type { Bindings } from '../types'

// `<random UUID>.<ext>`: unguessable, so only the issue's link finds it.
const SCREENSHOT_ID_PATTERN = /^[0-9a-f-]{36}\.(jpg|png|webp)$/

const featureRequests = new Hono<{ Bindings: Bindings }>()

/**
 * POST /feature-requests
 * Creates a public GitHub issue from an in-app "Request a feature" report
 * (screenshot stored in R2 and embedded) and notifies the
 * maintainer on WhatsApp. Called by the app's local server (no browser
 * Origin), so CORS does not apply. Abuse is capped per IP instead: a short
 * burst limit (binding) and 50 requests per rolling 24 hours (KV), both
 * checked before anything reaches GitHub or WhatsApp.
 */
featureRequests.post('/feature-requests', async (c) => {
  const clientIp = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const { success: withinLimit } =
    await c.env.FEATURE_REQUEST_RATE_LIMITER.limit({
      key: `feature-request:${clientIp}`,
    })
  if (!withinLimit) return rateLimited(c)

  try {
    const request = parseFeatureRequest(await c.req.json().catch(() => null))
    const withinDailyQuota = await consumeDailyQuota(
      c.env.SIGNALING_KV,
      clientIp,
      c.env.COOKIE_ENCRYPTION_KEY
    )
    if (!withinDailyQuota) return rateLimited(c)

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
 * Ids never change content, so the response is cached for a year.
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
      'X-Content-Type-Options': 'nosniff',
    },
  })
})

/** 429 with a stable code the app turns into a translated message. */
function rateLimited(c: Context) {
  return c.json(
    { success: false, code: 'rate_limited', error: 'Too many requests' },
    429
  )
}

export default featureRequests
