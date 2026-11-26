import { useTranslation } from 'react-i18next'

import { KeyboardShortcutBadge } from '~/ui/kbd'
import type { OBSScene } from '../types'

interface SceneCardProps {
  scene: OBSScene
  onSwitch: (sceneName: string) => void
  isOBSConnected?: boolean
}

export function SceneCard({
  scene,
  onSwitch,
  isOBSConnected = true,
}: SceneCardProps) {
  const { t } = useTranslation('livestream')

  // When OBS is disconnected or scene is custom, the current scene is not confirmed by OBS
  const isUnconfirmedCurrent =
    scene.isCurrent && (!isOBSConnected || scene.isCustom)

  return (
    <div
      className={`relative cursor-pointer rounded-lg p-4 transition-colors ${
        scene.isCurrent
          ? 'bg-live-tint ring-1 ring-inset ring-live'
          : 'bg-field hover:bg-hover'
      }`}
      onClick={() => onSwitch(scene.obsSceneName)}
    >
      {scene.isCurrent && (
        <div
          className={`absolute -top-2 -right-2 rounded-md bg-panel px-1.5 py-0.5 text-[11px] font-medium text-live ring-1 ring-inset ring-live ${
            isUnconfirmedCurrent ? 'opacity-60' : ''
          }`}
        >
          {t('scenes.current')}
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-fg">{scene.displayName}</h3>
        {scene.shortcuts && scene.shortcuts.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {scene.shortcuts.map((shortcut) => (
              <KeyboardShortcutBadge key={shortcut} shortcut={shortcut} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
