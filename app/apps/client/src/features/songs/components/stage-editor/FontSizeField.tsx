import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

/**
 * The sizes the dropdown offers. The usual print ladder — the field stays
 * typable, so anything off this list is still a size the operator can ask for.
 */
export const FONT_SIZE_PRESETS = [
  8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 72,
] as const

interface FontSizeFieldProps {
  /**
   * Every distinct size in the selection, smallest first. One entry is a
   * selection all at that size; several mean it is mixed.
   */
  sizes: number[]
  /** Applies a size to the whole selection. */
  onApply: (size: number) => void
  disabled?: boolean
}

/**
 * PowerPoint's size box: a typable field that also drops down a list of the
 * usual sizes.
 *
 * A selection of one size shows that size. A selection crossing sizes shows the
 * smallest with a `+` after it — the field says the selection is mixed rather
 * than picking one of the sizes and pretending. Opening the field or its list
 * changes nothing on its own; only committing a value does, and it goes to the
 * whole selection.
 */
export function FontSizeField({
  sizes,
  onApply,
  disabled = false,
}: FontSizeFieldProps) {
  const { t } = useTranslation('songs')
  const [draft, setDraft] = useState<string | null>(null)
  const [menuAt, setMenuAt] = useState<{ top: number; left: number } | null>(
    null,
  )
  const fieldRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // The list is portalled to the body, so it is not inside `fieldRef` — the
  // outside-click closer has to be told about it or a press on a size would
  // unmount the list before the click could land on it.
  const menuRef = useRef<HTMLUListElement>(null)

  const smallest = sizes[0]
  const isMixed = sizes.length > 1
  const display =
    smallest === undefined ? '' : isMixed ? `${smallest}+` : String(smallest)

  // While the operator is typing, the field is theirs; the rest of the time it
  // reports the selection, and follows it as the selection moves.
  const value = draft ?? display

  const commit = (raw: string) => {
    const parsed = Number.parseInt(raw, 10)
    setDraft(null)
    if (!Number.isFinite(parsed) || parsed <= 0) return
    onApply(parsed)
  }

  const openMenu = () => {
    const box = fieldRef.current?.getBoundingClientRect()
    if (!box) return
    setMenuAt({ top: box.bottom + 4, left: box.left })
  }

  useEffect(() => {
    if (!menuAt) return
    const close = (event: MouseEvent) => {
      const target = event.target as Node
      if (fieldRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setMenuAt(null)
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuAt(null)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onEscape)
    }
  }, [menuAt])

  return (
    <div ref={fieldRef} className="relative flex items-center">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        data-testid="slide-style-font-size"
        aria-label={t('stageEditor.style.fontSize')}
        title={t('stageEditor.style.fontSize')}
        disabled={disabled}
        value={value}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={() => {
          // Typing replaces the size rather than editing the `+` marker.
          setDraft(smallest === undefined ? '' : String(smallest))
          requestAnimationFrame(() => inputRef.current?.select())
        }}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit(event.currentTarget.value)
            inputRef.current?.blur()
            return
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            setDraft(null)
            inputRef.current?.blur()
          }
        }}
        className="h-7 w-14 rounded-md border border-gray-300 bg-white px-1.5 text-center text-sm text-gray-700 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
      />
      <button
        type="button"
        data-testid="slide-style-font-size-menu"
        // Opening the list must not take the selection the size would apply to.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => (menuAt ? setMenuAt(null) : openMenu())}
        disabled={disabled}
        aria-label={t('stageEditor.style.fontSizePresets')}
        title={t('stageEditor.style.fontSizePresets')}
        className="-ml-6 flex h-6 w-5 items-center justify-center rounded text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-700"
      >
        <ChevronDown size={14} />
      </button>

      {menuAt &&
        createPortal(
          <ul
            ref={menuRef}
            data-testid="slide-style-font-size-list"
            className="fixed z-[100] max-h-64 w-20 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
            style={{ top: menuAt.top, left: menuAt.left }}
          >
            {FONT_SIZE_PRESETS.map((preset) => (
              <li key={preset}>
                <button
                  type="button"
                  data-testid={`slide-style-font-size-${preset}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setMenuAt(null)
                    setDraft(null)
                    onApply(preset)
                  }}
                  className={`w-full px-3 py-1 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    !isMixed && preset === smallest
                      ? 'font-semibold text-indigo-600 dark:text-indigo-400'
                      : 'text-gray-700 dark:text-gray-200'
                  }`}
                >
                  {preset}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  )
}
