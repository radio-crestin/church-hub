import { Check, MonitorPlay } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useHasPermission } from '~/ui/PermissionGate'
import { useToast } from '~/ui/toast/useToast'
import { usePreviewScreen } from '../hooks/usePreviewScreen'
import { useScreens } from '../hooks/useScreens'
import { useSetPreviewScreen } from '../hooks/useSetPreviewScreen'

interface PreviewScreenPickerProps {
  /** Which way the list opens: up from a bottom row of controls, down from a header. */
  placement?: 'up' | 'down'
}

/**
 * Which screen the previews mirror: an icon button beside the preview's
 * controls that opens a small list of the screens. Hidden when there is
 * nothing to choose between or the user may not edit screens.
 */
export function PreviewScreenPicker({
  placement = 'up',
}: PreviewScreenPickerProps) {
  const { t } = useTranslation('presentation')
  const { showToast } = useToast()
  const { data: screens } = useScreens()
  const { previewScreen } = usePreviewScreen()
  const { setPreviewScreen, isPending } = useSetPreviewScreen()
  const canEdit = useHasPermission('displays.edit')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  if (!canEdit || !screens || screens.length < 2 || !previewScreen) return null

  const choose = async (screenId: number) => {
    setOpen(false)
    const screen = screens.find((s) => s.id === screenId)
    if (!screen || screen.id === previewScreen.id) return
    try {
      await setPreviewScreen(screen)
      showToast(
        t('previewScreenPicker.changed', { name: screen.name }),
        'success',
      )
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: surface why the switch failed
      console.error('[preview-screen] Failed to change it:', error)
      showToast(t('previewScreenPicker.error'), 'error')
    }
  }

  const label = `${t('previewScreenPicker.label')}: ${previewScreen.name}`

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        data-testid="preview-screen-picker"
        data-value={previewScreen.id}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={isPending}
        onClick={() => setOpen((value) => !value)}
        className={`flex h-9 w-9 items-center justify-center rounded-lg text-fg-label transition-colors hover:bg-hover hover:text-fg disabled:opacity-50 ${
          open ? 'bg-selected text-fg' : 'bg-field'
        }`}
      >
        <MonitorPlay size={18} strokeWidth={1.5} aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={t('previewScreenPicker.label')}
          className={`absolute right-0 z-30 min-w-52 rounded-[10px] border border-line bg-panel p-1 shadow-popover ${
            placement === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          <p className="px-2 pt-1 pb-1.5 text-xs text-fg-hint">
            {t('previewScreenPicker.label')}
          </p>
          {screens.map((screen) => {
            const isCurrent = screen.id === previewScreen.id
            return (
              <button
                key={screen.id}
                type="button"
                role="menuitemradio"
                aria-checked={isCurrent}
                data-testid={`preview-screen-option-${screen.id}`}
                onClick={() => choose(screen.id)}
                className={`flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-sm transition-colors hover:bg-hover ${
                  isCurrent ? 'text-fg' : 'text-fg-body'
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{screen.name}</span>
                {isCurrent && (
                  <Check
                    size={16}
                    strokeWidth={1.75}
                    className="shrink-0 text-primary"
                  />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
