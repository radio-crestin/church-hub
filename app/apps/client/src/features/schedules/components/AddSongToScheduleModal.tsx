import { CalendarDays, Check, Loader2, Plus, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ClearSearchButton } from '~/ui/search'
import { useToast } from '~/ui/toast'
import { useAddItemToSchedule, useSchedules, useUpsertSchedule } from '../hooks'

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

  const handleSave = useCallback(async () => {
    if (!canSave || isSaving) return
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

      const targetIds = [...selectedIds, ...createdIds]
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
  }, [
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
  ])

  const selectedCount = selectedIds.length + namedDrafts.length

  return (
    <dialog
      ref={dialogRef}
      data-testid="add-song-to-schedule-modal"
      className="fixed inset-0 m-auto w-full max-w-2xl p-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl backdrop:bg-black/50"
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose()
      }}
    >
      <div className="flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('modal.addSongTitle')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('modal.addSongDescription')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            title={t('modal.cancel')}
            data-testid="add-song-to-schedule-close"
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Search + inline create */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('modal.searchSchedules')}
              data-testid="add-song-to-schedule-search"
              className="w-full pl-9 pr-8 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {searchQuery && (
              <ClearSearchButton
                inputRef={searchInputRef}
                onClear={() => setSearchQuery('')}
                size={16}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              />
            )}
          </div>
          <button
            type="button"
            onClick={handleAddDraft}
            disabled={isSaving}
            title={t('modal.createNew')}
            data-testid="add-song-to-schedule-new"
            className="shrink-0 p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3 min-h-[240px]">
          <div className="flex flex-col gap-1.5">
            {/* Draft rows sit on top so a freshly created program is visible. */}
            {drafts.map((draft) => (
              <div
                key={draft.key}
                data-testid="schedule-draft-row"
                className="flex items-center gap-2 rounded-lg border border-indigo-300 dark:border-indigo-600 bg-indigo-50/60 dark:bg-indigo-900/20 px-2 py-1.5"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-indigo-500 bg-indigo-500 text-white">
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
                  className="flex-1 min-w-0 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeDraft(draft.key)}
                  title={t('modal.cancel')}
                  className="shrink-0 p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}

            {isLoading ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                ...
              </div>
            ) : filteredSchedules.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <CalendarDays className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
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
                        ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-500 text-white'
                          : 'border-gray-300 dark:border-gray-600 text-transparent'
                      }`}
                    >
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-gray-900 dark:text-white truncate">
                        {schedule.title}
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
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
        <div className="flex items-center justify-between gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            data-testid="add-song-to-schedule-cancel"
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {t('modal.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || isSaving}
            data-testid="add-song-to-schedule-save"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
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
