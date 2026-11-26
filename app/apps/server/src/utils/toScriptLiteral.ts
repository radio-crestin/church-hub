/**
 * A value as a JavaScript literal safe inside an inline `<script>`: JSON,
 * with `<` escaped so the text can never close the script element.
 */
export function toScriptLiteral(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
