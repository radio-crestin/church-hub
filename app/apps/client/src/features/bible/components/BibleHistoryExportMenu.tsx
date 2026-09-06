import { CalendarClock, ChevronDown, Download, History } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

export type BibleHistoryExportScope = 'session' | 'all'

interface BibleHistoryExportMenuProps {
  /** Verses in the most recent session — the default, top choice. */
  sessionCount: number
  /** Verses in the whole history. */
  totalCount: number
  onExport: (scope: BibleHistoryExportScope) => void
}

const MENU_WIDTH = 232
const MENU_GAP = 6

/**
 * Export control for the Bible history panel: a download button that opens a
 * two-choice menu — the last session, or the entire history.
 *
 * The menu is rendered through a portal with fixed positioning because the
 * panel around it clips its overflow, which would otherwise cut the menu off.
 */
export function BibleHistoryExportMenu({
  sessionCount,
  totalCount,
  onExport,
}: BibleHistoryExportMenuProps) {
  const { t } = useTranslation('bible')
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  )

  // Keep the menu pinned under the trigger while it is open.
  useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      const el = triggerRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      // Right-aligned with the trigger, clamped into the viewport.
      const left = Math.max(
        8,
        Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8),
      )
      setCoords({ top: r.bottom + MENU_GAP, left })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  // Close on Escape or on a click outside the trigger and the menu.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target)) return
      if (triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open])

  const handleChoose = useCallback(
    (scope: BibleHistoryExportScope) => {
      setOpen(false)
      onExport(scope)
    },
    [onExport],
  )

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="bible-history-export"
        className="flex items-center gap-0.5 p-1.5 rounded-md bg-teal-50 text-teal-600 hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-900/50 transition-colors"
        title={t('history.export')}
      >
        <Download className="w-3.5 h-3.5" />
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && coords
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              data-testid="bible-history-export-menu"
              style={{
                position: 'fixed',
                top: coords.top,
                left: coords.left,
                width: MENU_WIDTH,
              }}
              className="z-[100] rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
            >
              <MenuItem
                icon={<CalendarClock className="w-3.5 h-3.5" />}
                label={t('history.exportLastSession')}
                count={sessionCount}
                testId="bible-history-export-session"
                onClick={() => handleChoose('session')}
              />
              <MenuItem
                icon={<History className="w-3.5 h-3.5" />}
                label={t('history.exportEntireHistory')}
                count={totalCount}
                testId="bible-history-export-all"
                onClick={() => handleChoose('all')}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  count: number
  testId: string
  onClick: () => void
}

function MenuItem({ icon, label, count, testId, onClick }: MenuItemProps) {
  const { t } = useTranslation('bible')

  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={count === 0}
      data-testid={testId}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:text-gray-200 dark:hover:bg-gray-700"
    >
      <span className="text-teal-600 dark:text-teal-400">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      <span className="text-[11px] text-gray-500 dark:text-gray-400">
        {t('history.exportVerseCount', { count })}
      </span>
    </button>
  )
}
