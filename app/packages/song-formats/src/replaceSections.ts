/**
 * Replaces every `open…close` section of `text` (a CDATA block, a comment)
 * with `replace(inner)`, scanning once with indexOf: linear on any input,
 * where a lazy regex like /<!--[\s\S]*?-->/ is quadratic on many unclosed
 * openers. An unclosed opener and what follows it stay as they are.
 */
export function replaceSections(
  text: string,
  open: string,
  close: string,
  replace: (inner: string) => string,
): string {
  let result = ''
  let from = 0
  while (true) {
    const start = text.indexOf(open, from)
    if (start === -1) break
    const end = text.indexOf(close, start + open.length)
    if (end === -1) break
    result +=
      text.slice(from, start) + replace(text.slice(start + open.length, end))
    from = end + close.length
  }
  return result + text.slice(from)
}
