import { getPublicAppUrl } from '../sync/cloud/getPublicAppUrl'

/**
 * The page a song's link opens, on the public web app: the service it is
 * kept on goes along, as in a join link.
 */
export function songLinkUrl(linkId: string, serviceUrl: string): string {
  const service = encodeURIComponent(serviceUrl.replace(/\/+$/, ''))
  return `${getPublicAppUrl()}/song/${linkId}?s=${service}`
}
