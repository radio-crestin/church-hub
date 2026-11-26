/**
 * Cuts a line into words and the spaces between them, punctuation staying on
 * its word ("Doamne!" is one word). Joined back, the pieces are the line.
 */
export function tokenizeLine(line: string): string[] {
  return line.match(/\s+|\S+/g) ?? []
}
