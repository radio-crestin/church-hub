/**
 * Stops user text from pinging GitHub users or teams in a public issue:
 * a zero-width space after `@` keeps the text readable but unlinked.
 */
export function neutralizeMentions(text: string): string {
  return text.replace(/@(?=[A-Za-z0-9-])/g, '@​')
}
