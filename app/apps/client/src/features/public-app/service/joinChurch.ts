import { type ChurchBinding, saveChurchBinding } from './churchBinding'
import { fetchReadUrl } from './fetchReadUrl'
import type { JoinLink } from './parseJoinLink'

/**
 * Binds this browser or phone to the church in the link: the service checks
 * the token and answers with the church's read path, and both are kept.
 */
export async function joinChurch(link: JoinLink): Promise<ChurchBinding> {
  const readUrl = await fetchReadUrl(link)
  const binding = { ...link, readUrl }
  saveChurchBinding(binding)
  return binding
}
