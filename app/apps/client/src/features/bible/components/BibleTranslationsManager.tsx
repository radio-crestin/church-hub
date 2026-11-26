import { Book, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Combobox } from '~/ui/combobox'
import { ConfirmModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'
import { useDeleteTranslation } from '../hooks'
import { useSelectedBibleTranslations } from '../hooks/useSelectedBibleTranslations'

interface BibleTranslationsManagerProps {
  portalContainer?: HTMLElement | null
}

export function BibleTranslationsManager({
  portalContainer,
}: BibleTranslationsManagerProps) {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean
    translationId: number | null
    translationName: string
  }>({ isOpen: false, translationId: null, translationName: '' })

  const {
    translations,
    primaryTranslation,
    secondaryTranslation,
    setPrimaryTranslation,
    setSecondaryTranslation,
    isLoading,
  } = useSelectedBibleTranslations()

  const { mutateAsync: deleteTranslation } = useDeleteTranslation()

  // Convert translations to Combobox options
  const primaryOptions = useMemo(
    () =>
      translations.map((translation) => ({
        value: translation.id,
        label: `${translation.name} (${translation.language.toUpperCase()})`,
      })),
    [translations],
  )

  // Get available translations for secondary (exclude primary)
  const secondaryOptions = useMemo(
    () =>
      translations
        .filter((t) => t.id !== primaryTranslation?.id)
        .map((translation) => ({
          value: translation.id,
          label: `${translation.name} (${translation.language.toUpperCase()})`,
        })),
    [translations, primaryTranslation?.id],
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

  const handleDeleteRequest = (value: number | string) => {
    const translation = translations.find((t) => t.id === value)
    if (translation) {
      setDeleteConfirm({
        isOpen: true,
        translationId: translation.id,
        translationName: translation.name,
      })
    }
  }

  const handleDeleteConfirm = async () => {
    if (deleteConfirm.translationId === null) return

    try {
      // If the translation being deleted is currently selected, clear the selection
      if (primaryTranslation?.id === deleteConfirm.translationId) {
        await setPrimaryTranslation(null)
      }
      if (secondaryTranslation?.id === deleteConfirm.translationId) {
        await setSecondaryTranslation(null)
      }

      await deleteTranslation(deleteConfirm.translationId)
      showToast(t('sections.bible.toast.deleted'), 'success')
    } catch {
      showToast(t('sections.bible.toast.error'), 'error')
    } finally {
      setDeleteConfirm({
        isOpen: false,
        translationId: null,
        translationName: '',
      })
    }
  }

  const handleDeleteCancel = () => {
    setDeleteConfirm({
      isOpen: false,
      translationId: null,
      translationName: '',
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-fg" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-base font-semibold text-fg flex items-center gap-2">
          <Book className="w-5 h-5" strokeWidth={1.5} />
          {t('sections.bible.title')}
        </h3>
        <p className="text-sm text-fg-label mt-1">
          {t('sections.bible.description')}
        </p>
      </div>

      {translations.length === 0 ? (
        <div className="text-center py-8 bg-field rounded-lg border border-dashed border-line">
          <Book className="w-12 h-12 mx-auto text-fg-hint mb-3" />
          <p className="text-fg-label font-medium">
            {t('sections.bible.noTranslations')}
          </p>
          <p className="text-sm text-fg-hint mt-1">
            {t('sections.bible.noTranslationsDescription')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Primary Version Selector */}
          <div>
            <label className="block text-sm font-medium text-fg-body mb-1">
              {t('sections.bible.primaryVersion')}
            </label>
            <Combobox
              options={primaryOptions}
              value={primaryTranslation?.id ?? null}
              onChange={handlePrimaryChange}
              onDelete={handleDeleteRequest}
              placeholder={t('sections.bible.selectPrimary')}
              allowClear
              allowDelete
              portalContainer={portalContainer}
            />
            <p className="text-xs text-fg-hint mt-1">
              {t('sections.bible.primaryDescription')}
            </p>
          </div>

          {/* Secondary Version Selector */}
          <div>
            <label className="block text-sm font-medium text-fg-body mb-1">
              {t('sections.bible.secondaryVersion')}
            </label>
            <Combobox
              options={secondaryOptions}
              value={secondaryTranslation?.id ?? null}
              onChange={handleSecondaryChange}
              onDelete={handleDeleteRequest}
              placeholder={t('sections.bible.selectSecondary')}
              disabled={!primaryTranslation}
              allowClear
              allowDelete
              portalContainer={portalContainer}
            />
            <p className="text-xs text-fg-hint mt-1">
              {t('sections.bible.secondaryDescription')}
            </p>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title={t('sections.bible.modals.delete.title')}
        message={t('sections.bible.modals.delete.message', {
          name: deleteConfirm.translationName,
        })}
        confirmLabel={t('sections.bible.modals.delete.confirm')}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        variant="danger"
      />
    </div>
  )
}
