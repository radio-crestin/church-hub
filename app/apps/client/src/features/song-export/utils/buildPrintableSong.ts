import type { SongWithSlides } from '~/features/songs/types'
import { htmlToPlainText } from './htmlToPlainText'

export interface PrintableSection {
  label: string | null
  lines: string[]
}

export interface PrintableSong {
  title: string
  details: string
  sections: PrintableSection[]
}

/**
 * Reduces a song to what a printed sheet needs: the title, one details line
 * and each section once, in song order. Shared by the PDF and Word exports so
 * both print the same layout.
 */
export function buildPrintableSong(song: SongWithSlides): PrintableSong {
  const sections = [...song.slides]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((slide) => ({
      label: slide.label,
      lines: htmlToPlainText(slide.content).split('\n'),
    }))
    .filter((section) => section.lines.some((line) => line.trim() !== ''))

  const details = [song.author, song.keyLine].filter(Boolean).join(' · ')

  return { title: song.title, details, sections }
}
