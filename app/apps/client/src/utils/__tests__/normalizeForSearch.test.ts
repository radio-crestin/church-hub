import { describe, expect, it } from 'vitest'

import { normalizeForSearch } from '../normalizeForSearch'

describe('normalizeForSearch', () => {
  it('folds Romanian diacritics onto their ASCII base', () => {
    expect(normalizeForSearch('Cântare')).toBe('cantare')
    expect(normalizeForSearch('Înălțare')).toBe('inaltare')
    expect(normalizeForSearch('Şi Ţie')).toBe('si tie')
  })

  it('matches both ways around', () => {
    const query = normalizeForSearch('cantare')
    expect(normalizeForSearch('O, ce cântare!').includes(query)).toBe(true)
    expect(normalizeForSearch('O, ce cantare!').includes(query)).toBe(true)
  })

  it('leaves plain text alone apart from casing', () => {
    expect(normalizeForSearch('Psalmi 23:1')).toBe('psalmi 23:1')
    expect(normalizeForSearch('')).toBe('')
  })
})
