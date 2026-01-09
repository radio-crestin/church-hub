import { Keyboard, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppShortcuts } from '~/features/keyboard-shortcuts'
import { ShortcutRecorder } from '~/features/keyboard-shortcuts/components/ShortcutRecorder'
import { ShortcutRecordingProvider } from '~/features/keyboard-shortcuts/context'
import { validateGlobalShortcut } from '~/features/keyboard-shortcuts/utils/shortcutValidation'
import { KioskSettingsSection } from '~/features/kiosk'
import { ScreenManager } from './screen-manager/ScreenManager'

interface ControlRoomSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ControlRoomSettingsModal({
  isOpen,
  onClose,
}: ControlRoomSettingsModalProps) {
  const { t } = useTranslation('presentation')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)
  const isRecordingRef = useRef(false)

  // Shortcuts state
  const { shortcuts, updateActionShortcuts, isSaving } = useAppShortcuts()
  const [nextSlideShortcuts, setNextSlideShortcuts] = useState<string[]>([])
  const [prevSlideShortcuts, setPrevSlideShortcuts] = useState<string[]>([])
  const [shortcutErrors, setShortcutErrors] = useState<Record<string, string>>(
    {},
  )

  // Initialize shortcuts from config when opening
  useEffect(() => {
    if (isOpen) {
      setNextSlideShortcuts(shortcuts.actions.nextSlide?.shortcuts ?? [])
      setPrevSlideShortcuts(shortcuts.actions.prevSlide?.shortcuts ?? [])
      setShortcutErrors({})
    }
  }, [isOpen, shortcuts])

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal()
    } else {
      dialogRef.current?.close()
    }
  }, [isOpen])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleCancel = (e: Event) => {
      e.preventDefault()
      onClose()
    }

    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose])

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    mouseDownTargetRef.current = e.target
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (
      e.target === dialogRef.current &&
      mouseDownTargetRef.current === dialogRef.current
    ) {
      onClose()
    }
  }

  // Shortcut validation
  const validateShortcut = useCallback(
    (shortcut: string, actionId: string, index: number): string | undefined => {
      // Validate against global shortcuts (excluding current action)
      const conflict = validateGlobalShortcut(shortcut, shortcuts, actionId)
      if (conflict) {
        return t('controlRoom.settings.shortcuts.conflict', {
          name: conflict.conflictName,
          defaultValue: 'Already used by "{{name}}"',
        })
      }

      // Check for conflicts within the same action
      const currentList =
        actionId === 'nextSlide' ? nextSlideShortcuts : prevSlideShortcuts
      const duplicateIndex = currentList.findIndex(
        (s, i) => s === shortcut && i !== index,
      )
      if (duplicateIndex !== -1) {
        return t('controlRoom.settings.shortcuts.duplicate', {
          defaultValue: 'Shortcut already added',
        })
      }

      // Check for conflicts between next and prev
      const otherList =
        actionId === 'nextSlide' ? prevSlideShortcuts : nextSlideShortcuts
      if (otherList.includes(shortcut)) {
        return t('controlRoom.settings.shortcuts.conflictOther', {
          defaultValue: 'Already used by the other action',
        })
      }

      return undefined
    },
    [shortcuts, nextSlideShortcuts, prevSlideShortcuts, t],
  )

  // Shortcut handlers
  const handleShortcutChange = useCallback(
    (actionId: 'nextSlide' | 'prevSlide', index: number, value: string) => {
      const setShortcuts =
        actionId === 'nextSlide' ? setNextSlideShortcuts : setPrevSlideShortcuts
      const currentShortcuts =
        actionId === 'nextSlide' ? nextSlideShortcuts : prevSlideShortcuts

      const newShortcuts = [...currentShortcuts]
      newShortcuts[index] = value
      setShortcuts(newShortcuts)

      // Validate and update errors
      const error = validateShortcut(value, actionId, index)
      const errorKey = `${actionId}-${index}`
      setShortcutErrors((prev) => {
        if (error) {
          return { ...prev, [errorKey]: error }
        }
        const { [errorKey]: _, ...rest } = prev
        return rest
      })

      // Save if no error
      if (!error) {
        updateActionShortcuts(actionId, {
          shortcuts: newShortcuts.filter(Boolean),
          enabled: true,
        })
      }
    },
    [
      nextSlideShortcuts,
      prevSlideShortcuts,
      validateShortcut,
      updateActionShortcuts,
    ],
  )

  const handleAddShortcut = useCallback(
    (actionId: 'nextSlide' | 'prevSlide') => {
      const setShortcuts =
        actionId === 'nextSlide' ? setNextSlideShortcuts : setPrevSlideShortcuts
      setShortcuts((prev) => [...prev, ''])
    },
    [],
  )

  const handleRemoveShortcut = useCallback(
    (actionId: 'nextSlide' | 'prevSlide', index: number) => {
      const currentShortcuts =
        actionId === 'nextSlide' ? nextSlideShortcuts : prevSlideShortcuts
      const setShortcuts =
        actionId === 'nextSlide' ? setNextSlideShortcuts : setPrevSlideShortcuts

      const newShortcuts = currentShortcuts.filter((_, i) => i !== index)
      setShortcuts(newShortcuts)

      // Clear any errors for this index and update higher indices
      setShortcutErrors((prev) => {
        const updated: Record<string, string> = {}
        Object.entries(prev).forEach(([key, value]) => {
          const [keyAction, keyIndex] = key.split('-')
          if (keyAction === actionId) {
            const idx = parseInt(keyIndex, 10)
            if (idx < index) {
              updated[key] = value
            } else if (idx > index) {
              updated[`${keyAction}-${idx - 1}`] = value
            }
          } else {
            updated[key] = value
          }
        })
        return updated
      })

      // Save immediately
      updateActionShortcuts(actionId, {
        shortcuts: newShortcuts.filter(Boolean),
        enabled: true,
      })
    },
    [nextSlideShortcuts, prevSlideShortcuts, updateActionShortcuts],
  )

  const handleRecordingChange = useCallback((recording: boolean) => {
    isRecordingRef.current = recording
  }, [])

  if (!isOpen) return null

  return (
    <ShortcutRecordingProvider onRecordingChange={handleRecordingChange}>
      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto w-full max-w-4xl p-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl backdrop:bg-black/50"
        onMouseDown={handleBackdropMouseDown}
        onClick={handleBackdropClick}
      >
        <div className="flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('controlRoom.settings.title')}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Slide Navigation Shortcuts Section */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <Keyboard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {t('controlRoom.settings.shortcuts.title', {
                    defaultValue: 'Slide Navigation Shortcuts',
                  })}
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('controlRoom.settings.shortcuts.description', {
                  defaultValue:
                    'Configure keyboard or MIDI shortcuts to navigate slides.',
                })}
              </p>

              <div className="space-y-4">
                {/* Next Slide Shortcuts */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('controlRoom.settings.shortcuts.nextSlide', {
                      defaultValue: 'Next Slide',
                    })}
                  </label>
                  <div className="space-y-2">
                    {nextSlideShortcuts.map((shortcut, index) => (
                      <ShortcutRecorder
                        key={`next-${index}`}
                        value={shortcut}
                        onChange={(value) =>
                          handleShortcutChange('nextSlide', index, value)
                        }
                        onRemove={() =>
                          handleRemoveShortcut('nextSlide', index)
                        }
                        error={shortcutErrors[`nextSlide-${index}`]}
                        namespace="presentation"
                      />
                    ))}
                    {shortcutErrors[
                      `nextSlide-${nextSlideShortcuts.length - 1}`
                    ] && (
                      <p className="text-xs text-red-500">
                        {
                          shortcutErrors[
                            `nextSlide-${nextSlideShortcuts.length - 1}`
                          ]
                        }
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAddShortcut('nextSlide')}
                      disabled={isSaving}
                      className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                    >
                      <Plus size={16} />
                      {t('controlRoom.settings.shortcuts.addShortcut', {
                        defaultValue: 'Add Shortcut',
                      })}
                    </button>
                  </div>
                </div>

                {/* Previous Slide Shortcuts */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('controlRoom.settings.shortcuts.prevSlide', {
                      defaultValue: 'Previous Slide',
                    })}
                  </label>
                  <div className="space-y-2">
                    {prevSlideShortcuts.map((shortcut, index) => (
                      <ShortcutRecorder
                        key={`prev-${index}`}
                        value={shortcut}
                        onChange={(value) =>
                          handleShortcutChange('prevSlide', index, value)
                        }
                        onRemove={() =>
                          handleRemoveShortcut('prevSlide', index)
                        }
                        error={shortcutErrors[`prevSlide-${index}`]}
                        namespace="presentation"
                      />
                    ))}
                    {shortcutErrors[
                      `prevSlide-${prevSlideShortcuts.length - 1}`
                    ] && (
                      <p className="text-xs text-red-500">
                        {
                          shortcutErrors[
                            `prevSlide-${prevSlideShortcuts.length - 1}`
                          ]
                        }
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAddShortcut('prevSlide')}
                      disabled={isSaving}
                      className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                    >
                      <Plus size={16} />
                      {t('controlRoom.settings.shortcuts.addShortcut', {
                        defaultValue: 'Add Shortcut',
                      })}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Screens Section */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <ScreenManager />
            </div>

            {/* Kiosk Mode Section */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <KioskSettingsSection />
            </div>
          </div>
        </div>
      </dialog>
    </ShortcutRecordingProvider>
  )
}
