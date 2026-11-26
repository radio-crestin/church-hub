/** The LIVE chip: a red dot and label while what it stands for is on the screens. */
export function LiveBadge({ isLive }: { isLive: boolean }) {
  return (
    <div
      data-testid="live-badge"
      data-live={isLive}
      className="flex items-center gap-1.5 h-8 px-2 shrink-0"
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isLive ? 'bg-live' : 'bg-fg-hint'
        }`}
      />
      <span
        className={`text-xs font-medium ${
          isLive ? 'text-live' : 'text-fg-hint'
        }`}
      >
        LIVE
      </span>
    </div>
  )
}
