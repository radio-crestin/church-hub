import { escapeHtml } from './escapeHtml'

/**
 * `text` as one paragraph of a text box, aligned like `alignment`, bold or
 * italic as a whole (marks the text editor keeps).
 */
export function paragraphHtml(
  text: string,
  alignment: string,
  marks: { bold?: boolean; italic?: boolean } = {},
): string {
  let inner = escapeHtml(text)
  if (marks.italic) inner = `<em>${inner}</em>`
  if (marks.bold) inner = `<strong>${inner}</strong>`
  return `<p style="text-align: ${alignment}">${inner}</p>`
}
