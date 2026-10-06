/**
 * Checks if content appears to be OpenSong XML format: a <song> element
 * with <lyrics>, after an optional XML declaration (our own export writes one)
 */
export function isOpenSongXml(content: string): boolean {
  const trimmed = content.trim().replace(/^<\?xml[^>]*\?>\s*/, '')
  return trimmed.startsWith('<song') && trimmed.includes('<lyrics>')
}
