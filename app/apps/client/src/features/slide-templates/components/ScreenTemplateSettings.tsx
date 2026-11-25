import { useTranslation } from 'react-i18next'

import { useOBSScenes } from '~/features/livestream/hooks'
import { useUpsertScreen } from '~/features/presentation/hooks'
import type { Screen } from '~/features/presentation/types'
import { SwitchRow } from '~/ui/switch/SwitchRow'
import { useToast } from '~/ui/toast/useToast'
import { TemplatePicker } from './TemplatePicker'
import { useSetSceneTemplate } from '../hooks/useSlideTemplateMutations'

interface ScreenTemplateSettingsProps {
  screen: Screen
}

/**
 * The screen's template, in Settings → Screens: one choice, whether a running presentation restyles it, and (with OBS scenes) another
 * template while a scene is live.
 */
export function ScreenTemplateSettings({
  screen,
}: ScreenTemplateSettingsProps) {
  const { t } = useTranslation('presentation')
  const { showToast } = useToast()
  const upsertScreen = useUpsertScreen()
  const setSceneTemplate = useSetSceneTemplate()
  const { scenes } = useOBSScenes()

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action()
      showToast(t('templates.toast.changed'), 'success')
    } catch {
      showToast(t('templates.toast.error'), 'error')
    }
  }
  const saveScreen = (changes: {
    templateId?: number
    followsPresentation?: boolean
  }) =>
    run(() =>
      upsertScreen.mutateAsync({
        id: screen.id,
        name: screen.name,
        type: screen.type,
        ...changes,
      }),
    )

  return (
    <div className="space-y-2 py-2" data-testid="screen-template-settings">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t('templates.screen.description')}
      </p>
      <div className="max-w-md">
        <TemplatePicker
          value={screen.templateId}
          onChange={(templateId) =>
            templateId !== null && saveScreen({ templateId })
          }
          disabled={upsertScreen.isPending}
          testId="screen-template-picker"
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
      {scenes.length > 0 && (
        <details className="group py-1" data-testid="screen-scene-templates">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('templates.screen.scenes.title')}
          </summary>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t('templates.screen.scenes.description')}
          </p>
          <div className="mt-2 space-y-2">
            {scenes.map((scene) => (
              <div
                key={scene.obsSceneName}
                className="grid items-center gap-2 sm:grid-cols-[10rem_1fr]"
              >
                <span className="truncate text-sm text-gray-700 dark:text-gray-300">
                  {scene.displayName || scene.obsSceneName}
                </span>
                <TemplatePicker
                  value={screen.sceneTemplates[scene.obsSceneName] ?? null}
                  noneLabel={t('templates.screen.scenes.own')}
                  onChange={(templateId) =>
                    run(() =>
                      setSceneTemplate.mutateAsync({
                        screenId: screen.id,
                        obsSceneName: scene.obsSceneName,
                        templateId,
                      }),
                    )
                  }
                  testId={`scene-template-picker-${scene.obsSceneName}`}
                />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
