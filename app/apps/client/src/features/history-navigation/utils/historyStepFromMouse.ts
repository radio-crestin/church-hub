import type { HistoryStep } from '../types'

/** The history step a mouse side button stands for: 3 back, 4 forward. */
export function historyStepFromMouse(event: MouseEvent): HistoryStep | null {
  if (event.button === 3) return 'back'
  if (event.button === 4) return 'forward'
  return null
}
