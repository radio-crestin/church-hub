import { Fragment } from 'react'

import type { SharedSongWord } from '../service/sharedSong'

interface SharedSongLineProps {
  words: SharedSongWord[]
  showChords: boolean
}

/** A line of lyrics, each chord over the word it is played on. */
export function SharedSongLine({ words, showChords }: SharedSongLineProps) {
  if (words.length === 0) return <div className="h-4" aria-hidden />
  const withChords = showChords && words.some((word) => word.chord)
  return (
    // Real spaces between the words, so the lyrics copy as text.
    <p className="text-lg leading-snug text-fg">
      {words.map((word, index) => (
        <Fragment key={index}>
          {index > 0 && ' '}
          <span className="inline-flex flex-col align-bottom">
            {withChords && (
              <span
                className="min-h-[1.4em] text-sm font-semibold text-key"
                data-testid="shared-song-chord"
              >
                {word.chord ?? ''}
              </span>
            )}
            <span>{word.word}</span>
          </span>
        </Fragment>
      ))}
    </p>
  )
}
