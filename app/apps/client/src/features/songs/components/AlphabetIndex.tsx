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
        <div className="pointer-events-none absolute right-9 flex h-16 w-16 items-center justify-center rounded-xl bg-panel text-3xl font-semibold text-fg shadow-[0_12px_32px_rgba(0,0,0,0.25)] ring-1 ring-line">
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
        className="pointer-events-auto flex select-none flex-col items-center justify-center rounded-full bg-panel/70 px-0.5 py-1"
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
                  ? 'bg-primary text-white'
                  : isAvailable
                    ? 'text-fg-label hover:bg-hover hover:text-fg'
                    : 'text-fg-hint'
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
