/**
 * Adds the musical key (keyLine) to the bottom of the first slide of a song presentation
 * @param content - The slide content (HTML string)
 * @param isFirstSlide - Whether this is the first slide of the song
 * @param keyLine - The musical key to display (e.g., "C Major", "Am")
 * @returns The content with keyLine appended if it's the first slide and keyLine is defined
 */
export function addKeyLineToFirstSlide(
  content: string,
  isFirstSlide: boolean,
  keyLine: string | null | undefined,
): string {
  if (!isFirstSlide) return content
  if (!keyLine) return content

  // Remove trailing empty paragraphs and whitespace
  const trimmedContent = content.replace(/(<p><br><\/p>|\s)+$/gi, '')

  // Add keyLine with one empty line before it
  // <br> creates an extra newline when HTML is converted to text
  return `${trimmedContent}<br><p>${keyLine}</p>`
}
