import { describe, expect, it } from 'vitest'

import type { DiscoveryCandidate } from '../../types'
import { alternateTitleEntries } from '../alternateTitleEntries'

function candidate(
  sourceFilename: string | null,
  title: string,
): DiscoveryCandidate {
  return {
    tempId: sourceFilename ?? title,
    sourceFilename,
    sourceFormat: 'opensong',
    parsed: { title, slides: [] } as unknown as DiscoveryCandidate['parsed'],
  }
}

describe('alternateTitleEntries', () => {
  it('pairs each catalogue title with the file it came from', () => {
    expect(
      alternateTitleEntries([
        candidate('zece-mii.xml', 'Zece mii de motive'),
        candidate('alta.xml', 'Alt cântec'),
      ]),
    ).toEqual([
      { sourceFilename: 'zece-mii.xml', titles: ['Zece mii de motive'] },
      { sourceFilename: 'alta.xml', titles: ['Alt cântec'] },
    ])
  })

  it('leaves out a candidate with no file to match on', () => {
    // Without a filename there is no link back to a song in the library.
    expect(alternateTitleEntries([candidate(null, 'Fără fișier')])).toEqual([])
  })

  it('leaves out a candidate the source never named', () => {
    expect(alternateTitleEntries([candidate('gol.xml', '   ')])).toEqual([])
  })

  it('trims what the file had around the name', () => {
    expect(
      alternateTitleEntries([candidate('  a.xml  ', '  Zece mii  ')]),
    ).toEqual([{ sourceFilename: 'a.xml', titles: ['Zece mii'] }])
  })

  it('has nothing to send for an empty catalogue', () => {
    expect(alternateTitleEntries([])).toEqual([])
  })
})
