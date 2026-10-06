import { Link2, Loader2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAddLinkSource } from '~/features/song-sources/hooks/useLinkSources'
import { useToast } from '~/ui/toast'

/**
 * Paste a link to a .chsongs file (or a shared folder) to add it as a
 * source; it is checked for songs at once.
 */
export function AddSourceLink() {
  const { t } = useTranslation('songDiscovery')
  const { showToast } = useToast()
  const addSource = useAddLinkSource()
  const [link, setLink] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const url = link.trim()
    if (!url) return
    try {
      await addSource.mutateAsync(url)
      setLink('')
    } catch (error) {
      showToast(
        t('songSources.links.addFailed', {
          error: error instanceof Error ? error.message : String(error),
        }),
        'error',
      )
    }
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <div className="relative min-w-0 flex-1">
        <Link2 className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="url"
          value={link}
          onChange={(event) => setLink(event.target.value)}
          placeholder={t('addLink.placeholder')}
          aria-label={t('addLink.label')}
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pr-3 pl-9 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
      </div>
      <button
        type="submit"
        disabled={!link.trim() || addSource.isPending}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
      >
        {addSource.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {t('addLink.add')}
      </button>
    </form>
  )
}
