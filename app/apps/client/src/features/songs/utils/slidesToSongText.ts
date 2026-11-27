import { slideToTextBlock } from './slideToTextBlock'
import type { LocalSlide } from '../types'

/** The whole song as one text: its slides' blocks, a blank line between them. */
export function slidesToSongText(slides: LocalSlide[]): string {
  return slides.map(slideToTextBlock).join('\n\n')
}
