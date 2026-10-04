/** Wraps text in a fenced Markdown code block that the text cannot close early. */
export function codeBlock(text: string): string {
  return ['```', text.replaceAll('```', "'''"), '```'].join('\n')
}
