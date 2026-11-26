import { type ChurchBinding, saveChurchBinding } from './churchBinding'
import { fetchDevice } from './fetchDevice'
import { fetchReadUrl } from './fetchReadUrl'
import type { JoinLink } from './parseJoinLink'

/**
 * Binds this browser or phone to the church in the link: the service checks
 * the token and answers with the church's read path and whose device it
 * is, and all are kept.
 */
export async function joinChurch(link: JoinLink): Promise<ChurchBinding> {
  const [readUrl, device] = await Promise.all([
    fetchReadUrl(link),
    fetchDevice(link),
  ])
  const binding = { ...link, readUrl, ...device }
  saveChurchBinding(binding)
  return binding
}
