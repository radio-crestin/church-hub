import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx'

import type { SongWithSlides } from '~/features/songs/types'
import { buildPrintableSong, type PrintableSection } from './buildPrintableSong'

const A4_PAGE = {
  size: { width: 11906, height: 16838 }, // twips
  margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
}

const FONT = 'Calibri'
const GREY = '555555'
const HALF_POINTS = 2 // docx font sizes are in half-points

function titleParagraph(title: string): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: title, bold: true, size: 48, font: FONT })],
  })
}

function detailsParagraph(details: string): Paragraph {
  return new Paragraph({
    spacing: { after: 360 },
    children: [
      new TextRun({
        text: details,
        size: 11 * HALF_POINTS,
        color: GREY,
        font: FONT,
      }),
    ],
  })
}

function sectionParagraphs(section: PrintableSection): Paragraph[] {
  const label = section.label
    ? [
        new Paragraph({
          keepNext: true,
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: section.label,
              bold: true,
              size: 10 * HALF_POINTS,
              color: GREY,
              font: FONT,
            }),
          ],
        }),
      ]
    : []

  const lyrics = new Paragraph({
    keepLines: true,
    spacing: { after: 280, line: 300 },
    alignment: AlignmentType.LEFT,
    children: section.lines.map(
      (line, index) =>
        new TextRun({
          text: line,
          size: 13 * HALF_POINTS,
          font: FONT,
          break: index === 0 ? undefined : 1,
        }),
    ),
  })

  return [...label, lyrics]
}

/**
 * Generates an editable A4 Word document of the song: title, then each
 * section label and its lyrics.
 */
export async function generateDocx(song: SongWithSlides): Promise<Uint8Array> {
  const printable = buildPrintableSong(song)

  const document = new Document({
    creator: 'Church Hub',
    title: printable.title,
    sections: [
      {
        properties: { page: A4_PAGE },
        children: [
          titleParagraph(printable.title),
          ...(printable.details ? [detailsParagraph(printable.details)] : []),
          ...printable.sections.flatMap(sectionParagraphs),
        ],
      },
    ],
  })

  return new Uint8Array(await Packer.toArrayBuffer(document))
}
