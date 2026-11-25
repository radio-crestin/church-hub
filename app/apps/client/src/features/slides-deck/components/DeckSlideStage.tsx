import { DeckElementView } from './DeckElementView'
import { DeckSlideBackground } from './DeckSlideBackground'
import type { DeckSlide, DeckTargetState } from '../types'
import { RESTING_STATE } from '../utils/deckTargetStates'

interface DeckSlideStageProps {
  slide: DeckSlide
  /** The deck's design size, drawn `scale` times as large. */
  width: number
  height: number
  scale: number
  /** How its builds so far left each part; null draws it as designed. */
  states: Map<string, DeckTargetState> | null
  playMedia: boolean
  withSound: boolean
}

/** One slide laid out on its design size, scaled to the box it is drawn in. */
export function DeckSlideStage({
  slide,
  width,
  height,
  scale,
  states,
  playMedia,
  withSound,
}: DeckSlideStageProps) {
  return (
    <div
      className="absolute top-0 left-0 overflow-hidden"
      style={{
        width,
        height,
        transform: `scale(${scale})`,
        transformOrigin: '0 0',
      }}
    >
      <DeckSlideBackground
        background={slide.background}
        playMedia={playMedia}
      />
      {slide.elements.map((element) => (
        <DeckElementView
          key={element.id}
          element={element}
          state={states?.get(element.id) ?? RESTING_STATE}
          playMedia={playMedia}
          withSound={withSound}
        />
      ))}
    </div>
  )
}
