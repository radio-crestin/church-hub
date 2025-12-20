import { useTranslation } from 'react-i18next'

import type { OBSScene } from '../types'

interface SceneCardProps {
  scene: OBSScene
  onSwitch: (sceneName: string) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onConfigure?: () => void
  isFirst?: boolean
  isLast?: boolean
  isSwitching?: boolean
}

export function SceneCard({
  scene,
  onSwitch,
  onMoveUp,
  onMoveDown,
  onConfigure,
  isFirst,
  isLast,
  isSwitching,
}: SceneCardProps) {
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

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            {scene.displayName}
          </h3>
          {scene.displayName !== scene.obsSceneName && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {scene.obsSceneName}
            </p>
          )}
        </div>

        <div
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {onMoveUp && !isFirst && (
            <button
              type="button"
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              onClick={onMoveUp}
              title={t('scenes.moveUp')}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 15l7-7 7 7"
                />
              </svg>
            </button>
          )}
          {onMoveDown && !isLast && (
            <button
              type="button"
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              onClick={onMoveDown}
              title={t('scenes.moveDown')}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          )}
          {onConfigure && (
            <button
              type="button"
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              onClick={onConfigure}
              title={t('scenes.configure')}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
