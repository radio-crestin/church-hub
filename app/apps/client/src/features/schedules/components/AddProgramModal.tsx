import { ListTree, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { useAddItemToSchedule, useSchedules } from '../hooks'
import { ItemDialog } from '../media-items/ItemDialog'
import { scheduleContains } from '../utils/scheduleContains'

interface AddProgramModalProps {
  /** The presentation it goes into. */
  scheduleId: number
  /** It goes after this item; without it, at the end. */
  afterItemId?: number
  /** `added` is false when the operator went back without adding. */
  onClose: (added: boolean) => void
}

/**
 * Picks another presentation to play inside this one, in its place: a
 * search, the presentations matching it, and Add. Enter adds the one picked
 * (the first match by default). This one, and any that already plays it, are
 * left out: adding them would make a loop.
 */
export function AddProgramModal({
  scheduleId,
  afterItemId,
  onClose,
}: AddProgramModalProps) {
  const { t } = useTranslation(['schedules', 'common'])
  const { showToast } = useToast()
  const { data: schedules = [] } = useSchedules()
  const addItem = useAddItemToSchedule()
  const [query, setQuery] = useState('')
  const [pickedId, setPickedId] = useState<number | null>(null)

  const needle = query.trim().toLocaleLowerCase()
  const matches = schedules.filter(
    (s) =>
      !scheduleContains(schedules, s.id, scheduleId) &&
      s.title.toLocaleLowerCase().includes(needle),
  )
  const picked = matches.find((s) => s.id === pickedId) ?? matches[0]

  const add = () => {
    if (!picked || addItem.isPending) return
    addItem.mutate(
      { scheduleId, input: { childScheduleId: picked.id, afterItemId } },
      {
        onSuccess: (result) => {
          if (!result.success) {
            showToast(result.error ?? t('schedules:messages.error'), 'error')
            return
          }
          showToast(t('schedules:messages.itemAdded'), 'success')
          onClose(true)
        },
        onError: () => showToast(t('schedules:messages.error'), 'error'),
      },
    )
  }

  return (
    <ItemDialog
      title={t('common:addMenu.program')}
      icon={<ListTree size={16} strokeWidth={1.5} className="text-fg-label" />}
      testId="add-program"
      canSave={!!picked}
      isSaving={addItem.isPending}
      onSave={add}
      onClose={() => onClose(false)}
      saveLabel={t('common:addMenu.button')}
      saveIcon={<Plus size={16} strokeWidth={1.5} />}
    >
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add()
          }
        }}
        autoFocus
        aria-label={t('schedules:addProgram.search')}
        placeholder={t('schedules:addProgram.search')}
        data-testid="add-program-search"
        className="w-full h-9 px-3 text-base md:text-sm bg-field border-0 rounded-[10px] text-fg placeholder:text-fg-hint focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus"
      />
      {matches.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-hint">
          {t('schedules:addProgram.none')}
        </p>
      ) : (
        <div
          role="radiogroup"
          aria-label={t('common:addMenu.program')}
          className="space-y-1"
        >
          {matches.map((schedule) => (
            <button
              key={schedule.id}
              type="button"
              role="radio"
              aria-checked={schedule.id === picked?.id}
              onClick={() => setPickedId(schedule.id)}
              data-testid="add-program-option"
              data-schedule-id={schedule.id}
              className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus ${
                schedule.id === picked?.id
                  ? 'bg-selected text-fg'
                  : 'text-fg-body hover:bg-hover'
              }`}
            >
              <span className="truncate font-medium">{schedule.title}</span>
              <span className="shrink-0 text-xs text-fg-hint tabular-nums">
                {t('schedules:itemCount', { count: schedule.itemCount })}
              </span>
            </button>
          ))}
        </div>
      )}
    </ItemDialog>
  )
}
