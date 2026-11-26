import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast/useToast'
import { useSetPreviewScreen } from '../../hooks/useSetPreviewScreen'
import type { Screen } from '../../types'

interface PreviewScreenRadioProps {
  screen: Screen
  /** This screen is the one the previews mirror now (chosen or by default). */
  checked: boolean
}

/**
 * "Shown in the previews": one radio per screen card, all in one group, so
 * exactly one screen is chosen. Without a choice the main screen is checked.
 */
export function PreviewScreenRadio({
  screen,
  checked,
}: PreviewScreenRadioProps) {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const { setPreviewScreen, isPending } = useSetPreviewScreen()
  const id = useId()

  const handleChange = async () => {
    try {
      await setPreviewScreen(screen)
      showToast(t('sections.screens.previewScreen.enabled'), 'success')
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: surface why the switch failed
      console.error('[preview-screen] Failed to change it:', error)
      showToast(t('sections.screens.previewScreen.error'), 'error')
    }
  }

  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <label
          htmlFor={id}
          className="block text-sm font-medium text-fg cursor-pointer"
        >
          {t('sections.screens.previewScreen.label')}
        </label>
        <p id={`${id}-description`} className="mt-0.5 text-xs text-fg-hint">
          {t('sections.screens.previewScreen.description')}
        </p>
      </div>
      <input
        id={id}
        type="radio"
        name="preview-screen"
        checked={checked}
        onChange={handleChange}
        disabled={isPending}
        aria-describedby={`${id}-description`}
        data-testid="screen-preview-screen"
        className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-primary"
      />
    </div>
  )
}
