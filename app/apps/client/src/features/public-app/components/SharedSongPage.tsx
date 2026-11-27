import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AppMark } from '~/ui/brand/AppMark'
import { SessionNotice } from './SessionNotice'
import { SharedSongLine } from './SharedSongLine'
import type { SharedSongResult } from '../service/sharedSong'

/**
 * A song's public page (T-177): its words, with chords over them when it
 * has any, for anyone who opens its link.
 */
export function SharedSongPage({ result }: { result: SharedSongResult }) {
  const { t } = useTranslation('publicApp')
  const song = result.kind === 'found' ? result.song : null
  const hasChords =
    song?.slides.some((slide) =>
      slide.lines.some((line) => line.some((word) => word.chord)),
    ) ?? false
  const [showChords, setShowChords] = useState(true)

  useEffect(() => {
    if (song) document.title = `${song.title} · ${t('appName')}`
  }, [song, t])

  const details = song
    ? [song.author, song.keyLine && t('song.key', { key: song.keyLine })]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <div className="min-h-dvh bg-app pb-[env(safe-area-inset-bottom)]">
      <header className="border-b border-line bg-app pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4">
          <span className="flex items-center gap-2 text-sm font-semibold tracking-[-0.01em] text-fg">
            <AppMark size={24} />
            {t('appName')}
          </span>
          {hasChords && (
            <button
              type="button"
              aria-pressed={showChords}
              onClick={() => setShowChords((shown) => !shown)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-fg-body transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus aria-pressed:bg-selected aria-pressed:text-fg"
              data-testid="shared-song-chords-toggle"
            >
              {t('song.chords')}
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        {song ? (
          <article data-testid="shared-song">
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg">
              {song.title}
            </h1>
            {details && <p className="mt-1 text-sm text-fg-label">{details}</p>}
            <div className="mt-8 space-y-7">
              {song.slides.map((slide, index) => (
                <section key={index} data-testid="shared-song-slide">
                  {slide.label && (
                    <h2 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-fg-hint">
                      {slide.label}
                    </h2>
                  )}
                  {slide.lines.map((words, line) => (
                    <SharedSongLine
                      key={line}
                      words={words}
                      showChords={showChords}
                    />
                  ))}
                </section>
              ))}
            </div>
            <footer className="mt-12 space-y-1 border-t border-line pt-4 text-xs text-fg-hint">
              {song.copyright && <p>{song.copyright}</p>}
              <p>{t('song.sharedWith')}</p>
            </footer>
          </article>
        ) : (
          <SessionNotice
            notice={
              result.kind === 'notFound' ? 'song.notFound' : 'song.offline'
            }
            onRetry={
              result.kind === 'offline'
                ? () => window.location.reload()
                : undefined
            }
          />
        )}
      </main>
    </div>
  )
}
