import { buildScheduleSteps, type ScheduleStep } from './buildScheduleSteps'
import { presentScheduleStep } from './presentScheduleStep'
import { stepSeconds } from './stepSeconds'
import type { ScheduleAutomationState } from './types'
import { createLogger } from '../../utils/logger'
import {
  broadcastPresentationState,
  broadcastScheduleAutomation,
} from '../../websocket'
import { executeCommand, isPlayerAvailable } from '../music-player'
import {
  clearTemporaryContent,
  getPresentationState,
} from '../presentation/presentation-state'
import { getScheduleById } from '../schedules/getSchedules'
import { endScreenShareSession } from '../screen-share/session'

const logger = createLogger('schedule-automation')

/** How often the runner checks whether the next step is due. */
const TICK_MS = 250

let state: ScheduleAutomationState = { running: false }
let timer: ReturnType<typeof setInterval> | null = null
/** A step being put up; ticks wait for it instead of piling up. */
let busy = false

export function getScheduleAutomationState(): ScheduleAutomationState {
  return state
}

function setState(next: ScheduleAutomationState) {
  state = next
  broadcastScheduleAutomation(state)
}

/** The presentation step on the projector right now, if one is. */
function liveStep(): { scheduleId?: number; stepIndex?: number } {
  const data = getPresentationState().temporaryContent?.data
  if (!data || !('scheduleId' in data)) return {}
  return { scheduleId: data.scheduleId, stepIndex: data.scheduleItemIndex }
}

/** The presentation on the projector right now, running or not. */
export function liveScheduleId(): number | undefined {
  return state.running ? state.scheduleId : liveStep().scheduleId
}

function stopTimer() {
  if (timer) clearInterval(timer)
  timer = null
}

/**
 * Stops the run. `clear` also takes its content off the screens (Stop, or the
 * end of a run that does not loop); an operator taking over leaves theirs up.
 */
export function stopScheduleAutomation(
  reason: string,
  { clear }: { clear: boolean },
): ScheduleAutomationState {
  stopTimer()
  if (!state.running) return state
  logger.info(`Presentation ${state.scheduleId} stopped: ${reason}`)
  if (clear && liveStep().scheduleId === state.scheduleId) {
    broadcastPresentationState(clearTemporaryContent())
  }
  setState({ running: false })
  return state
}

/**
 * Takes a presentation off: stops its run, or, one shown without autoplay,
 * clears its step from the screens.
 */
export function stopSchedule(scheduleId: number, reason: string): void {
  if (state.running && state.scheduleId === scheduleId) {
    stopScheduleAutomation(reason, { clear: true })
  } else if (liveStep().scheduleId === scheduleId) {
    logger.info(`Presentation ${scheduleId} taken off: ${reason}`)
    broadcastPresentationState(clearTemporaryContent())
  }
}

async function setMusicVolume(volume: number | null) {
  if (volume === null || !isPlayerAvailable()) return
  try {
    await executeCommand({ type: 'volume', level: volume })
  } catch (error) {
    logger.warning(`Could not set the music volume: ${error}`)
  }
}

/**
 * Starts a presentation from its first step. With autoplay on, the server
 * then moves it on by itself, each step after its own time (`stepSeconds`),
 * whether or not a page is
 * open, until it is stopped, an operator presents something else (which takes
 * it over), or it ends. With autoplay off this only puts its first step up.
 */
export async function startScheduleAutomation(
  scheduleId: number,
): Promise<ScheduleAutomationState> {
  const schedule = getScheduleById(scheduleId)
  if (!schedule) throw new Error(`Presentation ${scheduleId} not found`)
  const steps = buildScheduleSteps(schedule.items)
  const [firstStep] = steps
  if (!firstStep) {
    throw new Error(`Presentation ${scheduleId} has nothing to show`)
  }

  stopScheduleAutomation('another presentation started', { clear: false })
  endScreenShareSession()
  await setMusicVolume(schedule.automation.musicVolume)
  broadcastPresentationState(
    await presentScheduleStep(scheduleId, schedule.items, firstStep, 0),
  )

  const { autoplaySeconds, loop } = schedule.automation
  if (!autoplaySeconds) return state

  const seconds = stepSeconds(firstStep, {
    ...schedule.automation,
    autoplaySeconds,
  })
  logger.info(
    `Presentation ${scheduleId} running: ${steps.length} steps, at least ${autoplaySeconds}s each${loop ? ', in a loop' : ''}`,
  )
  setState({
    running: true,
    scheduleId,
    title: schedule.title,
    stepIndex: 0,
    stepCount: steps.length,
    stepSeconds: seconds,
    loop,
    nextStepAt: Date.now() + seconds * 1000,
  })
  timer = setInterval(() => {
    tick().catch((error) => {
      logger.error(`Presentation step failed: ${error}`)
      stopScheduleAutomation('a step failed', { clear: false })
    })
  }, TICK_MS)
  return state
}

async function tick() {
  if (!state.running || busy) return
  const run = state

  const live = liveStep()
  if (live.scheduleId !== run.scheduleId || live.stepIndex !== run.stepIndex) {
    stopScheduleAutomation('an operator took over', { clear: false })
    return
  }
  if (Date.now() < run.nextStepAt) return

  busy = true
  try {
    // Read again each step: an edit made while it runs is picked up.
    const schedule = getScheduleById(run.scheduleId)
    const steps = schedule ? buildScheduleSteps(schedule.items) : []
    if (!schedule || steps.length === 0) {
      stopScheduleAutomation('the presentation is gone or empty', {
        clear: true,
      })
      return
    }

    let stepIndex = run.stepIndex + 1
    if (stepIndex >= steps.length) {
      if (!schedule.automation.loop) {
        stopScheduleAutomation('it reached the end', { clear: true })
        return
      }
      stepIndex = 0
    }
    const step = steps[stepIndex] as ScheduleStep

    // Autoplay turned off while it runs: finish with the last time it had.
    const seconds = stepSeconds(step, {
      ...schedule.automation,
      autoplaySeconds: schedule.automation.autoplaySeconds ?? run.stepSeconds,
    })
    broadcastPresentationState(
      await presentScheduleStep(
        run.scheduleId,
        schedule.items,
        step,
        stepIndex,
      ),
    )
    // Stopped while the step went up: stay stopped.
    if (!state.running || state.scheduleId !== run.scheduleId) return
    setState({
      ...run,
      title: schedule.title,
      stepIndex,
      stepCount: steps.length,
      stepSeconds: seconds,
      loop: schedule.automation.loop,
      nextStepAt: Date.now() + seconds * 1000,
    })
  } finally {
    busy = false
  }
}
