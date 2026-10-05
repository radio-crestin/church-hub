import { useTranslation } from 'react-i18next'

import { Combobox, type ComboboxOption } from '~/ui/combobox'
import { useToast } from '~/ui/toast'
import { useUpsertSchedule } from '../hooks'

interface SchedulePanelPickerProps {
  options: ComboboxOption[]
  value: number | null
  onChange: (scheduleId: number | null) => void
  /** Whether a name that is not in the list may become a new program. */
  canCreate: boolean
}

/**
 * Picks the program the panel shows. A name that is not in the list can be
 * made into a new program right from the search.
 */
export function SchedulePanelPicker({
  options,
  value,
  onChange,
  canCreate,
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
    <Combobox
      options={options}
      value={value}
      onChange={(next) =>
        onChange(typeof next === 'number' ? next : Number(next) || null)
      }
      onCreateNew={canCreate ? createNamed : undefined}
      createNewLabel={t('panel.createNamed')}
      placeholder={t('panel.selectSchedule')}
      allowClear={false}
      className="w-full"
      testId="schedule-picker"
    />
  )
}
