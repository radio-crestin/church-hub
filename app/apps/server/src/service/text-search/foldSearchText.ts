/**
 * Lowercase and diacritic-free: the form the index tokenizer
 * (`unicode61 remove_diacritics 2`) stores, and the form every query term
 * and every scored text is compared in. "Înțelepciune" → "intelepciune".
 */
export function foldSearchText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
