import { Link2, Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSongSources } from '~/features/song-discovery/hooks/useSongSources'
import { Input } from '~/ui/input'
import { useToast } from '~/ui/toast'
import { dangerButton, primaryButton } from './buttonStyles'
import { SectionHeading } from './SectionHeading'
import { useAddLinkSource, useDeleteLinkSource } from '../hooks/useLinkSources'

/** The built-in sources, and sources added from links others shared. */
export function LinkSourcesSection() {
  const { t } = useTranslation('songDiscovery')
  const { showToast } = useToast()
  const { data: sources = [] } = useSongSources()
  const addSource = useAddLinkSource()
  const deleteSource = useDeleteLinkSource()
  const [link, setLink] = useState('')

  const builtIn = sources.filter((s) => s.origin === 'built-in')
  const fromLinks = sources.filter((s) => s.origin === 'link')

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      const source = await addSource.mutateAsync(link.trim())
      setLink('')
      showToast(t('songSources.links.added', { name: source.name }), 'success')
    } catch (error) {
      showToast(
        t('songSources.links.addFailed', { error: (error as Error).message }),
        'error',
      )
    }
  }

  return (
    <section className="space-y-3">
      <SectionHeading
        title={t('songSources.links.title')}
        description={t('songSources.links.description')}
      />
      <p className="text-sm text-gray-600 dark:text-gray-300">
        <span className="font-medium">{t('songSources.builtIn')}:</span>{' '}
        {builtIn.map((s) => s.name).join(', ')}
      </p>

      <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="url"
          required
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder={t('songSources.links.placeholder')}
          aria-label={t('songSources.links.placeholder')}
        />
        <button
          type="submit"
          disabled={addSource.isPending || !link.trim()}
          className={primaryButton}
        >
          {addSource.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          {t('songSources.links.add')}
        </button>
      </form>

      {fromLinks.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('songSources.links.empty')}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
          {fromLinks.map((source) => (
            <li
              key={source.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                  {source.name}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {source.url}
                </p>
              </div>
              <button
                type="button"
                onClick={() => deleteSource.mutate(source.id)}
                disabled={deleteSource.isPending}
                className={dangerButton}
                aria-label={`${t('songSources.links.remove')} ${source.name}`}
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {t('songSources.links.remove')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
