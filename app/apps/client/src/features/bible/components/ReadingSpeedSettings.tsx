import { Timer } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useReadingSpeed } from '../hooks/useReadingSpeed'

/** Sets how long a looping bookmark slideshow keeps each verse on screen. */
export function ReadingSpeedSettings() {
  const { t } = useTranslation('bible')
  const { wordsPerMinute, save } = useReadingSpeed()

  return (
    <div>
      <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
        <Timer className="h-5 w-5" />
        {t('settings.readingSpeed.title')}
      </h3>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {t('settings.readingSpeed.description')}
      </p>
      <label className="mt-4 flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
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
          className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
        {t('settings.readingSpeed.label')}
      </label>
    </div>
  )
}
