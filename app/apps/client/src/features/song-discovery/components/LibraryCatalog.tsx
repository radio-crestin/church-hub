import { ChevronDown, Library, Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAddLinkSource } from '~/features/song-sources/hooks/useLinkSources'
import { useToast } from '~/ui/toast'
import { useLibraryCatalog } from '../hooks/useLibraryCatalog'
import type { SongSource } from '../providers/types'

/**
 * The shared libraries churches listed in the public catalog, each added as
 * a song source in one click (then checked for songs like any other).
 */
export function LibraryCatalog({ sources }: { sources: SongSource[] }) {
  const { t } = useTranslation('songDiscovery')
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const catalog = useLibraryCatalog(open)
  const addSource = useAddLinkSource()
  const added = new Set(sources.map((source) => source.id))

  const add = (manifestUrl: string) =>
    addSource
      .mutateAsync(manifestUrl)
      .catch((error: Error) =>
        showToast(
          t('songSources.links.addFailed', { error: error.message }),
          'error',
        ),
      )

  return (
    <section className="rounded-xl border border-line bg-panel">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-fg-body"
      >
        <Library className="h-4 w-4 text-fg-hint" />
        <span className="flex-1">{t('catalog.title')}</span>
        <ChevronDown
          className={`h-4 w-4 text-fg-hint ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t border-line" data-testid="library-catalog">
          {catalog.isLoading && (
            <p className="flex items-center gap-2 px-4 py-3 text-sm text-fg-hint">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('catalog.loading')}
            </p>
          )}
          {catalog.error && (
            <p className="px-4 py-3 text-sm text-fg-hint">
              {t('catalog.failed')}
            </p>
          )}
          {catalog.data?.length === 0 && (
            <p className="px-4 py-3 text-sm text-fg-hint">
              {t('catalog.empty')}
            </p>
          )}
          <ul className="max-h-60 overflow-y-auto">
            {catalog.data?.map((library) => {
              const isAdded = added.has(`library-${library.sourceId}`)
              return (
                <li
                  key={library.sourceId}
                  className="flex items-center gap-3 border-b border-line px-4 py-2 last:border-b-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">
                      {library.name}
                    </span>
                    <span className="block truncate text-xs text-fg-hint">
                      {t('catalog.meta', {
                        publisher: library.publisher,
                        count: library.songCount,
                      })}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => add(library.manifestUrl)}
                    disabled={isAdded || addSource.isPending}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-field px-3 py-1.5 text-sm font-medium text-fg-body transition-colors hover:bg-hover disabled:opacity-50"
                  >
                    {!isAdded && <Plus className="h-4 w-4" />}
                    {isAdded ? t('catalog.added') : t('catalog.add')}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
