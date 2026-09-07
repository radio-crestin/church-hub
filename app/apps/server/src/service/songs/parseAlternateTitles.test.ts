import { joinSearchTitles, parseAlternateTitles } from './parseAlternateTitles'
import { serializeAlternateTitles } from './serializeAlternateTitles'
import { describe, expect, it } from 'bun:test'

describe('parseAlternateTitles', () => {
  it('reads the stored names back', () => {
    expect(parseAlternateTitles('["Zece mii de motive"]')).toEqual([
      'Zece mii de motive',
    ])
  })

  it('treats an absent column as no other names', () => {
    expect(parseAlternateTitles(null)).toEqual([])
    expect(parseAlternateTitles(undefined)).toEqual([])
    expect(parseAlternateTitles('')).toEqual([])
  })

  it('reads a corrupt row as no names rather than throwing', () => {
    // A bad row must not take the whole search index down with it.
    expect(parseAlternateTitles('{"not":"an array"}')).toEqual([])
    expect(parseAlternateTitles('["unterminated')).toEqual([])
    expect(parseAlternateTitles('[1, 2, 3]')).toEqual([])
  })

  it('drops blank entries and trims the rest', () => {
    expect(parseAlternateTitles('["  Zece mii  ", "", "   "]')).toEqual([
      'Zece mii',
    ])
  })
})

describe('serializeAlternateTitles', () => {
  it('stores nothing when there is nothing worth storing', () => {
    expect(serializeAlternateTitles(null)).toBeNull()
    expect(serializeAlternateTitles([])).toBeNull()
    expect(serializeAlternateTitles(['', '  '])).toBeNull()
  })

  it('drops repeats, whatever case they were typed in', () => {
    expect(serializeAlternateTitles(['Zece mii', 'zece MII', 'Alt nume'])).toBe(
      '["Zece mii","Alt nume"]',
    )
  })

  it('round-trips through the parser', () => {
    const titles = ['Zece mii de motive', 'Binecuvântează suflete']
    expect(parseAlternateTitles(serializeAlternateTitles(titles))).toEqual(
      titles,
    )
  })
})

describe('joinSearchTitles', () => {
  it('indexes the title on its own when there is nothing else', () => {
    expect(joinSearchTitles('E o nouă zi', null)).toBe('E o nouă zi')
  })

  it('indexes every name the song goes by', () => {
    expect(
      joinSearchTitles('E o nouă zi, soarele răsare', '["Zece mii de motive"]'),
    ).toBe('E o nouă zi, soarele răsare Zece mii de motive')
  })

  it('never indexes the same name twice', () => {
    // A song whose alternate title equals its title would otherwise weight
    // the index towards itself.
    expect(joinSearchTitles('Zece mii', '["zece MII"]')).toBe('Zece mii')
  })
})
