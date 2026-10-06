import { useTranslation } from 'react-i18next'

import { CONTENT_TYPES } from '../../constants/content-types'
import type { OBSScene } from '../../types'

interface SceneChecklistProps {
  scenes: OBSScene[]
  isOBSConnected: boolean
}

/**
 * The scenes Church Hub expects in OBS, what switches to each one, and,
 * while OBS is connected, whether OBS has a scene by that name yet.
 */
export function SceneChecklist({
  scenes,
  isOBSConnected,
}: SceneChecklistProps) {
  const { t } = useTranslation('livestream')

  const switchedBy = (scene: OBSScene) =>
    CONTENT_TYPES.filter((type) => scene.contentTypes.includes(type.value))
      .map((type) => t(type.labelKey))
      .join(', ')

  return (
    <ul
      className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700"
      data-testid="livestream-guide-scenes"
    >
      {scenes.map((scene) => (
        <li
          key={scene.obsSceneName}
          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2"
        >
          <div className="min-w-0">
            <span className="font-medium text-gray-900 dark:text-white">
              {scene.obsSceneName}
            </span>
            {scene.contentTypes.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('guide.firstScene.switchedBy', { types: switchedBy(scene) })}
              </p>
            )}
          </div>
          {isOBSConnected && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                scene.isCustom
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
              }`}
            >
              {scene.isCustom
                ? t('guide.firstScene.missingInOBS')
                : t('guide.firstScene.inOBS')}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
