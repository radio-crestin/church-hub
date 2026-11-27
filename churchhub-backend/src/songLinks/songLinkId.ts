import { hashToken } from '../sync/hashToken'

/**
 * A song's link id: keyed by the service's secret, so nobody can guess
 * another song's link, and the same for every device of the church, so
 * sharing a song again updates the page its link opens.
 */
export async function songLinkId(
  churchId: string,
  songUuid: string,
  secret: string
): Promise<string> {
  const hash = await hashToken(`song-link:${churchId}:${songUuid}`, secret)
  return hash.slice(0, 32)
}
