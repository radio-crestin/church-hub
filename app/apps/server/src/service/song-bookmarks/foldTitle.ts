import { foldText } from '../songs/text/foldText'

/** A title as a person would match it: case, diacritics and punctuation gone. */
export function foldTitle(title: string): string {
  return foldText(title, { dropJoiners: true })
    .folded.replace(/\s+/g, ' ')
    .trim()
}
