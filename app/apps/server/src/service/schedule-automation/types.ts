/** What the presentation runner is doing, as the API and WebSocket send it. */
export type ScheduleAutomationState =
  | { running: false }
  | {
      running: true
      scheduleId: number
      title: string
      /** Position of the step on screen in the presentation's running order. */
      stepIndex: number
      stepCount: number
      autoplaySeconds: number
      loop: boolean
      /** When the next step goes up (epoch ms). */
      nextStepAt: number
    }
