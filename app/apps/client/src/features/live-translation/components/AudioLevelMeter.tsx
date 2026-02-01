interface AudioLevelMeterProps {
  level: number
  label: string
  color: 'blue' | 'green'
}

export function AudioLevelMeter({ level, label, color }: AudioLevelMeterProps) {
  const barCount = 20
  const activeBars = Math.round(level * barCount)
  const colorClasses =
    color === 'blue'
      ? 'bg-blue-500 dark:bg-blue-400'
      : 'bg-green-500 dark:bg-green-400'

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {label}
      </span>
      <div className="flex items-end gap-0.5 h-8">
        {Array.from({ length: barCount }, (_, i) => (
          <div
            key={i}
            className={`w-1.5 rounded-sm transition-all duration-75 ${
              i < activeBars
                ? i > barCount * 0.8
                  ? 'bg-red-500'
                  : i > barCount * 0.6
                    ? 'bg-yellow-500'
                    : colorClasses
                : 'bg-gray-200 dark:bg-gray-700'
            }`}
            style={{ height: `${((i + 1) / barCount) * 100}%` }}
          />
        ))}
      </div>
      <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
        {Math.round(level * 100)}%
      </span>
    </div>
  )
}
