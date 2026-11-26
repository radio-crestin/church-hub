import type { ScheduleStep } from './buildScheduleSteps'
import {
  type MidiAudioPosition,
  slideAtTime,
  verseStartTimes,
} from '../midi-audio'

function itemStepCount(steps: ScheduleStep[], step: ScheduleStep): number {
  return steps.filter((s) => s.item.id === step.item.id).length
}

/** When each slide of the step's item starts in its MIDI audio. */
export function midiStepTimes(
  steps: ScheduleStep[],
  step: ScheduleStep,
): number[] {
  const midi = step.item.midi
  if (!midi) return []
  return verseStartTimes(
    itemStepCount(steps, step),
    midi.durationSeconds,
    midi.verseTimes,
  )
}

/**
 * The step a MIDI item's music has reached: the slide whose time has come,
 * or the step after the item once the music is over. Null while the slide
 * on screen is still the right one (or the music is paused).
 */
export function nextMidiStep(
  steps: ScheduleStep[],
  stepIndex: number,
  position: MidiAudioPosition,
): number | null {
  const step = steps[stepIndex]
  const midi = step?.item.midi
  if (!step || !midi || position.state === 'paused') return null
  if (position.state === 'gone' || position.seconds >= midi.durationSeconds) {
    return stepIndex - step.index + itemStepCount(steps, step)
  }
  const slide = slideAtTime(midiStepTimes(steps, step), position.seconds)
  return slide > step.index ? stepIndex + slide - step.index : null
}
