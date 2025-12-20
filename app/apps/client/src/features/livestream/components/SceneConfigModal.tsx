import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../../ui/button/Button'
import type { OBSScene } from '../types'

interface SceneConfigModalProps {
  scene: OBSScene
  onClose: () => void
  onSave: (data: { displayName?: string; isVisible?: boolean }) => void
}

export function SceneConfigModal({
  scene,
  onClose,
  onSave,
}: SceneConfigModalProps) {
  const { t } = useTranslation('livestream')
  const [displayName, setDisplayName] = useState(scene.displayName)
  const [isVisible, setIsVisible] = useState(scene.isVisible)

  const handleSave = () => {
    onSave({
      displayName: displayName !== scene.displayName ? displayName : undefined,
      isVisible: isVisible !== scene.isVisible ? isVisible : undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('scenes.configure')}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('scenes.displayName')}
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              OBS: {scene.obsSceneName}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {isVisible ? t('scenes.visible') : t('scenes.hidden')}
            </label>
            <button
              type="button"
              role="switch"
              aria-checked={isVisible}
              onClick={() => setIsVisible(!isVisible)}
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                ${isVisible ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}
              `}
            >
              <span
                className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                  ${isVisible ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
