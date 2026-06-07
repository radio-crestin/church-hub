/**
 * Normalizes text for Chroma documents: strips HTML, removes diacritics,
 * lowercases and collapses whitespace. Documents are stored normalized so
 * keyword $contains matching is case- and diacritic-insensitive (Chroma's
 * full-text matching is case-sensitive); the original display text lives in
 * document metadata.
 */
export function normalizeForChromaDoc(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Strips HTML and collapses whitespace but keeps case/diacritics — used for
 * the display text stored in document metadata.
 */
export function stripForDisplay(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Stable content hash for sync diffing. */
export function hashDoc(text: string): string {
  return Bun.hash(text).toString(36)
}
