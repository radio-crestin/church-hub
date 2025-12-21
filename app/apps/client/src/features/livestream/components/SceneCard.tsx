import { useTranslation } from 'react-i18next'

import type { OBSScene } from '../types'

interface SceneCardProps {
  scene: OBSScene
  onSwitch: (sceneName: string) => void
  isSwitching?: boolean
}

export function SceneCard({ scene, onSwitch, isSwitching }: SceneCardProps) {
  const { t } = useTranslation('livestream')

  return (
    <div
      className={`
        relative p-4 rounded-lg border-2 transition-all cursor-pointer
        ${
          scene.isCurrent
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
        }
        ${isSwitching ? 'opacity-50' : ''}
      `}
      onClick={() => !isSwitching && onSwitch(scene.obsSceneName)}
    >
      {scene.isCurrent && (
        <div className="absolute -top-2 -right-2 px-2 py-0.5 text-xs font-bold text-white bg-indigo-500 rounded-full">
          {t('scenes.current')}
        </div>
      )}

      <div>
        <h3 className="font-medium text-gray-900 dark:text-gray-100">
          {scene.displayName}
        </h3>
      </div>
    </div>
  )
}
