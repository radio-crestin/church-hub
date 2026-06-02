import { AISearchSettings } from '~/features/ai-search'
import { SynonymManager } from '~/features/search'
import { ImportExportManager } from '~/features/song-export'
import { CategoryManager } from './CategoryManager'
import { TagManager } from './TagManager'

const cardClass =
  'rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900'

/**
 * Songs settings, rendered as a settings-page panel (extracted from the former
 * SongsSettingsModal). Hosts category/tag/synonym management, import/export,
 * and AI search configuration. Keyboard shortcuts live in /settings/shortcuts.
 */
export function SongsSettingsPanel() {
  return (
    <div className="space-y-6">
      <div className={cardClass}>
        <CategoryManager />
      </div>
      <div className={cardClass}>
        <TagManager />
      </div>
      <div className={cardClass}>
        <ImportExportManager />
      </div>
      <div className={cardClass}>
        <SynonymManager />
      </div>
      <AISearchSettings configKey="songs_ai_search_config" />
    </div>
  )
}
