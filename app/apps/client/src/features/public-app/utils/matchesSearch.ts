/** Lower case without diacritics (ș, ț, ă, â, î), for search. */
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/** True when every word of the query is in the title or the author. */
export function matchesSearch(
  song: { title: string; author: string | null },
  query: string,
): boolean {
  const haystack = fold(`${song.title} ${song.author ?? ''}`)
  return fold(query)
    .split(/\s+/)
    .every((word) => haystack.includes(word))
}
