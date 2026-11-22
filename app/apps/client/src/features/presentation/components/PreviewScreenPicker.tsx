import { ChevronDown, MonitorPlay } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useHasPermission } from '~/ui/PermissionGate'
import { useToast } from '~/ui/toast/useToast'
import { useScreens } from '../hooks/useScreens'
import { useSetPreviewScreen } from '../hooks/useSetPreviewScreen'

interface PreviewScreenPickerProps {
  /** The screen the preview mirrors now (see resolvePreviewScreen). */
  previewScreenId: number
}

/**
 * A small screen picker laid over a live preview, so the operator switches
 * which screen every preview mirrors without leaving the page. A native
 * select, so phones open their own picker. Hidden when there is nothing to
 * choose between or the user may not edit screens.
 */
export function PreviewScreenPicker({
  previewScreenId,
}: PreviewScreenPickerProps) {
  const { t } = useTranslation('presentation')
  const { showToast } = useToast()
  const { data: screens } = useScreens()
  const { setPreviewScreen, isPending } = useSetPreviewScreen()
  const canEdit = useHasPermission('displays.edit')

  if (!canEdit || !screens || screens.length < 2) return null

  const handleChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const screen = screens.find((s) => s.id === Number(event.target.value))
    if (!screen) return
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

  return (
    <label className="absolute top-2 left-2 z-10 flex items-center gap-1 max-w-[60%] rounded-md bg-black/60 px-2 py-1 text-xs text-white opacity-80 hover:opacity-100 focus-within:opacity-100 backdrop-blur-sm">
      <MonitorPlay size={14} className="shrink-0" aria-hidden />
      <select
        data-testid="preview-screen-picker"
        aria-label={t('previewScreenPicker.label')}
        title={t('previewScreenPicker.label')}
        value={previewScreenId}
        onChange={handleChange}
        disabled={isPending}
        className="min-w-0 appearance-none truncate bg-transparent pr-4 outline-none cursor-pointer [&>option]:text-gray-900"
      >
        {screens.map((screen) => (
          <option key={screen.id} value={screen.id}>
            {screen.name}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        className="pointer-events-none -ml-4 shrink-0"
        aria-hidden
      />
    </label>
  )
}
