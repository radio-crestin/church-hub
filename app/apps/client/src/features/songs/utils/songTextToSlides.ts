import { normalizeText } from '~/features/presentation/components/rendering/utils/normalizeText'
import { matchEditedBlocks } from './matchEditedBlocks'
import { remapStyleRanges } from './remapStyleRanges'
import { slideToTextBlock } from './slideToTextBlock'
import { splitSongText } from './splitSongText'
import { textBlockToSlide } from './textBlockToSlide'
import type { LocalSlide } from '../types'

let nextTempId = 0

/**
 * The song's text back to slides, keeping what the text does not show.
 *
 * A block written exactly as one of the previous slides is that slide,
 * untouched: its id, notes and styling stay, so a save rewrites nothing that
 * was not edited. Between two such unchanged slides, an edited block takes over
 * the previous slide it reads most like (see `matchEditedBlocks`), with its id,
 * notes and styling moved onto the new words. Anything else is a new slide.
 */
export function songTextToSlides(
  text: string,
  previous: LocalSlide[],
): LocalSlide[] {
  const blocks = splitSongText(text)
  const previousBlocks = previous.map(slideToTextBlock)

  // Unchanged slides, in order, anchor the rest.
  const sourceOf = new Array<number | null>(blocks.length).fill(null)
  const anchors: Array<{ block: number; slide: number }> = []
  let from = 0
  blocks.forEach((block, index) => {
    const match = previousBlocks.indexOf(block, from)
    if (match < 0) return
    sourceOf[index] = match
    anchors.push({ block: index, slide: match })
    from = match + 1
  })

  // Each stretch between two anchors pairs its edited blocks with its
  // previous slides.
  let previousAnchor = { block: -1, slide: -1 }
  for (const anchor of [
    ...anchors,
    { block: blocks.length, slide: previous.length },
  ]) {
    const newIndexes = range(previousAnchor.block + 1, anchor.block)
    const oldIndexes = range(previousAnchor.slide + 1, anchor.slide)
    const pairs = matchEditedBlocks(
      newIndexes.map((i) => blocks[i]),
      oldIndexes.map((i) => previousBlocks[i]),
    )
    pairs.forEach((old, k) => {
      if (old !== null) sourceOf[newIndexes[k]] = oldIndexes[old]
    })
    previousAnchor = anchor
  }

  return blocks.map((block, index): LocalSlide => {
    const source = sourceOf[index]
    const original = source === null ? undefined : previous[source]
    if (original && previousBlocks[source as number] === block) {
      return { ...original, sortOrder: index }
    }
    const parsed = textBlockToSlide(block)
    if (original) {
      return {
        ...original,
        ...parsed,
        sortOrder: index,
        styleOverrides: remapStyles(original, parsed.content),
      }
    }
    nextTempId += 1
    return { id: `temp-text-${nextTempId}`, ...parsed, sortOrder: index }
  })
}

function range(start: number, end: number): number[] {
  return Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i)
}

function remapStyles(
  slide: LocalSlide,
  content: string,
): LocalSlide['styleOverrides'] {
  const override = slide.styleOverrides
  if (!override?.ranges?.length) return override ?? null
  return {
    ...override,
    ranges: remapStyleRanges(
      override.ranges,
      normalizeText(slide.content, true),
      normalizeText(content, true),
    ),
  }
}
