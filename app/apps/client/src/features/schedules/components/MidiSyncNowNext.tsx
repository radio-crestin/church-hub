import { useTranslation } from 'react-i18next'

export interface SyncVerse {
  label: string
  text: string
}

interface MidiSyncNowNextProps {
  verses: SyncVerse[]
  current: number
}

/** The verse on screen at this point of the music, large, and the next one. */
export function MidiSyncNowNext({ verses, current }: MidiSyncNowNextProps) {
  const { t } = useTranslation('schedules')
  const verse = verses[current]
  const next = verses[current + 1]
  return (
    <div
      className="rounded-xl bg-gray-900 px-4 py-3 text-white dark:bg-black"
      data-testid="schedule-midi-sync-now"
      data-verse={current}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">
        {t('midi.verseOf', { current: current + 1, total: verses.length })}
        {verse?.label ? ` · ${verse.label}` : ''}
      </p>
      <p className="mt-1 line-clamp-3 whitespace-pre-line text-lg font-semibold leading-snug sm:text-xl">
        {verse?.text}
      </p>
      <p className="mt-2 truncate text-sm text-gray-400">
        {next
          ? `${t('midi.nextVerse')}: ${next.text.split('\n')[0]}`
          : t('midi.lastVerse')}
      </p>
    </div>
  )
}
