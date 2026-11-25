import type { Constraints, SizeWithUnits } from '../../../types'

/** An element's place, copied in the screen editor to paste on another one. */
export interface CopiedPosition {
  constraints: Constraints
  size: SizeWithUnits
  /** The screen it was copied on, so pixels can be scaled to another one */
  screenWidth: number
  screenHeight: number
}
