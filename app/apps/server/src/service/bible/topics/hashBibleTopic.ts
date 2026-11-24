/** A topic's content hash: its titles and its references' JSON. */
export function hashBibleTopic(
  titleEn: string,
  titleRo: string,
  referencesJson: string,
): string {
  return Bun.hash(`${titleEn}\n${titleRo}\n${referencesJson}`).toString(36)
}
