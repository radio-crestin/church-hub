import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Combobox, type ComboboxOption } from '~/ui/combobox'
import { useCategories, useUpsertCategory } from '../hooks'

interface CategoryPickerProps {
  value: number | null
  onChange: (value: number | null) => void
  disabled?: boolean
  portalContainer?: HTMLElement | null
}

export function CategoryPicker({
  value,
  onChange,
  disabled,
  portalContainer,
}: CategoryPickerProps) {
  const { t } = useTranslation('songs')
  const { data: categories } = useCategories()
  const upsertCategory = useUpsertCategory()

  const options: ComboboxOption[] = useMemo(
    () =>
      categories?.map((cat) => ({
        value: cat.id,
        label: cat.name,
      })) ?? [],
    [categories],
  )

  const handleCreateNew = async (
    name: string,
  ): Promise<ComboboxOption | null> => {
    const result = await upsertCategory.mutateAsync({ name })
    if (result.success && result.category) {
      return {
        value: result.category.id,
        label: result.category.name,
      }
    }
    return null
  }

  return (
    <Combobox
      options={options}
      value={value}
      onChange={(val) => onChange(val as number | null)}
      onCreateNew={handleCreateNew}
      placeholder={t('editor.categoryPlaceholder')}
      createNewLabel={t('category.create')}
      disabled={disabled}
      portalContainer={portalContainer}
    />
  )
}
