/** The LIVE chip: red and pulsing while what it stands for is on the screens. */
export function LiveBadge({ isLive }: { isLive: boolean }) {
  return (
    <div
      data-testid="live-badge"
      data-live={isLive}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md shrink-0 ${
        isLive
          ? 'bg-red-100 dark:bg-red-900/30'
          : 'bg-gray-100 dark:bg-gray-700'
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          isLive ? 'bg-red-500 animate-pulse' : 'bg-gray-400 dark:bg-gray-500'
        }`}
      />
      <span
        className={`text-xs font-semibold ${
          isLive
            ? 'text-red-600 dark:text-red-400'
            : 'text-gray-400 dark:text-gray-500'
        }`}
      >
        LIVE
      </span>
    </div>
  )
}
