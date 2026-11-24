/**
 * The song-title element's text: the title, with the songbook and number
 * before it ("PDC 19 · La masa Ta noi azi venim") when the screen shows them
 * and the song has one.
 */
export function formatSongTitle(
  title: string | undefined,
  number: string | undefined,
  showNumber: boolean | undefined,
): string {
  if (!title) return ''
  return showNumber && number ? `${number} · ${title}` : title
}
