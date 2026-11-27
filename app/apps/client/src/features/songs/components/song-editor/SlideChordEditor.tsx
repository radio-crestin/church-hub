import { X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ChordMapping } from '../../types'
import { COMMON_CHORDS } from '../../utils/commonChords'
import { getSlideWords } from '../../utils/getSlideWords'
import { localizeChordName } from '../../utils/localizeChordName'

interface SlideChordEditorProps {
  content: string
  chords: ChordMapping[] | null | undefined
  onChordsChange: (chords: ChordMapping[] | null) => void
}

/**
 * The slide's words with their chords above them. Clicking a word opens the
 * chord list under the words (type to filter, Enter takes the first, Escape
 * closes, anything typed can be used as it is); clicking a chord removes it.
 */
export function SlideChordEditor({
  content,
  chords,
  onChordsChange,
}: SlideChordEditorProps) {
  const { t, i18n } = useTranslation('songs')
  const language = i18n.language?.split('-')[0] || 'en'
  const [selectedWord, setSelectedWord] = useState<number | null>(null)
  const [filter, setFilter] = useState('')

  const words = useMemo(() => getSlideWords(content), [content])
  const chordAt = useMemo(
    () => new Map((chords ?? []).map((c) => [c.wordIndex, c.chord] as const)),
    [chords],
  )
  const matchingChords = useMemo(() => {
    const lower = filter.trim().toLowerCase()
    return lower
      ? COMMON_CHORDS.filter((c) => c.toLowerCase().includes(lower))
      : COMMON_CHORDS
  }, [filter])

  const close = () => {
    setSelectedWord(null)
    setFilter('')
  }

  const assign = (chord: string) => {
    if (selectedWord === null) return
    const others = (chords ?? []).filter((c) => c.wordIndex !== selectedWord)
    onChordsChange([...others, { wordIndex: selectedWord, chord }])
    close()
  }

  const remove = (wordIndex: number) => {
    const rest = (chords ?? []).filter((c) => c.wordIndex !== wordIndex)
    onChordsChange(rest.length > 0 ? rest : null)
  }

  if (words.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-fg-hint">
        {t('songEditor.chords.empty')}
      </p>
    )
  }

  return (
    <div data-testid="slide-chord-editor" className="space-y-2 px-3 py-2">
      <div className="flex flex-wrap items-end gap-x-1 gap-y-1.5 leading-tight">
        {words.map((word, index) => {
          if (word === '\n') {
            return <div key={`br-${index}`} className="h-0 w-full" />
          }
          const chord = chordAt.get(index)
          const selected = selectedWord === index
          return (
            <div key={index} className="flex flex-col items-center">
              {chord ? (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  data-testid="slide-chord"
                  className="text-[11px] font-bold text-amber-600 hover:text-red-500 dark:text-amber-400"
                  title={t('chords.removeChord')}
                >
                  {localizeChordName(chord, language)}
                </button>
              ) : (
                <span className="h-[14px]" />
              )}
              <button
                type="button"
                data-testid="slide-chord-word"
                onClick={() => (selected ? close() : setSelectedWord(index))}
                className={`rounded px-1 py-0.5 text-sm transition-colors ${
                  selected
                    ? 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100'
                    : 'text-fg-body hover:bg-amber-100 dark:hover:bg-amber-900/30'
                }`}
              >
                {word}
              </button>
            </div>
          )
        })}
      </div>

      {selectedWord !== null && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2 dark:border-amber-900/50 dark:bg-amber-950/20">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const chord = matchingChords[0] ?? filter.trim()
                if (chord) assign(chord)
              }
              if (e.key === 'Escape') {
                e.stopPropagation()
                close()
              }
            }}
            placeholder={t('chords.searchChord')}
            data-testid="slide-chord-filter"
            autoFocus
            className="mb-2 w-full rounded border border-line bg-panel px-2 py-1 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
          <div className="grid max-h-36 grid-cols-6 gap-1 overflow-y-auto sm:grid-cols-10">
            {matchingChords.map((chord) => (
              <button
                key={chord}
                type="button"
                onClick={() => assign(chord)}
                className="rounded px-1 py-1 text-xs font-medium text-fg-body hover:bg-amber-100 dark:hover:bg-amber-900/30"
              >
                {localizeChordName(chord, language)}
              </button>
            ))}
          </div>
          {filter.trim() && matchingChords.length === 0 && (
            <button
              type="button"
              onClick={() => assign(filter.trim())}
              className="mt-1 w-full rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300"
            >
              {t('chords.useCustom', { chord: filter.trim() })}
            </button>
          )}
        </div>
      )}

      {chords && chords.length > 0 && (
        <button
          type="button"
          onClick={() => onChordsChange(null)}
          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 dark:text-red-400"
        >
          <X className="h-3 w-3" />
          {t('chords.clearAll')}
        </button>
      )}
    </div>
  )
}
