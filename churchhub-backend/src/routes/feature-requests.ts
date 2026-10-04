import { Hono } from 'hono'
import {
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
 * Origin), so CORS does not apply; a per-IP rate limit caps abuse instead.
 */
featureRequests.post('/feature-requests', async (c) => {
  const clientIp = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const { success: withinLimit } =
    await c.env.FEATURE_REQUEST_RATE_LIMITER.limit({
      key: `feature-request:${clientIp}`,
    })
  if (!withinLimit) {
    return c.json({ success: false, error: 'Too many requests' }, 429)
  }

  try {
    const request = parseFeatureRequest(await c.req.json().catch(() => null))
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

export default featureRequests
