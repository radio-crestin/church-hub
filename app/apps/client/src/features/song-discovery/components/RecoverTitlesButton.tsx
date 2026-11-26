import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  type ImportProgress,
  ImportProgressModal,
  processZipFromBuffer,
} from '~/features/song-import'
import { backfillAlternateTitles } from '~/features/songs/service'
import { useToast } from '~/ui/toast'
import { downloadSourceArchive } from '../service/songSourcesApi'

/** The built-in Resurse Creștine source, whose catalogue names the songs. */
const RESURSE_CRESTINE_SOURCE_ID = 'resurse-crestine'
const ARCHIVE_LABEL = 'Resurse Creștine'

/**
 * Gives songs already in the library back the names Resurse Creștine knows
 * them by.
 *
 * The old bulk import filed every song under its first verse, which threw
 * the source's own title away: "Zece mii de motive" ended up stored as "E o
 * nouă zi, soarele răsare" and cannot be found by the name anyone would
 * search for. Each check of the sources recovers it now; this does it at
 * once, matching each catalogue file against the source filename the import
 * recorded. Songs that already carry the name are left alone, so it can run
 * again whenever the catalogue changes.
 */
export function RecoverTitlesButton() {
  const { t } = useTranslation('songDiscovery')
  const { showToast } = useToast()
  const [progress, setProgress] = useState<ImportProgress | null>(null)

  const recover = async () => {
    const downloading = (current: number, total: number | null) =>
      setProgress({
        phase: 'downloading',
        current,
        total,
        currentFile: ARCHIVE_LABEL,
      })
    downloading(0, null)
    try {
      const archive = await downloadSourceArchive(
        RESURSE_CRESTINE_SOURCE_ID,
        downloading,
      )
      // A fresh array of its own: its buffer is exactly the archive.
      const catalog = await processZipFromBuffer(
        archive.buffer as ArrayBuffer,
        setProgress,
      )
      const result = await backfillAlternateTitles(
        catalog.songs.flatMap((song) =>
          song.sourceFilename && song.parsed.title?.trim()
            ? [
                {
                  sourceFilename: song.sourceFilename,
                  titles: [song.parsed.title.trim()],
                },
              ]
            : [],
        ),
      )
      showToast(t('recoverTitles.done', { count: result.updated }), 'success')
    } catch (error) {
      showToast(t('recoverTitles.failed', { error: String(error) }), 'error')
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-fg-hint">{t('recoverTitles.description')}</p>
      <button
        type="button"
        data-testid="recover-original-titles"
        onClick={() => void recover()}
        disabled={progress !== null}
        className="h-8 rounded-lg px-3 text-sm font-medium bg-raised text-fg shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-hover transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        {progress ? t('recoverTitles.running') : t('recoverTitles.button')}
      </button>
      <ImportProgressModal isOpen={progress !== null} progress={progress} />
    </div>
  )
}
