import {
  ArrowLeft,
  BookOpen,
  Camera,
  Check,
  FileText,
  Loader2,
  Megaphone,
  Music,
  Plus,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SongSearchPicker } from '~/features/songs/components/SongSearchPicker'
import { useSong } from '~/features/songs/hooks/useSong'
import { stripHtmlTags } from '~/features/songs/utils/stripHtmlTags'
import { Tooltip } from '~/ui/tooltip/Tooltip'
import type { SlideTemplate } from '../types'

type Step = 'menu' | 'song' | 'preview'

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
  // The song being previewed before the operator commits to adding it.
  const [previewSongId, setPreviewSongId] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const { data: previewSong, isLoading: previewLoading } =
    useSong(previewSongId)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen && !dialog.open) {
      setStep('menu')
      setPreviewSongId(null)
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
      // Escape walks back one step at a time before it closes the modal.
      if (step === 'preview') {
        setStep('song')
        return
      }
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

  /** Picking a song shows it; adding is a separate, deliberate step. */
  const handleSongSelect = useCallback((songId: number) => {
    setPreviewSongId(songId)
    setStep('preview')
  }, [])

  const handleConfirmAdd = useCallback(async () => {
    if (previewSongId === null || isAdding) return
    setIsAdding(true)
    try {
      await onAddSong(previewSongId)
      handleClose()
    } finally {
      setIsAdding(false)
    }
  }, [previewSongId, isAdding, onAddSong, handleClose])

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
  const isPreviewStep = step === 'preview'
  // Both the search and the preview want the room; the type menu does not.
  const isLargeStep = isSongStep || isPreviewStep

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
          isLargeStep
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
        <div className={`flex flex-col ${isLargeStep ? 'h-full' : ''}`}>
          {/* Header */}
          <div className="flex items-center justify-between gap-2 p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {isLargeStep && (
                <button
                  type="button"
                  onClick={() => setStep(isPreviewStep ? 'song' : 'menu')}
                  data-testid="add-schedule-item-back"
                  title={
                    isPreviewStep
                      ? t('addMenu.searchSong')
                      : tSchedules('actions.back')
                  }
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {isPreviewStep
                  ? (previewSong?.title ?? t('addMenu.searchSong'))
                  : isSongStep
                    ? t('addMenu.searchSong')
                    : t('addMenu.title')}
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

          {isLargeStep ? (
            <>
              {/* The picker stays mounted behind the preview so stepping back
                  returns to the same query and scroll position instead of an
                  empty search. */}
              <div
                className={`flex-1 min-h-0 flex-col p-4 ${isSongStep ? 'flex' : 'hidden'}`}
              >
                <SongSearchPicker
                  onSongSelect={handleSongSelect}
                  className="flex-1"
                />
              </div>

              {isPreviewStep && (
                <>
                  <div
                    className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-4"
                    data-testid="add-schedule-item-preview"
                  >
                    {previewLoading || !previewSong ? (
                      <div className="flex items-center justify-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                      </div>
                    ) : (
                      <div className="mx-auto max-w-3xl">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          {previewSong.category?.name && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                              {previewSong.category.name}
                            </span>
                          )}
                          {previewSong.keyLine && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                              {previewSong.keyLine}
                            </span>
                          )}
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {tSchedules('modal.slideCount', {
                              count: previewSong.slides.length,
                            })}
                          </span>
                        </div>

                        {previewSong.slides.length === 0 ? (
                          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                            {tSchedules('modal.previewEmpty')}
                          </p>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {previewSong.slides.map((slide, index) => (
                              <div
                                key={slide.id}
                                data-testid="add-schedule-item-preview-slide"
                                className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40"
                              >
                                <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                  {slide.label || `${index + 1}`}
                                </div>
                                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                                  {stripHtmlTags(slide.content)}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer — adding is deliberate, never a side effect of
                      clicking a search result. */}
                  <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-gray-200 p-4 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => setStep('song')}
                      disabled={isAdding}
                      data-testid="add-schedule-item-preview-back"
                      className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                      {t('addMenu.searchSong')}
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmAdd}
                      disabled={isAdding || !previewSong}
                      data-testid="add-schedule-item-preview-add"
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                    >
                      {isAdding ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Check size={16} />
                      )}
                      {tSchedules('modal.addToProgram')}
                    </button>
                  </div>
                </>
              )}
            </>
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
