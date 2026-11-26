import { DeckElementBody } from './DeckElementBody'
import { deckTransform } from '../animations/deckTransform'
import type { DeckElement, DeckTargetState } from '../types'

interface DeckElementViewProps {
  element: DeckElement
  /** How its effects left it; resting as designed when it has none. */
  state: DeckTargetState
  playMedia: boolean
  withSound: boolean
}

/**
 * An element at its place on the slide (design pixels, rotation, opacity),
 * with an inner body its animations move (`data-deck-target`), drawn as the
 * builds so far left it.
 */
export function DeckElementView({
  element,
  state,
  playMedia,
  withSound,
}: DeckElementViewProps) {
  return (
    <div
      data-testid="deck-element"
      data-element-id={element.id}
      data-visible={state.visible}
      className="absolute"
      style={{
        left: element.x,
        top: element.y,
        width: element.w,
        height: element.h,
        transform: element.rotation
          ? `rotate(${element.rotation}deg)`
          : undefined,
        opacity: element.opacity,
      }}
    >
      <div
        data-deck-target={element.id}
        className="h-full w-full"
        style={{
          visibility: state.visible ? 'visible' : 'hidden',
          opacity: state.opacity,
          transform: deckTransform(0, 0, state.scale, 0),
        }}
      >
        <DeckElementBody
          element={element}
          playMedia={playMedia}
          withSound={withSound}
        />
      </div>
    </div>
  )
}
