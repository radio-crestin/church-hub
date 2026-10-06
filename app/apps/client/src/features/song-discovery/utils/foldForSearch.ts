/** Lower case without diacritics, so "cantare" finds "Cântare". */
export function foldForSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
