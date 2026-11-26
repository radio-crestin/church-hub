import { DeckSlideStage } from './DeckSlideStage'
import type { DeckSlide } from '../types'

interface DeckSlideThumbnailProps {
  slide: DeckSlide
  /** The deck's design size. */
  width: number
  height: number
  /** Drawn this wide; its height keeps the deck's shape. */
  boxWidth: number
}

/** A slide drawn small as designed, everything shown, nothing playing. */
export function DeckSlideThumbnail({
  slide,
  width,
  height,
  boxWidth,
}: DeckSlideThumbnailProps) {
  const scale = boxWidth / width
  return (
    <span
      className="relative block shrink-0 overflow-hidden rounded bg-black"
      style={{ width: boxWidth, height: height * scale }}
      aria-hidden
    >
      <DeckSlideStage
        slide={slide}
        width={width}
        height={height}
        scale={scale}
        states={null}
        playMedia={false}
        withSound={false}
      />
    </span>
  )
}
