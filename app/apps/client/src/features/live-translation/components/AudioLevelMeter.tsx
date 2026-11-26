interface AudioLevelMeterProps {
  level: number
  label: string
  color: 'blue' | 'green'
}

export function AudioLevelMeter({ level, label, color }: AudioLevelMeterProps) {
  const barCount = 20
  const activeBars = Math.round(level * barCount)
  const colorClasses = color === 'blue' ? 'bg-primary' : 'bg-ok'

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-fg-label">{label}</span>
      <div className="flex items-end gap-0.5 h-8">
        {Array.from({ length: barCount }, (_, i) => (
          <div
            key={i}
            className={`w-1.5 rounded-sm transition-all duration-75 ${
              i < activeBars
                ? i > barCount * 0.8
                  ? 'bg-red-500'
                  : i > barCount * 0.6
                    ? 'bg-amber-500'
                    : colorClasses
                : 'bg-line-strong'
            }`}
            style={{ height: `${((i + 1) / barCount) * 100}%` }}
          />
        ))}
      </div>
      <span className="text-xs text-fg-hint tabular-nums">
        {Math.round(level * 100)}%
      </span>
    </div>
  )
}
