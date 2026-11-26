import {
  ArrowLeft,
  BookOpen,
  Camera,
  Check,
  FileText,
  FileUp,
  Film,
  ListMusic,
  ListTree,
  Loader2,
  Megaphone,
  Music,
  Plus,
  Presentation,
  X,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SongSearchPicker } from '~/features/songs/components/SongSearchPicker'
import { useSong } from '~/features/songs/hooks/useSong'
import { stripHtmlTags } from '~/features/songs/utils/stripHtmlTags'
import { Tooltip } from '~/ui/tooltip/Tooltip'
import type { MediaItemType } from '../media-items/types'
import type { SlideTemplate } from '../types'

type Step = 'menu' | 'song' | 'preview'

interface AddScheduleItemModalProps {
  /** Controlled open state. */
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  /** Resolves a picked song; the modal closes once it settles. */
  onAddSong: (songId: number) => void | Promise<void>
  /**
   * Kept for the callers that still wire it up, but no longer reachable from
   * this menu: "Bible Passage" is not a creatable item type any more.
   */
  onAddBiblePassage: () => void
  onAddSlide: (template: SlideTemplate) => void
  onAddScene?: () => void
  /** A music, video or verses item: its settings dialog. */
  onAddMedia?: (type: MediaItemType) => void
  /** A Slides item: added with one title slide. */
  onAddDeck?: () => void
  /** A Slides item from a PowerPoint file the operator picks. */
  onImportPptx?: () => void
  /** Another presentation, played in its place. */
  onAddProgram?: () => void
  /** Where the new item goes, shown above the kinds. */
  placement?: ReactNode
  /**
   * `false` for a host that opens the modal from its own control — the
   * Programe panel, whose "+" can move into its header's "More" menu.
   */
  showTrigger?: boolean
}

interface MenuOption {
  key: string
  icon: typeof Music
  titleKey: string
  descriptionKey: string
  onSelect: () => void
}

