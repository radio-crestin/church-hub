import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Combobox, type ComboboxOption } from '~/ui/combobox'
import { useToast } from '~/ui/toast'
import { useUpsertSchedule } from '../hooks'

interface SchedulePanelPickerProps {
  options: ComboboxOption[]
  value: number | null
  onChange: (scheduleId: number | null) => void
  /** Opens the "new program" dialog; absent without permission to create. */
  onNewProgram?: () => void
}

/**
 * Picks the program the panel shows. A name that is not in the list can be
 * made into a new program right from the search, and "+" opens the dialog
 * (with "Today").
 */
export function SchedulePanelPicker({
  options,
  value,
  onChange,
  onNewProgram,
}: SchedulePanelPickerProps) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  const upsertSchedule = useUpsertSchedule()

  async function createNamed(title: string): Promise<ComboboxOption | null> {
    const result = await upsertSchedule.mutateAsync({ title })
    if (!result.success || !result.data) {
      showToast(t('messages.error'), 'error')
      return null
    }
    showToast(t('messages.saved'), 'success')
    return { value: result.data.id, label: result.data.title }
  }

  return (
    <div className="flex items-center gap-2">
      <Combobox
        options={options}
        value={value}
        onChange={(next) =>
          onChange(typeof next === 'number' ? next : Number(next) || null)
        }
        onCreateNew={onNewProgram ? createNamed : undefined}
        createNewLabel={t('panel.createNamed')}
        placeholder={t('panel.selectSchedule')}
        allowClear={false}
        className="min-w-0 flex-1"
        testId="schedule-picker"
      />
      {onNewProgram && (
        <button
          type="button"
          onClick={onNewProgram}
          data-testid="schedule-picker-new"
          aria-label={t('panel.newSchedule')}
          title={t('panel.newSchedule')}
          className="shrink-0 p-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
