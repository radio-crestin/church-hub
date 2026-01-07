import { Slider } from '~/ui/slider'
import { formatDuration } from '../utils'

interface ProgressBarProps {
  currentTime: number
  duration: number
  onSeek: (time: number) => void
}

export function ProgressBar({
  currentTime,
  duration,
  onSeek,
}: ProgressBarProps) {
  const handleSeek = (values: number[]) => {
    onSeek(values[0])
  }

  return (
    <div className="flex items-center gap-3 w-full">
      <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums w-10 text-right">
        {formatDuration(currentTime)}
      </span>
      <Slider
        value={[currentTime]}
        min={0}
        max={duration || 100}
        step={1}
        onValueChange={handleSeek}
        className="flex-1"
      />
      <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums w-10">
        {formatDuration(duration)}
      </span>
    </div>
  )
}
