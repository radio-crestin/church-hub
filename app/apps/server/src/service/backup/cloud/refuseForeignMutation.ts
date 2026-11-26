import { isAppOrigin } from './isAppOrigin'

const refuse = (status: number, error: string) =>
  Response.json({ error }, { status })

/**
 * Defence against a website open in the operator's browser driving these
 * routes (CSRF). A request that changes something must:
 * - come from the app's own UI: an Origin that isn't, or a cross-site
 *   request (Sec-Fetch-Site) without one that is, is refused (the Windows
 *   webview, tauri.localhost, is cross-site to localhost but its own);
 * - send JSON, which a cross-site form can't, so a browser must preflight.
 * Returns the refusal, or null to go on. Reads (GET) pass.
 */
export function refuseForeignMutation(req: Request): Response | null {
  if (req.method === 'GET' || req.method === 'HEAD') return null
  const origin = req.headers.get('Origin')
  const fromApp = origin !== null && isAppOrigin(origin)
  if (origin !== null && !fromApp) return refuse(403, 'foreign_origin')
  if (req.headers.get('Sec-Fetch-Site') === 'cross-site' && !fromApp) {
    return refuse(403, 'foreign_origin')
  }
  const contentType = req.headers.get('Content-Type') ?? ''
  if (!/^application\/json\b/i.test(contentType)) {
    return refuse(415, 'json_required')
  }
  return null
}
