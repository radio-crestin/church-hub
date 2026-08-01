import {
  ArrowLeft,
  BookOpen,
  Camera,
  FileText,
  Megaphone,
  Music,
  Plus,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SongSearchPicker } from '~/features/songs/components/SongSearchPicker'
import { Tooltip } from '~/ui/tooltip/Tooltip'
import type { SlideTemplate } from '../types'

type Step = 'menu' | 'song'

interface AddScheduleItemModalProps {
  /** Controlled open state. */
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  /** Resolves a picked song; the modal closes once it settles. */
  onAddSong: (songId: number) => void | Promise<void>
  onAddBiblePassage: () => void
  onAddSlide: (template: SlideTemplate) => void
  onAddScene?: () => void
}

interface MenuOption {
  key: string
  icon: typeof Music
  iconClass: string
  bgClass: string
  titleKey: string
  descriptionKey: string
  onSelect: () => void
}

/**
 * The single "add to program" modal.
 *
 * Picking a song used to open a second, much smaller dialog on top of this one.
 * Now the song search lives in this same dialog as a second step, which grows
 * to near full screen (~5% margin) so the library is actually browsable, with a
 * back arrow to return to the type menu. The remaining types still hand off to
 * their dedicated editors, which reopen this menu when dismissed — so "back"
 * works for every branch.
 */
export function AddScheduleItemModal({
  isOpen,
  onOpenChange,
  onAddSong,
  onAddBiblePassage,
  onAddSlide,
  onAddScene,
}: AddScheduleItemModalProps) {
  const { t } = useTranslation('common')
  const { t: tSchedules } = useTranslation('schedules')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [step, setStep] = useState<Step>('menu')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen && !dialog.open) {
      setStep('menu')
      dialog.showModal()
    } else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  const handleClose = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleCancel = (e: Event) => {
      e.preventDefault()
      // Escape steps back to the menu before it closes the modal.
      if (step === 'song') {
        setStep('menu')
        return
      }
      handleClose()
    }
    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [handleClose, step])

  /** Hands off to a dedicated editor: close this modal, then run the action. */
  const handHandoff = useCallback(
    (action: () => void) => {
      handleClose()
      action()
    },
    [handleClose],
  )

  const handleSongSelect = useCallback(
    async (songId: number) => {
      await onAddSong(songId)
      handleClose()
    },
    [onAddSong, handleClose],
  )

  const options: MenuOption[] = [
    {
      key: 'song',
      icon: Music,
      iconClass: 'text-indigo-600 dark:text-indigo-400',
      bgClass: 'bg-indigo-100 dark:bg-indigo-900/30',
      titleKey: 'addMenu.searchSong',
      descriptionKey: 'addMenu.searchSongDescription',
      onSelect: () => setStep('song'),
    },
    {
      key: 'biblePassage',
      icon: BookOpen,
      iconClass: 'text-teal-600 dark:text-teal-400',
      bgClass: 'bg-teal-100 dark:bg-teal-900/30',
      titleKey: 'addMenu.biblePassage',
      descriptionKey: 'addMenu.biblePassageDescription',
      onSelect: () => handHandoff(onAddBiblePassage),
    },
    {
      key: 'announcement',
      icon: Megaphone,
      iconClass: 'text-orange-600 dark:text-orange-400',
      bgClass: 'bg-orange-100 dark:bg-orange-900/30',
      titleKey: 'addMenu.announcement',
      descriptionKey: 'addMenu.announcementDescription',
      onSelect: () => handHandoff(() => onAddSlide('announcement')),
    },
    {
      key: 'verseteTineri',
      icon: FileText,
      iconClass: 'text-green-600 dark:text-green-400',
      bgClass: 'bg-green-100 dark:bg-green-900/30',
      titleKey: 'addMenu.verseteTineri',
      descriptionKey: 'addMenu.verseteTineriDescription',
      onSelect: () => handHandoff(() => onAddSlide('versete_tineri')),
    },
    ...(onAddScene
      ? [
          {
            key: 'scene',
            icon: Camera,
            iconClass: 'text-violet-600 dark:text-violet-400',
            bgClass: 'bg-violet-100 dark:bg-violet-900/30',
            titleKey: 'addMenu.scene',
            descriptionKey: 'addMenu.sceneDescription',
            onSelect: () => handHandoff(onAddScene),
          } satisfies MenuOption,
        ]
      : []),
  ]

  const isSongStep = step === 'song'

  return (
    <>
      <Tooltip content={t('addMenu.button')} position="bottom">
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          data-testid="schedule-add-item"
          className="flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 text-sm text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-lg transition-colors"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">{t('addMenu.button')}</span>
        </button>
      </Tooltip>

      <dialog
        ref={dialogRef}
        data-testid="add-schedule-item-modal"
        onClick={(e) => {
          if (e.target === dialogRef.current) handleClose()
        }}
        // The menu stays compact; the song step expands to ~90% of the viewport
        // so searching the library doesn't happen through a keyhole.
        className={`fixed inset-0 m-auto p-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl backdrop:bg-black/50 ${
          isSongStep
            ? 'h-[90vh] w-[90vw] max-w-none'
            : 'w-full max-w-sm max-h-[90vh]'
        }`}
      >
        {/* `h-full` only in the song step. The menu step's dialog has no
            explicit height, so a full-height child would resolve against `auto`
            and collapse to zero — leaving a visible backdrop with no modal. */}
        {/* `h-full` only where the dialog has an explicit height. In the menu
            step its height is content-driven, and a percentage height against
            an auto-height parent is a dependency worth not having. */}
        <div className={`flex flex-col ${isSongStep ? 'h-full' : ''}`}>
          {/* Header */}
          <div className="flex items-center justify-between gap-2 p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {isSongStep && (
                <button
                  type="button"
                  onClick={() => setStep('menu')}
                  data-testid="add-schedule-item-back"
                  title={tSchedules('actions.back')}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {isSongStep ? t('addMenu.searchSong') : t('addMenu.title')}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {isSongStep ? (
            <div className="flex flex-1 min-h-0 flex-col p-4">
              <SongSearchPicker
                onSongSelect={handleSongSelect}
                className="flex-1"
              />
            </div>
          ) : (
            <div className="p-4 space-y-2 overflow-y-auto scrollbar-thin">
              {options.map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={option.onSelect}
                    data-testid={`add-schedule-item-${option.key}`}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${option.bgClass}`}
                    >
                      <Icon size={20} className={option.iconClass} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium">{t(option.titleKey)}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {t(option.descriptionKey)}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </dialog>
    </>
  )
}
