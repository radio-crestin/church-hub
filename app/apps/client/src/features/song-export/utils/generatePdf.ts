import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces'

import type { SongWithSlides } from '~/features/songs/types'
import { buildPrintableSong, type PrintableSection } from './buildPrintableSong'

const PAGE_MARGINS: [number, number, number, number] = [56, 56, 56, 56]

function sectionContent(section: PrintableSection): Content {
  return {
    unbreakable: true,
    margin: [0, 0, 0, 14],
    stack: [
      ...(section.label
        ? [{ text: section.label, style: 'label' } as Content]
        : []),
      { text: section.lines.join('\n'), style: 'lyrics' },
    ],
  }
}

function buildDocDefinition(song: SongWithSlides): TDocumentDefinitions {
  const printable = buildPrintableSong(song)

  return {
    info: { title: printable.title, author: 'Church Hub' },
    pageSize: 'A4',
    pageMargins: PAGE_MARGINS,
    defaultStyle: { font: 'Roboto', fontSize: 13, lineHeight: 1.25 },
    styles: {
      title: { fontSize: 24, bold: true },
      details: { fontSize: 11, color: '#555555' },
      label: {
        fontSize: 10,
        bold: true,
        color: '#555555',
        margin: [0, 0, 0, 2],
      },
      lyrics: { fontSize: 13 },
    },
    content: [
      { text: printable.title, style: 'title', margin: [0, 0, 0, 4] },
      ...(printable.details
        ? [{ text: printable.details, style: 'details' } as Content]
        : []),
      { text: '', margin: [0, 0, 0, 18] },
      ...printable.sections.map(sectionContent),
    ],
  }
}

/**
 * Generates a printable A4 PDF of the song: title, then each section label
 * and its lyrics. The font ships inside the bundle, so it needs no system
 * fonts and renders Romanian diacritics the same on every OS.
 */
export async function generatePdf(song: SongWithSlides): Promise<Uint8Array> {
  const [{ default: pdfMake }, { default: vfs }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ])
  pdfMake.addVirtualFileSystem(vfs)

  return new Uint8Array(
    await pdfMake.createPdf(buildDocDefinition(song)).getBuffer(),
  )
}
