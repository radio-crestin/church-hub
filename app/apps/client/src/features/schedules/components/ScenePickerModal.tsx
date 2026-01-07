import { Camera, Loader2, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useOBSScenes } from '~/features/livestream/hooks/useOBSScenes'

export interface ScenePickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSceneSelect: (obsSceneName: string, displayName: string) => void
}

export function ScenePickerModal({
  isOpen,
  onClose,
  onSceneSelect,
}: ScenePickerModalProps) {
  const { t } = useTranslation('schedules')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { scenes, isLoading } = useOBSScenes(true)

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal()
    } else {
      dialogRef.current?.close()
    }
  }, [isOpen])

  const handleSceneClick = (obsSceneName: string, displayName: string) => {
    onSceneSelect(obsSceneName, displayName)
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose()
      }}
      className="fixed inset-0 m-auto w-full max-w-sm p-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl backdrop:bg-black/50"
    >
      <div className="flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('scenePicker.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Scene List */}
        <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="animate-spin text-gray-400" size={24} />
            </div>
          ) : scenes.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-4">
              {t('scenePicker.noScenes')}
            </div>
          ) : (
            scenes.map((scene) => (
              <button
                key={scene.id || scene.obsSceneName}
                type="button"
                onClick={() =>
                  handleSceneClick(scene.obsSceneName, scene.displayName)
                }
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <Camera
                    size={20}
                    className="text-violet-600 dark:text-violet-400"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {scene.displayName}
                  </div>
                  {scene.obsSceneName !== scene.displayName && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {scene.obsSceneName}
                    </div>
                  )}
                </div>
                {scene.isCurrent && (
                  <span className="flex-shrink-0 text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded">
                    {t('scenePicker.current')}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </dialog>
  )
}
