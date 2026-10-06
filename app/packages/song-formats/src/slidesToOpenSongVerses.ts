import { htmlToPlainText } from './htmlToPlainText'
import type { OpenSongVerse } from './writeOpenSongXml'

/** Labels OpenSong readers understand: V1, C, C2, B1, … */
const OPENSONG_LABEL = /^[A-Z]\d*$/

export interface SlideForOpenSong {
  content: string
  label: string | null
}

/**
 * Slides as OpenSong verses plus the presentation order that gives the
 * slides back exactly, in order: every slide gets a label OpenSong can read
 * (V1, V2, … for unlabelled ones), and two different slides never share
 * one. A slide repeated word for word (a chorus) is written once and listed
 * again in the order.
 */
export function slidesToOpenSongVerses(slides: SlideForOpenSong[]): {
  verses: OpenSongVerse[]
  presentation: string
} {
  const textByLabel = new Map<string, string>()
  const verses: OpenSongVerse[] = []
  const order: string[] = []
  let verseNumber = 0

  const freeLabel = (base: string): string => {
    if (!textByLabel.has(base)) return base
    const stem = base.replace(/\d+$/, '')
    let n = 2
    while (textByLabel.has(`${stem}${n}`)) n++
    return `${stem}${n}`
  }

  for (const slide of slides) {
    const text = htmlToPlainText(slide.content)
    if (!text) continue
    const own = slide.label?.trim().toUpperCase() ?? ''
    let label = OPENSONG_LABEL.test(own) ? own : `V${++verseNumber}`
    if (textByLabel.has(label) && textByLabel.get(label) !== text) {
      label = freeLabel(label)
    }
    if (!textByLabel.has(label)) {
      textByLabel.set(label, text)
      verses.push({ label, lines: text.split('\n') })
    }
    order.push(label)
  }

  return { verses, presentation: order.join(' ') }
}
