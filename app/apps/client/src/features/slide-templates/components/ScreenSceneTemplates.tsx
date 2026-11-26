import { useTranslation } from 'react-i18next'

import { useOBSScenes } from '~/features/livestream/hooks'
import type { Screen } from '~/features/presentation/types'
import { useToast } from '~/ui/toast/useToast'
import { TemplatePicker } from './TemplatePicker'
import { useSetSceneTemplate } from '../hooks/useSlideTemplateMutations'

interface ScreenSceneTemplatesProps {
  screen: Screen
}

/** Another template for the screen while an OBS scene is live. */
export function ScreenSceneTemplates({ screen }: ScreenSceneTemplatesProps) {
  const { t } = useTranslation('presentation')
  const { showToast } = useToast()
  const setSceneTemplate = useSetSceneTemplate()
  const { scenes } = useOBSScenes()

  if (scenes.length === 0) return null

  const choose = async (obsSceneName: string, templateId: number | null) => {
    try {
      await setSceneTemplate.mutateAsync({
        screenId: screen.id,
        obsSceneName,
        templateId,
      })
      showToast(t('templates.toast.changed'), 'success')
    } catch {
      showToast(t('templates.toast.error'), 'error')
    }
  }

  return (
    <div className="py-2" data-testid="screen-scene-templates">
      <p className="text-[13px] font-medium text-fg">
        {t('templates.screen.scenes.title')}
      </p>
      <p className="mt-0.5 text-xs text-fg-hint">
        {t('templates.screen.scenes.description')}
      </p>
      <div className="mt-2 space-y-2">
        {scenes.map((scene) => (
          <div
            key={scene.obsSceneName}
            className="grid items-center gap-2 sm:grid-cols-[10rem_1fr]"
          >
            <span className="truncate text-[13px] text-fg-body">
              {scene.displayName || scene.obsSceneName}
            </span>
            <TemplatePicker
              value={screen.sceneTemplates[scene.obsSceneName] ?? null}
              noneLabel={t('templates.screen.scenes.own')}
              onChange={(templateId) => choose(scene.obsSceneName, templateId)}
              testId={`scene-template-picker-${scene.obsSceneName}`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
