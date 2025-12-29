/**
 * Adds "Amin!" right-aligned to the last slide of a song presentation
 * @param content - The slide content (HTML string)
 * @param isLastSlide - Whether this is the last slide of the song
 * @returns The content with "Amin!" appended if it's the last slide and doesn't already contain "Amin"
 */
export function addAminToLastSlide(
  content: string,
  isLastSlide: boolean,
): string {
  if (!isLastSlide) return content
  if (/amin/i.test(content)) return content
  return `${content}<p><br></p><p style="text-align: right;">Amin!</p>`
}
