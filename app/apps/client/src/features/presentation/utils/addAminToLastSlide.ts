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

  // Remove trailing empty paragraphs to ensure only one empty line before Amin
  const trimmedContent = content.replace(/(<p><br><\/p>|\s)+$/gi, '')

  return `${trimmedContent}<p><br></p><p style="text-align: right;">Amin!</p>`
}
