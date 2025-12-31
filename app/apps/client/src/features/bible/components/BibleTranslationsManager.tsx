import { Book, Loader2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Combobox } from '~/ui/combobox'
import { useToast } from '~/ui/toast'
import { useSelectedBibleTranslations } from '../hooks/useSelectedBibleTranslations'

interface BibleTranslationsManagerProps {
  portalContainer?: HTMLElement | null
}

export function BibleTranslationsManager({ portalContainer }: BibleTranslationsManagerProps) {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()

  const {
    translations,
    primaryTranslation,
    secondaryTranslation,
    setPrimaryTranslation,
    setSecondaryTranslation,
    isLoading,
  } = useSelectedBibleTranslations()

  // Convert translations to Combobox options
  const primaryOptions = useMemo(
    () =>
      translations.map((translation) => ({
        value: translation.id,
        label: `${translation.name} (${translation.abbreviation})`,
      })),
    [translations]
  )

  // Get available translations for secondary (exclude primary)
  const secondaryOptions = useMemo(
    () =>
      translations
        .filter((t) => t.id !== primaryTranslation?.id)
        .map((translation) => ({
          value: translation.id,
          label: `${translation.name} (${translation.abbreviation})`,
        })),
    [translations, primaryTranslation?.id]
  )

  const handlePrimaryChange = async (value: number | string | null) => {
    try {
      if (value === null) {
        await setPrimaryTranslation(null)
      } else {
        await setPrimaryTranslation(Number(value))
      }
      showToast(t('sections.bible.toast.saved'), 'success')
    } catch {
      showToast(t('sections.bible.toast.error'), 'error')
    }
  }

  const handleSecondaryChange = async (value: number | string | null) => {
    try {
      if (value === null) {
        await setSecondaryTranslation(null)
      } else {
        await setSecondaryTranslation(Number(value))
      }
      showToast(t('sections.bible.toast.saved'), 'success')
    } catch {
      showToast(t('sections.bible.toast.error'), 'error')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Book className="w-5 h-5" />
          {t('sections.bible.title')}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {t('sections.bible.description')}
        </p>
      </div>

      {translations.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
          <Book className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            {t('sections.bible.noTranslations')}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            {t('sections.bible.noTranslationsDescription')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Primary Version Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('sections.bible.primaryVersion', {
                defaultValue: 'Primary Version',
              })}
            </label>
            <Combobox
              options={primaryOptions}
              value={primaryTranslation?.id ?? null}
              onChange={handlePrimaryChange}
              placeholder={t('sections.bible.selectPrimary', {
                defaultValue: 'Select primary version...',
              })}
              allowClear
              portalContainer={portalContainer}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('sections.bible.primaryDescription', {
                defaultValue: 'Main Bible version shown in the app',
              })}
            </p>
          </div>

          {/* Secondary Version Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('sections.bible.secondaryVersion', {
                defaultValue: 'Secondary Version',
              })}
            </label>
            <Combobox
              options={secondaryOptions}
              value={secondaryTranslation?.id ?? null}
              onChange={handleSecondaryChange}
              placeholder={t('sections.bible.selectSecondary', {
                defaultValue: 'None (optional)',
              })}
              disabled={!primaryTranslation}
              allowClear
              portalContainer={portalContainer}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('sections.bible.secondaryDescription', {
                defaultValue: 'Shown alongside primary in presentation',
              })}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
