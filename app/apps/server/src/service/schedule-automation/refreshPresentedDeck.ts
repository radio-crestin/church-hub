import { buildScheduleSteps } from './buildScheduleSteps'
import { presentStepAt } from './presentStepAt'
import { createLogger } from '../../utils/logger'
import { getPresentationState } from '../presentation/presentation-state'
import { getScheduleById } from '../schedules/getSchedules'
import { deckSteps } from '../slides-deck/deckSteps'
import type { SlideDeck } from '../slides-deck/types'

const logger = createLogger('schedule-automation')

/**
 * After a Slides item's deck is saved: when one of its slides is on screen,
 * puts the same slide (found by its id) and click back up from the new deck,
 * so the displays show the edit at once. A slide that is gone leaves the
 * screen as it was; nothing happens while the presentation is hidden.
 */
export async function refreshPresentedDeck(
  scheduleId: number,
  itemId: number,
): Promise<void> {
  const { temporaryContent: live, isHidden } = getPresentationState()
  if (
    isHidden ||
    live?.type !== 'deck_slide' ||
    live.data.itemId !== itemId ||
    live.data.scheduleId !== scheduleId
  ) {
    return
  }
  const schedule = getScheduleById(scheduleId)
  if (!schedule) return
  const steps = buildScheduleSteps(schedule.items)
  const start = steps.findIndex((step) => step.item.id === itemId)
  const deck = steps[start]?.item.itemConfig as SlideDeck | undefined
  if (!deck) return
  const slideIndex = deck.slides.findIndex((s) => s.id === live.data.slide.id)
  if (slideIndex < 0) return
  const local = deckSteps(deck).findLastIndex(
    (step) =>
      step.slideIndex === slideIndex && step.buildIndex <= live.data.buildIndex,
  )
  logger.debug(`Deck item ${itemId} saved while on screen: step ${local}`)
  await presentStepAt(scheduleId, start + local)
}
