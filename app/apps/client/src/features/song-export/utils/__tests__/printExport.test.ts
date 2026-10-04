import { describe, expect, it } from 'vitest'

import type { SongWithSlides } from '~/features/songs/types'
import { buildPrintableSong } from '../buildPrintableSong'
import { generateDocx } from '../generateDocx'
import { generatePdf } from '../generatePdf'

function makeSong(): SongWithSlides {
  return {
    id: 1,
    title: 'Măreț ești, Doamne',
    author: 'Ion Popescu',
    keyLine: 'G',
    slides: [
      { id: 2, sortOrder: 2, label: 'C1', content: '<p>Aleluia, Aleluia</p>' },
      {
        id: 1,
        sortOrder: 1,
        label: 'V1',
        content: '<p>Prima linie<br>A doua &amp; linie</p>',
      },
      { id: 3, sortOrder: 3, label: 'V2', content: '<p></p>' },
    ],
  } as unknown as SongWithSlides
}

describe('song-export print layout', () => {
  it('orders sections, decodes text and drops empty ones', () => {
    const printable = buildPrintableSong(makeSong())

    expect(printable.title).toBe('Măreț ești, Doamne')
    expect(printable.details).toBe('Ion Popescu · G')
    expect(printable.sections).toEqual([
      { label: 'V1', lines: ['Prima linie', 'A doua & linie'] },
      { label: 'C1', lines: ['Aleluia, Aleluia'] },
    ])
  })

  it('generates a PDF file', async () => {
    const bytes = await generatePdf(makeSong())
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
  })

  it('generates a Word file', async () => {
    const bytes = await generateDocx(makeSong())
    expect(new TextDecoder().decode(bytes.slice(0, 2))).toBe('PK')
  })
})
