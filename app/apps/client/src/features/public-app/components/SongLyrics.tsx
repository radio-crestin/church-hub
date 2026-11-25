import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ChurchSong } from '../service/types'
import { slideText } from '../utils/slideText'

interface SongLyricsProps {
  song: ChurchSong
  onBack: () => void
}

/** One song's lyrics, slide by slide. */
export function SongLyrics({ song, onBack }: SongLyricsProps) {
  const { t } = useTranslation('publicApp')
  const slides = [...song.slides].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <article className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 self-start rounded-lg py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400"
      >
        <ArrowLeft size={16} />
        {t('songs.back')}
      </button>
      <header>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {song.title}
        </h2>
        {song.author && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {song.author}
          </p>
        )}
      </header>
      {slides.map((slide) => (
        <section key={slide.sortOrder} className="flex flex-col gap-1">
          {slide.label && (
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {slide.label}
            </h3>
          )}
          <p
            data-testid="song-slide"
            className="whitespace-pre-line text-base leading-relaxed text-gray-800 dark:text-gray-200"
          >
            {slideText(slide.content)}
          </p>
        </section>
      ))}
    </article>
  )
}
