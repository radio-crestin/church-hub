import { describe, expect, it } from 'vitest'

import { FONT_FAMILY_OPTIONS } from '../fontFamilyOptions'
import { getFontFamilyStack } from '../getFontFamilyStack'

const GENERIC_FAMILIES = ['serif', 'sans-serif', 'monospace']

describe('getFontFamilyStack', () => {
  it('adds metric-compatible Linux fallbacks to Times New Roman', () => {
    expect(getFontFamilyStack('Times New Roman')).toBe(
      "'Times New Roman', Times, 'Liberation Serif', Tinos, serif",
    )
  })

  it('maps Arial, Georgia, Verdana and Courier New to their stacks', () => {
    expect(getFontFamilyStack('Arial')).toBe(
      "Arial, Helvetica, 'Liberation Sans', Arimo, sans-serif",
    )
    expect(getFontFamilyStack('Georgia')).toBe(
      "Georgia, Gelasio, 'DejaVu Serif', serif",
    )
    expect(getFontFamilyStack('Verdana')).toBe(
      "Verdana, Geneva, 'DejaVu Sans', sans-serif",
    )
    expect(getFontFamilyStack('Courier New')).toBe(
      "'Courier New', Courier, 'Liberation Mono', Cousine, monospace",
    )
  })

  it('keeps system-ui first so platforms that support it look unchanged', () => {
    const stack = getFontFamilyStack('system-ui')
    expect(stack?.startsWith('system-ui, ')).toBe(true)
    expect(stack?.endsWith(', sans-serif')).toBe(true)
  })

  it('gives every font offered in the pickers a generic fallback', () => {
    for (const { value } of FONT_FAMILY_OPTIONS) {
      const families = getFontFamilyStack(value)?.split(', ') ?? []
      expect(families.length).toBeGreaterThan(2)
      expect(GENERIC_FAMILIES).toContain(families.at(-1))
    }
  })

  it('matches known fonts case-insensitively and ignores quotes and spaces', () => {
    expect(getFontFamilyStack("  'times new roman' ")).toBe(
      getFontFamilyStack('Times New Roman'),
    )
    expect(getFontFamilyStack('"ARIAL"')).toBe(getFontFamilyStack('Arial'))
  })

  it('quotes an unknown font and appends a generic family guessed from its name', () => {
    expect(getFontFamilyStack('Open Sans')).toBe("'Open Sans', sans-serif")
    expect(getFontFamilyStack('Roboto')).toBe('Roboto, sans-serif')
    expect(getFontFamilyStack('Noto Serif')).toBe("'Noto Serif', serif")
    expect(getFontFamilyStack('PT Sans Serif')).toBe(
      "'PT Sans Serif', sans-serif",
    )
    expect(getFontFamilyStack('Fira Code')).toBe("'Fira Code', monospace")
    expect(getFontFamilyStack("O'Brien Sans")).toBe(
      "'O\\'Brien Sans', sans-serif",
    )
  })

  it('leaves generic families and existing stacks unchanged', () => {
    expect(getFontFamilyStack('serif')).toBe('serif')
    expect(getFontFamilyStack('Monospace')).toBe('monospace')
    expect(getFontFamilyStack("'Foo', 'Bar', serif")).toBe(
      "'Foo', 'Bar', serif",
    )
  })

  it('returns undefined for a missing font so the text inherits its font', () => {
    expect(getFontFamilyStack(undefined)).toBeUndefined()
    expect(getFontFamilyStack(null)).toBeUndefined()
    expect(getFontFamilyStack('   ')).toBeUndefined()
    expect(getFontFamilyStack("''")).toBeUndefined()
  })
})
