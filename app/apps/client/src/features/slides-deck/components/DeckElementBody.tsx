import { DeckImage } from './DeckImage'
import { DeckShape } from './DeckShape'
import { DeckTextBox } from './DeckTextBox'
import { DeckVideo } from './DeckVideo'
import type { DeckElement } from '../types'

interface DeckElementBodyProps {
  element: DeckElement
  playMedia: boolean
  withSound: boolean
}

/** What an element draws, by its type. */
export function DeckElementBody({
  element,
  playMedia,
  withSound,
}: DeckElementBodyProps) {
  switch (element.type) {
    case 'text':
      return <DeckTextBox element={element} />
    case 'image':
      return (
        <DeckImage
          mediaId={element.mediaId}
          fit={element.fit ?? 'contain'}
          crop={element.crop}
        />
      )
    case 'picture_fallback':
      return <DeckImage mediaId={element.mediaId} fit="fill" />
    case 'video':
      return (
        <DeckVideo
          mediaId={element.mediaId}
          posterMediaId={element.posterMediaId}
          play={playMedia && element.autoplay !== false}
          loop={element.loop === true}
          withSound={withSound && element.muted !== true}
          volume={element.volume}
          fit="contain"
        />
      )
    case 'shape':
      return <DeckShape element={element} />
  }
}
