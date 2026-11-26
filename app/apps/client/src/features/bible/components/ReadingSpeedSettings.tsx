import { Timer } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useReadingSpeed } from '../hooks/useReadingSpeed'

/** Sets how long a looping bookmark slideshow keeps each verse on screen. */
export function ReadingSpeedSettings() {
  const { t } = useTranslation('bible')
  const { wordsPerMinute, save } = useReadingSpeed()

  return (
    <div>
      <h3 className="flex items-center gap-2 text-base font-semibold text-fg">
        <Timer className="h-5 w-5" strokeWidth={1.5} />
        {t('settings.readingSpeed.title')}
      </h3>
      <p className="mt-1 text-sm text-fg-label">
        {t('settings.readingSpeed.description')}
      </p>
      <label className="mt-4 flex items-center gap-3 text-sm text-fg-body">
        <input
          key={wordsPerMinute}
          type="number"
          min={40}
          max={600}
          step={10}
          defaultValue={wordsPerMinute}
          data-testid="bible-reading-speed"
          onBlur={(e) => {
            const value = Number(e.target.value)
            if (value > 0 && value !== wordsPerMinute) save(value)
          }}
          className="w-24 rounded-md border border-line bg-panel px-2 py-1.5 text-fg"
        />
        {t('settings.readingSpeed.label')}
      </label>
    </div>
  )
}
