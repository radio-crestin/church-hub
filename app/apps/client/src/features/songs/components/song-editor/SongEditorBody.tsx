import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { usePersistedBoolean } from '~/hooks/usePersistedBoolean'
import {
  type SongEditorMode,
  SongEditorModeSwitch,
} from './SongEditorModeSwitch'
import { SongSlidesEditor } from './SongSlidesEditor'
import { SongTextEditor } from './SongTextEditor'
import { useIsLargeScreen } from '../../hooks/useIsLargeScreen'
import type { SongDraft } from '../../utils/songToDraft'
import { SongDetailsSection } from '../SongDetailsSection'

interface SongEditorBodyProps {
  songId: number | null
  draft: SongDraft
  onChange: (patch: Partial<SongDraft>) => void
  mode: SongEditorMode
  onModeChange: (mode: SongEditorMode) => void
  isNew?: boolean
  presentationCount?: number
  lastManualEdit?: number | null
  /** Where the details' dropdowns render (the dialog, inside a modal). */
  portalContainer?: HTMLElement | null
  idPrefix?: string
}

/**
 * The one song editor: the slides (PowerPoint-style, or as text with the
 * chords and labels written in) beside the song's details — title, key,
 * category, tags, background and the rest — so nothing about a song is edited
 * anywhere else. Used on the song page and in the editor dialog.
 */
export function SongEditorBody({
  songId,
  draft,
  onChange,
  mode,
  onModeChange,
  isNew = false,
  presentationCount,
  lastManualEdit,
  portalContainer,
  idPrefix,
}: SongEditorBodyProps) {
  const { t } = useTranslation('songs')
  const isLargeScreen = useIsLargeScreen()
  const [detailsOpen, setDetailsOpen] = usePersistedBoolean(
    'song-editor:details-open',
    true,
  )
  const showDetails = detailsOpen || !isLargeScreen

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <SongEditorModeSwitch mode={mode} onChange={onModeChange} />
        {isLargeScreen && (
          <button
            type="button"
            onClick={() => setDetailsOpen(!detailsOpen)}
            aria-pressed={detailsOpen}
            data-testid="song-editor-details-toggle"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-fg-label hover:bg-hover"
          >
            {detailsOpen ? (
              <PanelRightClose size={16} />
            ) : (
              <PanelRightOpen size={16} />
            )}
            {t('songEditor.details')}
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <div
          data-testid={`song-editor-${mode}`}
          className="flex min-h-0 min-w-0 flex-1 flex-col"
        >
          {mode === 'text' ? (
            <SongTextEditor
              slides={draft.slides}
              onSlidesChange={(slides) => onChange({ slides })}
            />
          ) : (
            <SongSlidesEditor
              slides={draft.slides}
              onSlidesChange={(slides) => onChange({ slides })}
              title={draft.title}
              keyLine={draft.metadata.keyLine}
              songId={songId}
              background={draft.background}
            />
          )}
        </div>

        {showDetails && (
          <aside
            data-testid="song-editor-details"
            className="shrink-0 lg:w-[22rem] lg:overflow-y-auto lg:pr-1 scrollbar-thin"
          >
            <SongDetailsSection
              title={draft.title}
              categoryId={draft.categoryId}
              tagIds={draft.tagIds}
              metadata={draft.metadata}
              isNew={isNew}
              presentationCount={presentationCount}
              lastManualEdit={lastManualEdit}
              onTitleChange={(title) => onChange({ title })}
              onCategoryChange={(categoryId) => onChange({ categoryId })}
              onTagsChange={(tagIds) => onChange({ tagIds })}
              onMetadataChange={(field, value) =>
                onChange({ metadata: { ...draft.metadata, [field]: value } })
              }
              background={draft.background}
              onBackgroundChange={(background) => onChange({ background })}
              portalContainer={portalContainer}
              idPrefix={idPrefix}
            />
          </aside>
        )}
      </div>
    </div>
  )
}
