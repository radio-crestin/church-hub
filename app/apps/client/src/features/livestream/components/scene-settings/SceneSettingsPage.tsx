import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { SceneSettingsForm } from './SceneSettingsForm'
import { useOBSScenes, useYouTubeConfig } from '../../hooks'
import { SettingsPageLayout } from '../settings-page/SettingsPageLayout'

interface SceneSettingsPageProps {
  sceneId: number
}

/** One OBS scene's settings, on its own page. */
export function SceneSettingsPage({ sceneId }: SceneSettingsPageProps) {
  const { t } = useTranslation('livestream')
  const navigate = useNavigate()
  const { scenes, isLoading, updateScene, deleteSceneAsync, isDeleting } =
    useOBSScenes()
  const { config: youtubeConfig, update: updateYouTubeConfig } =
    useYouTubeConfig()
  const scene = scenes.find((s) => s.id === sceneId)
  const backToScenes = () => navigate({ to: '/settings/livestream' })

  return (
    <SettingsPageLayout
      back={{ to: '/settings/livestream', label: t('sceneSettingsPage.back') }}
      title={scene?.displayName ?? t('scenes.sceneSettings')}
      description={t('sceneSettingsPage.subtitle')}
      testId="scene-settings-page"
    >
      {scene ? (
        <SceneSettingsForm
          key={scene.id}
          scene={scene}
          allScenes={scenes}
          youtubeConfig={youtubeConfig}
          onUpdateYouTubeConfig={updateYouTubeConfig}
          onCancel={backToScenes}
          onSave={(data) => {
            updateScene({ id: sceneId, data })
            backToScenes()
          }}
          onDelete={async () => {
            await deleteSceneAsync(sceneId)
            backToScenes()
          }}
          isDeleting={isDeleting}
        />
      ) : (
        !isLoading && (
          <p className="text-[13px] text-fg-label">
            {t('sceneSettingsPage.notFound')}
          </p>
        )
      )}
    </SettingsPageLayout>
  )
}
