/**
 * `value` as a JavaScript literal safe to embed inside an inline `<script>`.
 *
 * JSON.stringify escapes quotes and backslashes; `<` is escaped too so the
 * value can never close the script element (`</script>`) or open a comment,
 * and U+2028 and U+2029 so older engines don't read them as line breaks.
 */
export function toScriptLiteral(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
