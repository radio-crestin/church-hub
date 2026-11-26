import { ListChecks, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { useAddPresentationItems, useSchedules } from '../hooks'
import { ItemDialog } from '../media-items/ItemDialog'

interface AddPresentationItemsModalProps {
  /** The presentation the items go into. */
  scheduleId: number
  /** They go after this item; without it, at the end. */
  afterItemId?: number
  /** `added` is false when the operator went back without adding. */
  onClose: (added: boolean) => void
}

/**
 * Picks another presentation and copies its items in, in their order: a
 * search, the presentations matching it, and Add. Enter adds the one picked
 * (the first match by default).
 */
export function AddPresentationItemsModal({
  scheduleId,
  afterItemId,
  onClose,
}: AddPresentationItemsModalProps) {
  const { t } = useTranslation(['schedules', 'common'])
  const { showToast } = useToast()
  const { data: schedules = [] } = useSchedules()
  const addItems = useAddPresentationItems()
  const [query, setQuery] = useState('')
  const [pickedId, setPickedId] = useState<number | null>(null)

  const needle = query.trim().toLocaleLowerCase()
  const matches = schedules.filter(
    (s) =>
      s.id !== scheduleId &&
      s.itemCount > 0 &&
      s.title.toLocaleLowerCase().includes(needle),
  )
  const picked = matches.find((s) => s.id === pickedId) ?? matches[0]

  const add = () => {
    if (!picked || addItems.isPending) return
    addItems.mutate(
      { scheduleId, sourceId: picked.id, afterItemId },
      {
        onSuccess: (count) => {
          showToast(t('schedules:addPresentation.added', { count }), 'success')
          onClose(true)
        },
        onError: () => showToast(t('schedules:messages.error'), 'error'),
      },
    )
  }

  return (
    <ItemDialog
      title={t('common:addMenu.importSchedule.title')}
      icon={
        <ListChecks size={16} strokeWidth={1.5} className="text-fg-label" />
      }
      testId="add-presentation-items"
      canSave={!!picked}
      isSaving={addItems.isPending}
      onSave={add}
      onClose={() => onClose(false)}
      saveLabel={
        picked
          ? t('schedules:addPresentation.add', { count: picked.itemCount })
          : t('common:addMenu.button')
      }
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
        aria-label={t('schedules:addPresentation.search')}
        placeholder={t('schedules:addPresentation.search')}
        data-testid="add-presentation-items-search"
        className="w-full h-9 px-3 text-base md:text-sm bg-field border-0 rounded-[10px] text-fg placeholder:text-fg-hint focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus"
      />
      {matches.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-hint">
          {t('schedules:addPresentation.none')}
        </p>
      ) : (
        <div
          role="radiogroup"
          aria-label={t('common:addMenu.importSchedule.title')}
          className="space-y-1"
        >
          {matches.map((schedule) => (
            <button
              key={schedule.id}
              type="button"
              role="radio"
              aria-checked={schedule.id === picked?.id}
              onClick={() => setPickedId(schedule.id)}
              data-testid="add-presentation-items-option"
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
