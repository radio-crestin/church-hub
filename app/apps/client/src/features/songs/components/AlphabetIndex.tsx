import { useTranslation } from 'react-i18next'

interface AlphabetIndexProps {
  letters: string[]
  availableLetters: Set<string>
  activeLetter: string | null
  indicatorLetter: string | null
  isDragging: boolean
  railRef: React.RefObject<HTMLDivElement | null>
  onJumpToLetter: (letter: string) => void
  railHandlers: {
    onPointerDown: (event: React.PointerEvent) => void
    onPointerMove: (event: React.PointerEvent) => void
    onPointerUp: (event: React.PointerEvent) => void
    onPointerCancel: (event: React.PointerEvent) => void
  }
}

/**
 * The vertical A–Z rail pinned to the right edge of the song list, plus the
 * large floating bubble shown while dragging. The whole rail is one pointer
 * surface: dragging maps finger position → letter, while individual letters
 * stay keyboard-focusable for click/Enter activation.
 */
export function AlphabetIndex({
  letters,
  availableLetters,
  activeLetter,
  indicatorLetter,
  isDragging,
  railRef,
  onJumpToLetter,
  railHandlers,
}: AlphabetIndexProps) {
  const { t } = useTranslation('songs')

  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex items-center">
      {/* Floating letter bubble while dragging */}
      {isDragging && indicatorLetter && (
        <div className="pointer-events-none absolute right-9 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-3xl font-bold text-white shadow-xl shadow-indigo-500/30">
          {indicatorLetter}
        </div>
      )}

      <div
        ref={railRef}
        data-testid="alphabet-index"
        role="navigation"
        aria-label={t('alphabetScroll.label')}
        onPointerDown={railHandlers.onPointerDown}
        onPointerMove={railHandlers.onPointerMove}
        onPointerUp={railHandlers.onPointerUp}
        onPointerCancel={railHandlers.onPointerCancel}
        style={{ touchAction: 'none' }}
        className="pointer-events-auto flex select-none flex-col items-center justify-center rounded-full bg-white/70 px-0.5 py-1 dark:bg-gray-800/70"
      >
        {letters.map((letter) => {
          const isAvailable = availableLetters.has(letter)
          const isActive = activeLetter === letter
          return (
            <button
              key={letter}
              type="button"
              data-testid={`alphabet-letter-${letter}`}
              tabIndex={isAvailable ? 0 : -1}
              disabled={!isAvailable}
              aria-label={t('alphabetScroll.jumpTo', { letter })}
              title={t('alphabetScroll.jumpTo', { letter })}
              onClick={() => isAvailable && onJumpToLetter(letter)}
              className={`flex h-[3.4vh] max-h-5 min-h-3.5 w-5 items-center justify-center rounded-full text-[10px] font-semibold leading-none transition-colors sm:text-xs ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : isAvailable
                    ? 'text-indigo-600 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900/40'
                    : 'text-gray-300 dark:text-gray-600'
              }`}
            >
              {letter}
            </button>
          )
        })}
      </div>
    </div>
  )
}
