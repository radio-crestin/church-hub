import { useMemo } from 'react'

import { Combobox, type ComboboxOption } from '~/ui/combobox'
import type { BibleTranslation } from '../types'

interface TranslationSelectorProps {
  translations: BibleTranslation[]
  selectedId: number | undefined
  onSelect: (id: number) => void
  isLoading?: boolean
}

export function TranslationSelector({
  translations,
  selectedId,
  onSelect,
  isLoading,
}: TranslationSelectorProps) {
  const options: ComboboxOption[] = useMemo(
    () =>
      translations.map((trans) => ({
        value: trans.id,
        label: `${trans.abbreviation} - ${trans.name}`,
      })),
    [translations],
  )

  if (isLoading) {
    return (
      <div className="h-9 w-32 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
    )
  }

  if (translations.length === 0) {
    return null
  }

  return (
    <Combobox
      options={options}
      value={selectedId ?? null}
      onChange={(val) => val && onSelect(val as number)}
      allowClear={false}
    />
  )
}
