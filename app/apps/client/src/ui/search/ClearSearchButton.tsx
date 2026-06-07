import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface ClearSearchButtonProps {
  /** Ref of the search input to refocus after clearing */
  inputRef: React.RefObject<HTMLInputElement | null>
  /** Clears the search state; the input is refocused right after */
  onClear: () => void
  /** X icon size in px */
  size?: number
  /** Positioning/styling override */
  className?: string
}

/**
 * Standard clear ("X") button for search inputs. Clears the query via
 * `onClear` and returns keyboard focus to the input so the user can keep
 * typing. Render it conditionally when the query is non-empty.
 */
export function ClearSearchButton({
  inputRef,
  onClear,
  size = 16,
  className = 'absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
}: ClearSearchButtonProps) {
  const { t } = useTranslation('common')

  return (
    <button
      type="button"
      aria-label={t('search.clear')}
      data-testid="clear-search-button"
      // Don't steal focus from the input while the button is pressed
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        onClear()
        inputRef.current?.focus()
      }}
      className={className}
    >
      <X size={size} />
    </button>
  )
}
