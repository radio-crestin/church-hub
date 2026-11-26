import { DeckImage } from './DeckImage'
import { DeckVideo } from './DeckVideo'
import type { DeckBackground } from '../types'

/** A slide with no background of its own is black, like the screens. */
const DEFAULT_COLOR = '#000000'

interface DeckSlideBackgroundProps {
  background: DeckBackground | undefined
  playMedia: boolean
}

/** A slide's background: a colour, a picture or a looping silent video. */
export function DeckSlideBackground({
  background,
  playMedia,
}: DeckSlideBackgroundProps) {
  const color = background?.type === 'color' ? background.color : DEFAULT_COLOR
  return (
    <div className="absolute inset-0" style={{ backgroundColor: color }}>
      {background?.type === 'image' && (
        <DeckImage
          mediaId={background.mediaId}
          fit={background.fit ?? 'cover'}
        />
      )}
      {background?.type === 'video' && (
        <DeckVideo
          mediaId={background.mediaId}
          play={playMedia}
          loop
          withSound={false}
          fit={background.fit ?? 'cover'}
        />
      )}
    </div>
  )
}
