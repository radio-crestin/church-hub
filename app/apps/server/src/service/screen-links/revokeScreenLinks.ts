import { readScreenLinks, writeScreenLinks } from './screenLinkStore'

/** Revokes the link `id`, or every link; whether any was removed. */
export function revokeScreenLinks(id?: string): boolean {
  const links = readScreenLinks()
  const kept = id ? links.filter((link) => link.id !== id) : []
  writeScreenLinks(kept)
  return kept.length < links.length
}
