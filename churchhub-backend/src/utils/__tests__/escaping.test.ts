// Run: cd churchhub-backend && bun test
import { describe, expect, it } from 'bun:test'

import { escapeHtml } from '../escapeHtml'
import { toScriptLiteral } from '../toScriptLiteral'

describe('escapeHtml', () => {
  it('escapes every HTML metacharacter', () => {
    expect(escapeHtml(`<img src=x onerror="a('b')">&`)).toBe(
      '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;',
    )
  })

  it('leaves plain text unchanged', () => {
    expect(escapeHtml('access_denied')).toBe('access_denied')
  })
})

describe('toScriptLiteral', () => {
  it('is still a literal of the same value', () => {
    const value = { error: `it's \\ "bad"`, list: [1, 'two'] }
    expect(JSON.parse(toScriptLiteral(value))).toEqual(value)
  })

  it('cannot close the script element or break the string', () => {
    const hostile = `\\'</script><script>alert(1)</script>`
    const literal = toScriptLiteral(hostile)
    expect(literal).not.toContain('<')
    expect(JSON.parse(literal)).toBe(hostile)
  })

  it('escapes the JavaScript line separators', () => {
    expect(toScriptLiteral('a\u2028b\u2029c')).toBe('"a\\u2028b\\u2029c"')
  })
})
