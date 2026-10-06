import { FileDown, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useCategories } from '~/features/songs/hooks'
import { useToast } from '~/ui/toast'
import { saveFile } from '~/utils/saveFile'
import { primaryButton } from './buttonStyles'
import { CategorySelect } from './CategorySelect'
import { SectionHeading } from './SectionHeading'
import { exportCategoryFile } from '../service/songSourcesSettingsApi'

/** Saves a category as a `.chsongs` file anyone with Church Hub can open. */
export function SongFileExportSection() {
  const { t } = useTranslation('songDiscovery')
  const { showToast } = useToast()
  const { data: categories = [] } = useCategories()
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    const category = categories.find((c) => c.id === categoryId)
    if (!category) return
    setIsExporting(true)
    try {
      await saveFile({
        content: await exportCategoryFile(category.id),
        defaultFilename: `${category.name}.chsongs`,
        filterName: 'Church Hub Songs',
        extensions: ['chsongs'],
        mimeType: 'application/zip',
      })
    } catch (error) {
      showToast(
        t('songSources.export.failed', { error: (error as Error).message }),
        'error',
      )
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <section className="space-y-3">
      <SectionHeading
        title={t('songSources.export.title')}
        description={t('songSources.export.description')}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <CategorySelect
          id="song-file-export-category"
          value={categoryId}
          onChange={setCategoryId}
          placeholder={t('songSources.export.category')}
        />
        <button
          type="button"
          onClick={handleExport}
          disabled={categoryId == null || isExporting}
          className={primaryButton}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
          {t('songSources.export.button')}
        </button>
      </div>
    </section>
  )
}
