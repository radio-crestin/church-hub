interface MonitorBadgeProps {
  /** The monitor's place in the list the screen settings show. */
  number: number
}

/**
 * The whole of a badge window: a black plate with the monitor's number on it.
 *
 * Its own window is the plate, so this only has to fill it — no chrome, no
 * providers, nothing that reaches for the app's data.
 */
export function MonitorBadge({ number }: MonitorBadgeProps) {
  return (
    <div className="w-screen h-screen flex items-center justify-center bg-black select-none">
      <span className="text-white font-semibold leading-none text-[7rem]">
        {number}
      </span>
    </div>
  )
}
