import { Book } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Combobox, type ComboboxOption } from '~/ui/combobox'
import { useDefaultBibleTranslation } from '../hooks'

export function BibleTranslationSetting() {
  const { t } = useTranslation('settings')
  const { translation, translations, setDefaultTranslation, isLoading } =
    useDefaultBibleTranslation()

  const options: ComboboxOption[] = useMemo(
    () =>
      translations.map((trans) => ({
        value: trans.id,
        label: `${trans.name} (${trans.abbreviation})`,
      })),
    [translations],
  )

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {t('sections.bible.title')}
      </h3>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Book className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <label className="text-sm font-medium text-gray-900 dark:text-white">
            {t('sections.bible.defaultTranslation.title')}
          </label>
        </div>
        <Combobox
          options={options}
          value={translation?.id ?? null}
          onChange={(val) =>
            val && setDefaultTranslation.mutateAsync(val as number)
          }
          disabled={isLoading || setDefaultTranslation.isPending}
          allowClear={false}
        />
        <p className="text-gray-600 dark:text-gray-400 text-xs">
          {t('sections.bible.defaultTranslation.description')}
        </p>
      </div>
    </div>
  )
}
