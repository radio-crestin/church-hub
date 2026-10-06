import { useTranslation } from 'react-i18next'

import { GuideStep } from './GuideStep'
import { SceneChecklist } from './SceneChecklist'
import { useOBSConnection, useOBSScenes } from '../../hooks'

/** How to make the first scene in OBS, then the others under the same names. */
export function FirstSceneStep({ number }: { number: number }) {
  const { t } = useTranslation('livestream')
  const { scenes } = useOBSScenes()
  const { isConnected } = useOBSConnection()

  const visibleScenes = scenes.filter((scene) => scene.isVisible)
  const firstScene =
    visibleScenes.find((scene) =>
      scene.contentTypes.includes('song_schedule'),
    ) ?? visibleScenes[0]
  const isInOBS = isConnected && visibleScenes.some((scene) => !scene.isCustom)

  return (
    <GuideStep
      number={number}
      title={t('guide.firstScene.title')}
      isDone={isInOBS}
    >
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          {t('guide.firstScene.create', {
            name:
              firstScene?.obsSceneName ?? t('guide.firstScene.fallbackName'),
          })}
        </li>
        <li>{t('guide.firstScene.camera')}</li>
        <li>{t('guide.firstScene.browser')}</li>
        <li>{t('guide.firstScene.others')}</li>
      </ol>
      <SceneChecklist scenes={visibleScenes} isOBSConnected={isConnected} />
    </GuideStep>
  )
}
