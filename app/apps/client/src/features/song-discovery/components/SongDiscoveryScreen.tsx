import { Search, Sparkles } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState, Page } from '~/ui/page'
import { ClearSearchButton } from '~/ui/search'
import { useToast } from '~/ui/toast'
import { AddSourceLink } from './AddSourceLink'
import { CandidateEditorPanel } from './CandidateEditorPanel'
import { DiscoveryHeader } from './DiscoveryHeader'
import { SongChecklist } from './SongChecklist'
import { SourceChecklist } from './SourceChecklist'
import { useDiscoverySelection } from '../hooks/useDiscoverySelection'
import { useImportSelected } from '../hooks/useImportSelected'
import { useLackingSongs } from '../hooks/useLackingSongs'
import { useSongSources } from '../hooks/useSongSources'
import { useSongUpdates } from '../hooks/useSongUpdates'
import { useOpenedSongFileSources } from '../opened-files/openedSongFiles'
import { foldForSearch } from '../utils/foldForSearch'

interface SongDiscoveryScreenProps {
  /** Only this source is ticked at first: an opened song file, or a source picked in a notification. */
  focusSourceId?: string
  onBack?: () => void
}

/**
 * Song discovery: every source's songs the library lacks, in one list, all
 * picked at first. Untick a source or a song to leave it out, search on the
 * left, review a song on the right, then import them all with one button.
 */
export function SongDiscoveryScreen({
  focusSourceId,
  onBack,
}: SongDiscoveryScreenProps) {
  const { t } = useTranslation('songDiscovery')
  const { showToast } = useToast()
  const { data: serverSources = [] } = useSongSources()
  const openedFiles = useOpenedSongFileSources()
  const sources = useMemo(
    () => [...openedFiles, ...serverSources],
    [openedFiles, serverSources],
  )
  const { state, isRunning, checkNow, recount } = useSongUpdates()
  const lacking = useLackingSongs(sources, state?.finishedAt ?? null)
  const selection = useDiscoverySelection(
    lacking.entries,
    sources,
    focusSourceId,
  )
  const { importSelected, isImporting } = useImportSelected(sources)

  const [query, setQuery] = useState('')
  const [openTempId, setOpenTempId] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const visible = useMemo(() => {
    const folded = foldForSearch(query.trim())
    if (!folded) return selection.items
    return selection.items.filter((item) =>
      foldForSearch(item.draft.title).includes(folded),
    )
  }, [selection.items, query])
  const picked = selection.items.filter((item) => item.selected)
  const openItem = selection.items.find((item) => item.tempId === openTempId)
  const sourceNames = useMemo(
    () => new Map(sources.map((s) => [s.id, s.name])),
    [sources],
  )
  const counts = new Map(
    lacking.loaded.map((s) => [s.id, selection.countBySource.get(s.id) ?? 0]),
  )

  const checkAgain = () =>
    void checkNow({
      force: true,
      sourceIds: sources
        .filter((s) => s.origin !== 'file' && selection.isSourceChecked(s.id))
        .map((s) => s.id),
    })

  const handleImport = async () => {
    try {
      const imported = await importSelected(picked)
      selection.markImported(imported)
      if (openTempId && imported.includes(openTempId)) setOpenTempId(null)
      // The server counts each source's waiting songs again.
      for (const source of sources) {
        if (source.origin === 'file') continue
        if (picked.some((i) => i.sourceId === source.id)) recount(source.id)
      }
      showToast(t('toast.imported', { count: imported.length }), 'success')
    } catch (error) {
      showToast(t('toast.importFailed', { error: String(error) }), 'error')
    }
  }

  const emptyText = lacking.isLoading
    ? null
    : selection.items.length === 0
      ? t('allPresent')
      : null

  return (
    <Page>
      <DiscoveryHeader
        onBack={onBack}
        selectedCount={picked.length}
        totalCount={selection.items.length}
        onImport={handleImport}
        isImporting={isImporting}
        isChecking={isRunning}
        checkedAt={state?.finishedAt ?? null}
        onCheckAgain={checkAgain}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <aside className="flex min-h-0 w-full flex-col gap-3 lg:w-96 lg:shrink-0">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('search.placeholder')}
              aria-label={t('search.placeholder')}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pr-9 pl-9 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            {query && (
              <ClearSearchButton
                inputRef={searchRef}
                onClear={() => setQuery('')}
              />
            )}
          </div>
          <SourceChecklist
            sources={sources}
            isChecked={selection.isSourceChecked}
            onToggle={selection.toggleSource}
            counts={counts}
            isLoading={lacking.isLoading || isRunning}
            failed={lacking.failed}
          />
          <AddSourceLink />
          <SongChecklist
            items={visible}
            sourceNames={sourceNames}
            openTempId={openTempId}
            onOpen={setOpenTempId}
            onSelect={selection.setSelected}
          />
        </aside>

        <main className="min-h-0 flex-1 overflow-y-auto">
          {openItem ? (
            <CandidateEditorPanel
              item={openItem}
              onDraftChange={selection.setDraft}
            />
          ) : (
            <EmptyState
              icon={Sparkles}
              title={emptyText ?? t('selectPrompt')}
            />
          )}
        </main>
      </div>
    </Page>
  )
}
