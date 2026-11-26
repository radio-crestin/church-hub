/**
 * Whether a navigation was started by the user (a typed or pasted link, a
 * QR code, a bookmark) or by the app's own page, never by another site's
 * page: `Sec-Fetch-Site` is `none` or `same-origin`. Without the header it
 * can't be told, so it doesn't count: browsers send it only to https and
 * to this machine, never to a plain-http address on the network.
 */
export function isOpenedByUser(req: Request): boolean {
  const site = req.headers.get('sec-fetch-site')
  return site === 'none' || site === 'same-origin'
}
