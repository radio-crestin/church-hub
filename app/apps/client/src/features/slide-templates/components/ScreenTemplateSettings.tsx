import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { useUpsertScreen } from '~/features/presentation/hooks'
import type { Screen } from '~/features/presentation/types'
import { SwitchRow } from '~/ui/switch/SwitchRow'
import { useToast } from '~/ui/toast/useToast'
import { TemplateGrid } from './TemplateGrid'

interface ScreenTemplateSettingsProps {
  screen: Screen
}

/**
 * How a screen looks, in Settings → Screens: every template drawn as it
 * looks, one click to use it, and whether a running presentation may
 * restyle the screen.
 */
export function ScreenTemplateSettings({
  screen,
}: ScreenTemplateSettingsProps) {
  const { t } = useTranslation('presentation')
  const { showToast } = useToast()
  const upsertScreen = useUpsertScreen()

  const saveScreen = async (changes: {
    templateId?: number
    followsPresentation?: boolean
  }) => {
    try {
      await upsertScreen.mutateAsync({
        id: screen.id,
        name: screen.name,
        type: screen.type,
        ...changes,
      })
      showToast(t('templates.toast.changed'), 'success')
    } catch {
      showToast(t('templates.toast.error'), 'error')
    }
  }

  return (
    <div className="space-y-2 py-2" data-testid="screen-template-settings">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs text-fg-hint">
          {t('templates.screen.description')}
        </p>
        <Link
          to="/settings/themes"
          className="text-xs font-medium text-focus hover:underline"
        >
          {t('templates.picker.manage')}
        </Link>
      </div>
      <div data-testid="screen-template-gallery">
        <TemplateGrid
          value={screen.templateId}
          onChoose={(templateId) =>
            templateId !== null &&
            templateId !== screen.templateId &&
            saveScreen({ templateId })
          }
          disabled={upsertScreen.isPending}
          dense
        />
      </div>
      <SwitchRow
        label={t('templates.screen.follows.label')}
        description={t('templates.screen.follows.description')}
        checked={screen.followsPresentation}
        onCheckedChange={(followsPresentation) =>
          saveScreen({ followsPresentation })
        }
        disabled={upsertScreen.isPending}
        testId="screen-follows-presentation"
      />
    </div>
  )
}
