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
        className="-ml-2 flex min-h-11 items-center gap-2 self-start rounded-lg px-2 text-sm font-medium text-fg-label hover:bg-hover hover:text-fg focus-visible:ring-1 focus-visible:ring-focus focus-visible:outline-none"
      >
        <ArrowLeft size={16} strokeWidth={1.5} />
        {t('songs.back')}
      </button>
      <header>
        <h2 className="text-lg font-semibold text-fg">{song.title}</h2>
        {song.author && <p className="text-sm text-fg-hint">{song.author}</p>}
      </header>
      {slides.map((slide) => (
        <section key={slide.sortOrder} className="flex flex-col gap-1">
          {slide.label && (
            <h3 className="text-xs font-medium text-fg-hint">{slide.label}</h3>
          )}
          <p
            data-testid="song-slide"
            className="whitespace-pre-line text-base leading-relaxed text-fg-body"
          >
            {slideText(slide.content)}
          </p>
        </section>
      ))}
    </article>
  )
}
