import type { DeckTrigger } from '../../types'

/** One effect of a slide's main sequence, as PowerPoint times it. */
export interface PptxTimedEffect {
  /** The shape it moves (`p:spTgt spid`). */
  spid: string
  /** A by-paragraph build's paragraph (`p:txEl/p:pRg st`). */
  paragraphIndex?: number
  /** It moves only the shape's background (`p:bg`), not its text. */
  background: boolean
  /** `entr`, `exit`, `emph`, `path`, `mediacall`… */
  presetClass: string
  presetId: number
  presetSubtype: number
  /** A media call's command (`playFrom(0.0)`, `pause`…). */
  command?: string
  trigger: DeckTrigger
  delayMs: number
  durationMs: number
  /** 0: plays as the slide comes in; then each click's number. */
  clickGroup: number
}

/** A slide's timing tree read: its effects in play order, media settings, triggered effects. */
export interface PptxTiming {
  effects: PptxTimedEffect[]
  /** Shape id → its video's or sound's volume (0–1) and mute. */
  media: Map<string, { volume?: number; muted?: boolean }>
  /** Effects started by clicking a shape (`interactiveSeq`), which the deck has not. */
  interactive: number
}
