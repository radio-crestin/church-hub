/**
 * The public web app (the client built as a PWA, hosted on Cloudflare
 * Pages) that join links open. A church that hosts its own, and the tests,
 * point CHURCH_HUB_PUBLIC_APP_URL at theirs.
 */
export function getPublicAppUrl(): string {
  return (
    process.env.CHURCH_HUB_PUBLIC_APP_URL || 'https://church-hub.pages.dev'
  ).replace(/\/+$/, '')
}
