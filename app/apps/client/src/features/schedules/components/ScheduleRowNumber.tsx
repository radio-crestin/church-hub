interface ScheduleRowNumberProps {
  position: number
  isLive: boolean
}

/** A program row's place in the running order; red while it is on screen. */
export function ScheduleRowNumber({
  position,
  isLive,
}: ScheduleRowNumberProps) {
  return (
    <span
      className={`w-4 shrink-0 text-right text-xs tabular-nums ${
        isLive ? 'font-medium text-live' : 'text-fg-hint'
      }`}
    >
      {position}
    </span>
  )
}
