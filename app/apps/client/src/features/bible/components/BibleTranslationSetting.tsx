import { Book } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useDefaultBibleTranslation } from '../hooks'

export function BibleTranslationSetting() {
  const { t } = useTranslation('settings')
  const { translation, translations, setDefaultTranslation, isLoading } =
    useDefaultBibleTranslation()

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const translationId = parseInt(e.target.value, 10)
    if (!Number.isNaN(translationId)) {
      await setDefaultTranslation.mutateAsync(translationId)
    }
  }

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
        <select
          value={translation?.id ?? ''}
          onChange={handleChange}
          disabled={isLoading || setDefaultTranslation.isPending}
          className="block w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-500 dark:placeholder:text-gray-400"
        >
          {translations.map((trans) => (
            <option key={trans.id} value={trans.id}>
              {trans.name} ({trans.abbreviation})
            </option>
          ))}
        </select>
        <p className="text-gray-600 dark:text-gray-400 text-xs">
          {t('sections.bible.defaultTranslation.description')}
        </p>
      </div>
    </div>
  )
}
