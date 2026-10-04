import { type Context, Hono } from 'hono'
import {
  consumeDailyQuota,
  FeatureRequestError,
  parseFeatureRequest,
  submitFeatureRequest,
} from '../feature-requests'
import type { Bindings } from '../types'

const featureRequests = new Hono<{ Bindings: Bindings }>()

/**
 * POST /feature-requests
 * Creates a public GitHub issue from an in-app "Request a feature" report
 * (screenshot committed to the repo and embedded) and notifies the
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

    const issue = await submitFeatureRequest(c.env, request)
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

/** 429 with a stable code the app turns into a translated message. */
function rateLimited(c: Context) {
  return c.json(
    { success: false, code: 'rate_limited', error: 'Too many requests' },
    429
  )
}

export default featureRequests
