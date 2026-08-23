/**
 * Folds text for diacritic-insensitive matching in client-side filters.
 *
 * Romanian is typed both ways — "cantare" and "cântare", "si" and "și" — and
 * the legacy cedilla forms (ş, ţ) still show up in imported songs. Decomposing
 * to NFD and dropping the combining marks collapses all of those onto the same
 * ASCII base, which is exactly what the server-side FTS index already does
 * (`remove_diacritics 2`), so client filters match the same way the real search
 * does.
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}
