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
      className="fixed inset-0 m-auto w-full max-w-sm p-0 bg-panel rounded-xl shadow-xl backdrop:bg-black/50"
    >
      <div className="flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-line">
          <h2 className="text-base font-semibold text-fg">
            {t('scenePicker.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-hover"
          >
            <X size={20} className="text-fg-hint" strokeWidth={1.5} />
          </button>
        </div>

        {/* Scene List */}
        <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="animate-spin text-fg-hint" size={24} />
            </div>
          ) : scenes.length === 0 ? (
            <div className="text-center text-fg-hint py-4">
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
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-fg-body hover:bg-hover rounded-lg transition-colors"
              >
                <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
                  <Camera size={20} className="text-fg" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {scene.displayName}
                  </div>
                  {scene.obsSceneName !== scene.displayName && (
                    <div className="text-[13px] text-fg-hint truncate">
                      {scene.obsSceneName}
                    </div>
                  )}
                </div>
                {scene.isCurrent && (
                  <span className="flex-shrink-0 text-xs text-fg-label px-2 py-0.5 rounded">
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
