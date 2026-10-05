import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { MultiSelectCombobox } from '~/ui/combobox'
import { useCategories } from '../hooks'

interface SongCategoryFilterProps {
  value: number[]
  onChange: (categoryIds: number[]) => void
  /** Needed inside a modal `<dialog>`, whose top layer hides body portals. */
  portalContainer?: HTMLElement | null
  className?: string
}

/**
 * Category multi-select shared by the Songs page and the song picker. Hidden
 * categories are left out: their songs never show up in lists or search.
 */
export function SongCategoryFilter({
  value,
  onChange,
  portalContainer,
  className,
}: SongCategoryFilterProps) {
  const { t } = useTranslation('songs')
  const { data: categories } = useCategories()
  const options = useMemo(
    () =>
      (categories ?? [])
        .filter((category) => category.isHidden !== 1)
        .map((category) => ({ value: category.id, label: category.name })),
    [categories],
  )

  return (
    <MultiSelectCombobox
      options={options}
      value={value}
      onChange={(ids) => onChange(ids.filter((id) => typeof id === 'number'))}
      placeholder={t('search.allCategories')}
      allSelectedLabel={t('search.allCategories')}
      emptyMeansAll
      portalContainer={portalContainer}
      className={className}
    />
  )
}
