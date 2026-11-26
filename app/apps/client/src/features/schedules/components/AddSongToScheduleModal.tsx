import { CalendarDays, Check, Loader2, Plus, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ClearSearchButton } from '~/ui/search'
import { useToast } from '~/ui/toast'
import { TodayProgramButton } from './TodayProgramButton'
import {
  useAddItemToSchedule,
  useCreateTodayProgram,
  useSchedules,
  useUpsertSchedule,
} from '../hooks'

/** A program the operator is creating inline, not persisted until Save. */
interface DraftSchedule {
  key: string
  title: string
}

interface AddSongToScheduleModalProps {
  isOpen: boolean
  songId?: number
  songIds?: number[]
  onClose: () => void
  onAdded?: (scheduleId: number) => void
}

/**
 * Picks one or more programs to add the current song(s) to.
 *
 * Everything is staged locally and only committed on Save: ticking programs,
 * and creating brand-new ones through the "+" next to the search box. Cancel,
 * the X and the backdrop all discard the whole selection — nothing reaches a
 * program until the operator commits.
 */
export function AddSongToScheduleModal({
  isOpen,
  songId,
  songIds,
  onClose,
  onAdded,
}: AddSongToScheduleModalProps) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const draftInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const { data: schedules = [], isLoading } = useSchedules()
  const addToSchedule = useAddItemToSchedule()
  const upsertSchedule = useUpsertSchedule()
  const todayProgram = useCreateTodayProgram()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [drafts, setDrafts] = useState<DraftSchedule[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const draftSeq = useRef(0)

  const effectiveSongIds = useMemo(
    () => songIds ?? (songId ? [songId] : []),
    [songIds, songId],
  )

  // Every open starts from a clean slate — a stale tick from a previous song
  // would silently add it to the wrong program.
  useEffect(() => {
    if (!isOpen) return
    setSearchQuery('')
    setSelectedIds([])
    setDrafts([])
    setIsSaving(false)
  }, [isOpen])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen && !dialog.open) {
      dialog.showModal()
    } else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  const handleClose = useCallback(() => {
    if (isSaving) return
    dialogRef.current?.close()
    onClose()
  }, [isSaving, onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleCancel = (e: Event) => {
      e.preventDefault()
      handleClose()
    }
    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [handleClose])

  const filteredSchedules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return schedules
    return schedules.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q),
    )
  }, [schedules, searchQuery])

  const toggleSchedule = useCallback((id: number) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    )
  }, [])

  /** Adds an editable row seeded with whatever is currently typed in search. */
  const handleAddDraft = useCallback(() => {
    draftSeq.current += 1
    const key = `draft-${draftSeq.current}`
    setDrafts((current) => [...current, { key, title: searchQuery.trim() }])
    setTimeout(() => draftInputRefs.current[key]?.focus(), 0)
  }, [searchQuery])

  const updateDraft = useCallback((key: string, title: string) => {
    setDrafts((current) =>
      current.map((draft) => (draft.key === key ? { ...draft, title } : draft)),
    )
  }, [])

  /** An emptied draft row disappears — that is how the operator cancels it. */
  const commitDraft = useCallback((key: string) => {
    setDrafts((current) =>
      current.filter((draft) => draft.key !== key || draft.title.trim() !== ''),
    )
  }, [])

  const removeDraft = useCallback((key: string) => {
    setDrafts((current) => current.filter((draft) => draft.key !== key))
  }, [])

  const namedDrafts = useMemo(
    () => drafts.filter((draft) => draft.title.trim() !== ''),
    [drafts],
  )
  const canSave =
    effectiveSongIds.length > 0 &&
    (selectedIds.length > 0 || namedDrafts.length > 0)

  /**
   * Adds the song(s) to every ticked program and every named draft, plus
   * `extraScheduleIds` — the "Today" button's program, saved in the same click.
   */
  const saveTo = useCallback(
    async (extraScheduleIds: number[] = []) => {
      if (isSaving || effectiveSongIds.length === 0) return
      if (!canSave && extraScheduleIds.length === 0) return
      setIsSaving(true)

      try {
        // Create the inline programs first so their songs land in the same pass.
        const createdIds: number[] = []
        for (const draft of namedDrafts) {
          const result = await upsertSchedule.mutateAsync({
            title: draft.title.trim(),
          })
          if (!result.success || !result.data?.id) {
            showToast(t('messages.error'), 'error')
            setIsSaving(false)
            return
          }
          createdIds.push(result.data.id)
        }

        const targetIds = [
          ...new Set([...extraScheduleIds, ...selectedIds, ...createdIds]),
        ]
        for (const scheduleId of targetIds) {
          for (const id of effectiveSongIds) {
            const result = await addToSchedule.mutateAsync({
              scheduleId,
              input: { songId: id },
            })
            if (!result.success) {
              showToast(t('messages.error'), 'error')
              setIsSaving(false)
              return
            }
          }
        }

        const firstTarget = targetIds[0]
        showToast(
          t('modal.addedToSchedules', { count: targetIds.length }),
          'success',
          firstTarget
            ? {
                duration: 5000,
                action: {
                  label: t('modal.goToSchedule'),
                  onClick: () => onAdded?.(firstTarget),
                },
              }
            : undefined,
        )
        setIsSaving(false)
        handleClose()
      } catch {
        showToast(t('messages.error'), 'error')
        setIsSaving(false)
      }
    },
    [
      canSave,
      isSaving,
      namedDrafts,
      selectedIds,
      effectiveSongIds,
      upsertSchedule,
      addToSchedule,
      showToast,
      t,
      onAdded,
      handleClose,
    ],
  )

  const handleSave = useCallback(() => saveTo(), [saveTo])

  /** Today's program, made (or found) and saved to in one click. */
  const handleToday = useCallback(async () => {
    const todayId = await todayProgram.createTodayProgram()
    if (todayId === null) {
      showToast(t('messages.error'), 'error')
      return
    }
    await saveTo([todayId])
  }, [todayProgram, saveTo, showToast, t])

  const selectedCount = selectedIds.length + namedDrafts.length

  // The song page mounts this modal twice (toolbar + "add all bookmarks").
  // Keeping a closed <dialog> in the DOM would leave two identical, invisible
  // dialogs behind, so a closed instance renders nothing at all.
  if (!isOpen) return null

  return (
    <dialog
      ref={dialogRef}
      data-testid="add-song-to-schedule-modal"
      className="fixed inset-0 m-auto w-full max-w-2xl p-0 bg-panel rounded-xl shadow-xl backdrop:bg-black/50"
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose()
      }}
    >
      <div className="flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 border-b border-line">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-fg">
              {t('modal.addSongTitle')}
            </h2>
            <p className="text-sm text-fg-hint">
              {t('modal.addSongDescription')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            title={t('modal.cancel')}
            data-testid="add-song-to-schedule-close"
            className="p-1 rounded hover:bg-hover disabled:opacity-50"
          >
            <X size={20} className="text-fg-hint" strokeWidth={1.5} />
          </button>
        </div>

        {/* Search + inline create */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
          <div className="relative flex-1 min-w-0">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-hint"
              strokeWidth={1.5}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('modal.searchSchedules')}
              data-testid="add-song-to-schedule-search"
              className="w-full pl-9 pr-8 py-2 text-sm bg-app border border-line rounded-lg text-fg placeholder:text-fg-hint focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus"
            />
            {searchQuery && (
              <ClearSearchButton
                inputRef={searchInputRef}
                onClear={() => setSearchQuery('')}
                size={16}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-hint hover:text-fg-label"
              />
            )}
          </div>
          <button
            type="button"
            onClick={handleAddDraft}
            disabled={isSaving}
            title={t('modal.createNew')}
            data-testid="add-song-to-schedule-new"
            className="shrink-0 p-2 rounded-lg bg-primary text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <Plus size={18} />
          </button>
          <TodayProgramButton
            onClick={handleToday}
            disabled={isSaving || effectiveSongIds.length === 0}
            isPending={todayProgram.isPending}
            testId="add-song-to-schedule-today"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3 min-h-[240px]">
          <div className="flex flex-col gap-1.5">
            {/* Draft rows sit on top so a freshly created program is visible. */}
            {drafts.map((draft) => (
              <div
                key={draft.key}
                data-testid="schedule-draft-row"
                className="flex items-center gap-2 rounded-lg border border-line-strong bg-selected px-2 py-1.5"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line-strong bg-primary text-white">
                  <Check size={12} strokeWidth={3} />
                </span>
                <input
                  ref={(el) => {
                    draftInputRefs.current[draft.key] = el
                  }}
                  type="text"
                  value={draft.title}
                  onChange={(e) => updateDraft(draft.key, e.target.value)}
                  onBlur={() => commitDraft(draft.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitDraft(draft.key)
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      e.stopPropagation()
                      removeDraft(draft.key)
                    }
                  }}
                  placeholder={t('modal.scheduleName')}
                  className="flex-1 min-w-0 bg-transparent text-sm text-fg placeholder:text-fg-hint focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeDraft(draft.key)}
                  title={t('modal.cancel')}
                  className="shrink-0 p-1 text-fg-hint hover:text-red-500 dark:hover:text-red-400 rounded transition-colors"
                >
                  <X size={14} strokeWidth={1.75} />
                </button>
              </div>
            ))}

            {isLoading ? (
              <div className="px-4 py-8 text-center text-sm text-fg-hint">
                ...
              </div>
            ) : filteredSchedules.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <CalendarDays className="w-8 h-8 mx-auto mb-2 text-fg-hint" />
                <p className="text-sm text-fg-hint">
                  {searchQuery.trim()
                    ? t('search.noResults', { query: searchQuery })
                    : t('noSchedules')}
                </p>
              </div>
            ) : (
              filteredSchedules.map((schedule) => {
                const isSelected = selectedIds.includes(schedule.id)
                return (
                  <button
                    key={schedule.id}
                    type="button"
                    onClick={() => toggleSchedule(schedule.id)}
                    aria-pressed={isSelected}
                    data-testid="schedule-option"
                    className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-left transition-colors ${
                      isSelected
                        ? 'border-line-strong bg-selected'
                        : 'border-line bg-panel hover:border-line-strong hover:bg-hover'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        isSelected
                          ? 'border-line-strong bg-primary text-white'
                          : 'border-line text-transparent'
                      }`}
                    >
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-fg truncate">
                        {schedule.title}
                      </span>
                      <span className="block text-xs text-fg-hint">
                        {t('panel.songCount', { count: schedule.songCount })}
                      </span>
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-line">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            data-testid="add-song-to-schedule-cancel"
            className="h-9 px-3.5 text-sm font-medium text-fg-body bg-field hover:bg-selected rounded-lg transition-colors disabled:opacity-50"
          >
            {t('modal.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || isSaving}
            data-testid="add-song-to-schedule-save"
            className="inline-flex items-center gap-2 h-9 px-3.5 text-sm font-medium text-white bg-primary hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className="animate-spin" strokeWidth={1.5} />
                {t('modal.adding')}
              </>
            ) : (
              <>
                {t('actions.save')}
                {selectedCount > 0 && (
                  <span className="opacity-70">({selectedCount})</span>
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </dialog>
  )
}
