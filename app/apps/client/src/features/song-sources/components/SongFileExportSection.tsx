import { FileArchive, FileDown, Loader2, Presentation } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useExportSongs } from '~/features/song-export'
import { useCategories } from '~/features/songs/hooks'
import { useToast } from '~/ui/toast'
import { saveFile } from '~/utils/saveFile'
import { primaryButton, secondaryButton } from './buttonStyles'
import { CategorySelect } from './CategorySelect'
import { SectionHeading } from './SectionHeading'
import { exportCategoryFile } from '../service/songSourcesSettingsApi'

type Download = 'chsongs' | 'zip' | 'pptx'

/**
 * Saves a category's songs as a file: a `.chsongs` file Church Hub opens,
 * the same OpenSong files as a plain `.zip`, or a `.zip` of PowerPoints
 * (the Songs export, reused).
 */
export function SongFileExportSection() {
  const { t } = useTranslation('songDiscovery')
  const { showToast } = useToast()
  const { data: categories = [] } = useCategories()
  const { exportSongs } = useExportSongs()
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [busy, setBusy] = useState<Download | null>(null)

  const download = async (kind: Download) => {
    const category = categories.find((c) => c.id === categoryId)
    if (!category) return
    setBusy(kind)
    try {
      if (kind === 'pptx') {
        const result = await exportSongs({
          categoryId: category.id,
          destination: 'zip',
          fileFormat: 'pptx',
        })
        if (!result.success && !result.cancelled) throw new Error(result.error)
        return
      }
      await saveFile({
        content: await exportCategoryFile(category.id, kind),
        defaultFilename: `${category.name}.${kind}`,
        filterName: kind === 'chsongs' ? 'Church Hub Songs' : 'ZIP Archive',
        extensions: [kind],
        mimeType: 'application/zip',
      })
    } catch (error) {
      showToast(
        t('songSources.export.failed', { error: (error as Error).message }),
        'error',
      )
    } finally {
      setBusy(null)
    }
  }

  const button = (kind: Download, icon: React.ReactNode, style: string) => (
    <button
      type="button"
      onClick={() => download(kind)}
      disabled={categoryId == null || busy != null}
      className={style}
    >
      {busy === kind ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {t(`songSources.export.${kind}`)}
    </button>
  )

  return (
    <section className="space-y-3">
      <SectionHeading
        title={t('songSources.export.title')}
        description={t('songSources.export.description')}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <CategorySelect
          id="song-file-export-category"
          value={categoryId}
          onChange={setCategoryId}
          placeholder={t('songSources.export.category')}
        />
        {button('chsongs', <FileDown className="h-4 w-4" />, primaryButton)}
        {button('zip', <FileArchive className="h-4 w-4" />, secondaryButton)}
        {button('pptx', <Presentation className="h-4 w-4" />, secondaryButton)}
      </div>
    </section>
  )
}
