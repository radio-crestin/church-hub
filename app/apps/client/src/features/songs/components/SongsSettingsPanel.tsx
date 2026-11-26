import { isWebApp } from '~/config'
import { AISearchSettings } from '~/features/ai-search'
import { SynonymManager } from '~/features/search'
import { DiscoverySyncSettings } from '~/features/song-discovery'
import { ImportExportManager } from '~/features/song-export'
import { SongSourcesSettings } from '~/features/song-sources'
import { CategoryManager } from './CategoryManager'
import { SongEditorLayoutSetting } from './SongEditorLayoutSetting'
import { TagManager } from './TagManager'

const cardClass = 'rounded-lg border border-line bg-panel p-4 sm:p-6'

/**
 * Songs settings, rendered as a settings-page panel (extracted from the former
 * SongsSettingsModal). Hosts category/tag/synonym management, import/export,
 * and AI search configuration. Keyboard shortcuts live in /settings/shortcuts.
 */
export function SongsSettingsPanel() {
  return (
    <div className="space-y-6">
      <div className={cardClass}>
        <SongEditorLayoutSetting />
      </div>
      <div className={cardClass}>
        <CategoryManager />
      </div>
      <div className={cardClass}>
        <TagManager />
      </div>
      <div className={cardClass}>
        <ImportExportManager />
      </div>
      {/* Song updates are checked by the church PC */}
      {!isWebApp && (
        <div className={cardClass}>
          <DiscoverySyncSettings />
        </div>
      )}
      <div className={cardClass}>
        <SongSourcesSettings />
      </div>
      <div className={cardClass}>
        <SynonymManager />
      </div>
      <AISearchSettings configKey="songs_ai_search_config" />
    </div>
  )
}