const MEDIA_OPTIONS = [
  {
    key: 'music',
    type: 'music',
    icon: ListMusic,
    titleKey: 'addMenu.music',
    descriptionKey: 'addMenu.musicDescription',
  },
  {
    key: 'video',
    type: 'video',
    icon: Film,
    titleKey: 'addMenu.video',
    descriptionKey: 'addMenu.videoDescription',
  },
  {
    key: 'verses',
    type: 'verses',
    icon: BookOpen,
    titleKey: 'addMenu.verses',
    descriptionKey: 'addMenu.versesDescription',
  },
] satisfies (Omit<MenuOption, 'onSelect'> & { type: MediaItemType })[]

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
  onAddSlide,
  onAddScene,
  onAddMedia,
  onAddDeck,
  onImportPptx,
  onAddProgram,
  placement,
  showTrigger = true,
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
  const addButtonRef = useRef<HTMLButtonElement>(null)

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

  // Enter adds the song once its preview is up.
  const canConfirm = step === 'preview' && !!previewSong
  useEffect(() => {
    if (canConfirm) addButtonRef.current?.focus()
  }, [canConfirm])

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

  // Order is the menu: Song, Bible Verses, Announcement, OBS Scene. The old
  // "Bible Passage" item type is no longer creatable — `versete_tineri` is the
  // single Bible option now, so its key stays put while only the label moves to
  // "Versete Biblice".
  const options: MenuOption[] = [
    {
      key: 'song',
      icon: Music,
      titleKey: 'addMenu.song',
      descriptionKey: 'addMenu.songDescription',
      onSelect: () => setStep('song'),
    },
    {
      key: 'verseteTineri',
      icon: FileText,
      titleKey: 'addMenu.verseteTineri',
      descriptionKey: 'addMenu.verseteTineriDescription',
      onSelect: () => handHandoff(() => onAddSlide('versete_tineri')),
    },
    {
      key: 'announcement',
      icon: Megaphone,
      titleKey: 'addMenu.announcement',
      descriptionKey: 'addMenu.announcementDescription',
      onSelect: () => handHandoff(() => onAddSlide('announcement')),
    },
    ...(onAddScene
      ? [
          {
            key: 'scene',
            icon: Camera,
            titleKey: 'addMenu.scene',
            descriptionKey: 'addMenu.sceneDescription',
            onSelect: () => handHandoff(onAddScene),
          } satisfies MenuOption,
        ]
      : []),
    ...(onAddMedia
      ? MEDIA_OPTIONS.map(
          (option): MenuOption => ({
            ...option,
            onSelect: () => handHandoff(() => onAddMedia(option.type)),
          }),
        )
      : []),
    ...(onAddDeck
      ? [
          {
            key: 'slides',
            icon: Presentation,
            titleKey: 'addMenu.slides',
            descriptionKey: 'addMenu.slidesDescription',
            onSelect: () => handHandoff(onAddDeck),
          } satisfies MenuOption,
        ]
      : []),
    ...(onImportPptx
      ? [
          {
            key: 'importPptx',
            icon: FileUp,
            titleKey: 'addMenu.importPptx',
            descriptionKey: 'addMenu.importPptxDescription',
            onSelect: () => handHandoff(onImportPptx),
          } satisfies MenuOption,
        ]
      : []),
    ...(onAddProgram
      ? [
          {
            key: 'program',
            icon: ListTree,
            titleKey: 'addMenu.program',
            descriptionKey: 'addMenu.programDescription',
            onSelect: () => handHandoff(onAddProgram),
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
      {showTrigger && (
        <Tooltip content={t('addMenu.button')} position="bottom">
          <button
            type="button"
            onClick={() => onOpenChange(true)}
            data-testid="schedule-add-item"
            aria-label={t('addMenu.button')}
            className="flex items-center p-2 text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
          >
            <Plus size={16} strokeWidth={1.5} />
          </button>
        </Tooltip>
      )}

      <dialog
        ref={dialogRef}
        data-testid="add-schedule-item-modal"
        onClick={(e) => {
          if (e.target === dialogRef.current) handleClose()
        }}
        // The menu stays compact; the song step expands to ~90% of the viewport
        // so searching the library doesn't happen through a keyhole.
        className={`fixed inset-0 m-auto p-0 bg-panel rounded-[10px] border border-line shadow-popover backdrop:bg-black/50 ${
          isLargeStep
            ? 'h-[90vh] w-[90vw] max-w-none'
            : 'w-[calc(100vw-2rem)] max-w-sm max-h-[90vh]'
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
          <div className="flex items-center justify-between gap-2 p-4 border-b border-line flex-shrink-0">
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
                  className="p-1 rounded hover:bg-hover text-fg-hint"
                >
                  <ArrowLeft size={20} strokeWidth={1.5} />
                </button>
              )}
              <h2 className="text-base font-semibold text-fg truncate">
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
              className="p-1 rounded hover:bg-hover"
            >
              <X size={20} className="text-fg-hint" strokeWidth={1.5} />
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
                        <Loader2 className="w-6 h-6 animate-spin text-fg" />
                      </div>
                    ) : (
                      <div className="mx-auto max-w-3xl">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          {previewSong.category?.name && (
                            <span className="rounded-full bg-field px-2 py-0.5 text-xs text-fg-label">
                              {previewSong.category.name}
                            </span>
                          )}
                          {previewSong.keyLine && (
                            <span className="text-xs font-medium text-key">
                              {previewSong.keyLine}
                            </span>
                          )}
                          <span className="text-xs text-fg-hint">
                            {tSchedules('modal.slideCount', {
                              count: previewSong.slides.length,
                            })}
                          </span>
                        </div>

                        {previewSong.slides.length === 0 ? (
                          <p className="py-8 text-center text-sm text-fg-hint">
                            {tSchedules('modal.previewEmpty')}
                          </p>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {previewSong.slides.map((slide, index) => (
                              <div
                                key={slide.id}
                                data-testid="add-schedule-item-preview-slide"
                                className="rounded-lg border border-line bg-app p-3"
                              >
                                <div className="mb-1 text-xs font-medium text-fg-hint">
                                  {slide.label || `${index + 1}`}
                                </div>
                                <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg-body">
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
                  <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-line p-4">
                    <button
                      type="button"
                      onClick={() => setStep('song')}
                      disabled={isAdding}
                      data-testid="add-schedule-item-preview-back"
                      className="rounded-lg bg-field h-9 px-3.5 text-sm font-medium text-fg-body transition-colors hover:bg-selected disabled:opacity-50"
                    >
                      {t('addMenu.searchSong')}
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmAdd}
                      disabled={isAdding || !previewSong}
                      ref={addButtonRef}
                      data-testid="add-schedule-item-preview-add"
                      className="inline-flex items-center gap-2 rounded-lg bg-primary h-9 px-3.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isAdding ? (
                        <Loader2
                          size={16}
                          className="animate-spin"
                          strokeWidth={1.5}
                        />
                      ) : (
                        <Check size={16} strokeWidth={1.5} />
                      )}
                      {tSchedules('modal.addToProgram')}
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="p-4 space-y-2 overflow-y-auto scrollbar-thin">
              {placement}
              {options.map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={option.onSelect}
                    data-testid={`add-schedule-item-${option.key}`}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-fg-body hover:bg-hover rounded-lg transition-colors"
                  >
                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
                      <Icon
                        size={20}
                        strokeWidth={1.5}
                        className="text-fg-label"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium">{t(option.titleKey)}</div>
                      <div className="text-sm text-fg-hint">
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
