import { describe, expect, test } from 'bun:test'
import { decodeHtmlEntities } from '../decodeHtmlEntities'
import { elisionVariants } from '../elisionVariants'
import { findHighlightRanges, wrapRanges } from '../findHighlightRanges'
import { foldText } from '../foldText'
import { joinedWordVariants } from '../joinedWordVariants'

describe('decodeHtmlEntities', () => {
  test('decodes the entities slide content is stored with', () => {
    expect(
      decodeHtmlEntities('Vin&#039; la Isus &amp; cântă &quot;da&quot;'),
    ).toBe('Vin\' la Isus & cântă "da"')
    expect(decodeHtmlEntities('a&#x27;b &nbsp;c')).toBe("a'b  c")
  })
})

describe('joinedWordVariants', () => {
  test('joins a hyphen or apostrophe word, with and without the elided î', () => {
    expect(joinedWordVariants('ne-ncetat')).toEqual(['nencetat', 'neincetat'])
    expect(joinedWordVariants("ne'ncetat")).toEqual(['nencetat', 'neincetat'])
    expect(joinedWordVariants('ne’ncetat')).toEqual(['nencetat', 'neincetat'])
    expect(joinedWordVariants('sa-nfaptuiesc')).toEqual([
      'sanfaptuiesc',
      'sainfaptuiesc',
    ])
    expect(joinedWordVariants('te-asteptam')).toEqual(['teasteptam'])
    expect(joinedWordVariants('s-o-nvat')).toEqual(['sonvat', 'soinvat'])
  })

  test('ignores plain words, trailing punctuation and clitic contractions', () => {
    expect(joinedWordVariants('isus')).toEqual([])
    expect(joinedWordVariants('ne-ncetat,')).toEqual(['nencetat', 'neincetat'])
    expect(joinedWordVariants('m-a')).toEqual([])
    expect(joinedWordVariants('s-a')).toEqual([])
    expect(joinedWordVariants('n-am')).toEqual([])
    expect(joinedWordVariants('a-b.c')).toEqual([])
  })
})

describe('elisionVariants', () => {
  test('drops the î a clitic elides, or puts it back', () => {
    expect(elisionVariants('neincetat')).toEqual(['nencetat'])
    expect(elisionVariants('sainfaptuiesc')).toEqual(['sanfaptuiesc'])
    expect(elisionVariants('teinconjoara')).toEqual(['tenconjoara'])
    expect(elisionVariants('nencetat')).toEqual(['neincetat'])
    expect(elisionVariants('sanfaptuiesc')).toEqual(['sainfaptuiesc'])
  })

  test('leaves ordinary words alone', () => {
    expect(elisionVariants('inima')).toEqual([])
    expect(elisionVariants('cainta')).toEqual([])
    expect(elisionVariants('painea')).toEqual([])
    expect(elisionVariants('sfinte')).toEqual([])
    expect(elisionVariants('cuvinte')).toEqual([])
    expect(elisionVariants('pentru')).toEqual([])
    expect(elisionVariants('tine')).toEqual([])
    expect(elisionVariants('binecuvantare')).toEqual([])
  })
})

describe('foldText', () => {
  test('folds diacritics, entities and punctuation, mapping back to the original', () => {
    const text = 'Închină–te Lui &#039;ici, pe pământ'
    const dropped = foldText(text, { dropJoiners: true })
    expect(dropped.folded).toBe('inchinate lui ici pe pamant')
    const kept = foldText(text, { dropJoiners: false })
    expect(kept.folded).toBe('inchina–te lui ici pe pamant')

    // "inchinate" spans the original "Închină–te", dash included.
    const pos = dropped.folded.indexOf('inchinate')
    expect(text.slice(dropped.starts[pos], dropped.ends[pos + 8])).toBe(
      'Închină–te',
    )
  })

  test('a joiner between letters folds away; elsewhere it separates', () => {
    expect(foldText('ne&#039;ncetat', { dropJoiners: true }).folded).toBe(
      'nencetat',
    )
    expect(foldText("- ne'ncetat -", { dropJoiners: true }).folded).toBe(
      'nencetat',
    )
  })
})

describe('findHighlightRanges — one word, every spelling', () => {
  const mark = (text: string, terms: string[], rawQuery: string) =>
    wrapRanges(text, findHighlightRanges(text, terms, { rawQuery }))

  test('"ne-ncetat" typed marks the whole word however it is written', () => {
    const terms = ['ne', 'ncetat']
    expect(mark('Doamne ne-ncetat Te lăudăm', terms, 'ne-ncetat')).toBe(
      'Doamne <mark>ne-ncetat</mark> Te lăudăm',
    )
    expect(mark("Isuse, ne'ncetat privirea", terms, 'ne-ncetat')).toBe(
      "Isuse, <mark>ne'ncetat</mark> privirea",
    )
    expect(mark('Isuse, ne&#039;ncetat privirea', terms, 'ne-ncetat')).toBe(
      'Isuse, <mark>ne&#039;ncetat</mark> privirea',
    )
    expect(mark('Spune-ți nencetat la toți', terms, 'ne-ncetat')).toBe(
      'Spune-ți <mark>nencetat</mark> la toți',
    )
    expect(mark('Te lăudăm neîncetat', terms, 'ne-ncetat')).toBe(
      'Te lăudăm <mark>neîncetat</mark>',
    )
  })

  test('"neîncetat" typed lights up the hyphenated spelling too', () => {
    expect(mark('Doamne ne-ncetat Te lăudăm', ['neincetat'], 'neîncetat')).toBe(
      'Doamne <mark>ne-ncetat</mark> Te lăudăm',
    )
    expect(mark('Spune-ți nencetat la toți', ['neincetat'], 'neincetat')).toBe(
      'Spune-ți <mark>nencetat</mark> la toți',
    )
  })

  test('a phrase with a hyphen word marks the phrase, sign included', () => {
    expect(
      mark(
        'Te lăudăm neîncetat',
        ['laudam', 'ne', 'ncetat'],
        'laudam ne-ncetat',
      ),
    ).toBe('Te <mark>lăudăm neîncetat</mark>')
    expect(
      mark('Sa ne speli de-orice pacat', ['de', 'orice'], 'de orice'),
    ).toBe('Sa ne speli <mark>de-orice</mark> pacat')
  })

  test('a hyphen word also lights up its two-word spelling with the î kept', () => {
    expect(
      mark('Numai bine să înfăptuiesc', ['sa', 'nfaptuiesc'], 'sa-nfaptuiesc'),
    ).toBe('Numai bine <mark>să înfăptuiesc</mark>')
  })

  test('partial typing of a hyphen word still marks from the start of the word', () => {
    expect(mark('Te lăudăm neîncetat', ['ne', 'nc'], 'ne-nc')).toBe(
      'Te lăudăm <mark>neînc</mark>etat',
    )
  })
})
