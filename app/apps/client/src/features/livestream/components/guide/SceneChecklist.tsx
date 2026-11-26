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
      className="divide-y divide-line rounded-lg border border-line"
      data-testid="livestream-guide-scenes"
    >
      {scenes.map((scene) => (
        <li
          key={scene.obsSceneName}
          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2"
        >
          <div className="min-w-0">
            <span className="text-[13px] font-medium text-fg">
              {scene.obsSceneName}
            </span>
            {scene.contentTypes.length > 0 && (
              <p className="text-xs text-fg-hint">
                {t('guide.firstScene.switchedBy', { types: switchedBy(scene) })}
              </p>
            )}
          </div>
          {isOBSConnected && (
            <span
              className={`inline-flex items-center gap-1.5 text-xs ${
                scene.isCustom
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-fg-hint'
              }`}
            >
              {!scene.isCustom && (
                <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden />
              )}
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
