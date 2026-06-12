import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  SongDetailsSection,
  type SongMetadata,
} from '~/features/songs/components/SongDetailsSection'
import type { LocalSlide } from '~/features/songs/components/SongSlideList'
import { SongSlidesSection } from '~/features/songs/components/SongSlidesSection'
import { SimilarInLibraryPanel } from './SimilarInLibraryPanel'
import type { CandidateDraft, StagingItem } from '../types'
import { slidesToLines } from '../utils/lyricsDiff'

interface CandidateEditorPanelProps {
  item: StagingItem
  onDraftChange: (tempId: string, draft: CandidateDraft) => void
}

/**
 * Edits a not-yet-imported candidate using the SAME building blocks as the
 * real song editor (`SongDetailsSection` + `SongSlidesSection`), driven purely
 * by the staging item's in-memory draft. Nothing touches the DB until the user
 * imports the approved set. The "similar in library" panel sits on top so the
 * operator sees potential duplicates while editing.
 */
export function CandidateEditorPanel({
  item,
  onDraftChange,
}: CandidateEditorPanelProps) {
  const { t } = useTranslation('songDiscovery')
  const { draft } = item

  const patch = (changes: Partial<CandidateDraft>) => {
    onDraftChange(item.tempId, { ...draft, ...changes })
  }

  // The candidate's current (edited) lyric lines, for the similar-songs diff.
  const candidateLines = useMemo(
    () => slidesToLines(draft.slides),
    [draft.slides],
  )

  return (
    <div className="space-y-4">
      <SimilarInLibraryPanel
        similar={item.similar}
        candidateLines={candidateLines}
      />

      <SongDetailsSection
        title={draft.title}
        categoryId={draft.categoryId}
        tagIds={[]}
        metadata={draft.metadata}
        isNew
        idPrefix={`discovery-${item.tempId}-`}
        onTitleChange={(title) => patch({ title })}
        onCategoryChange={(categoryId) => patch({ categoryId })}
        onTagsChange={() => {
          /* tags aren't part of the batch-import payload yet */
        }}
        onMetadataChange={(field: keyof SongMetadata, value) =>
          patch({ metadata: { ...draft.metadata, [field]: value } })
        }
      />

      <SongSlidesSection
        slides={draft.slides}
        onSlidesChange={(slides: LocalSlide[]) => patch({ slides })}
      />

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t('editorHint')}
      </p>
    </div>
  )
}
