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
        <Link2 className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-fg-hint" />
        <input
          type="url"
          value={link}
          onChange={(event) => setLink(event.target.value)}
          placeholder={t('addLink.placeholder')}
          aria-label={t('addLink.label')}
          className="w-full rounded-lg border border-line bg-panel py-2 pr-3 pl-9 text-sm text-fg placeholder:text-fg-hint focus:border-focus focus:ring-1 focus:ring-focus focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={!link.trim() || addSource.isPending}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-field px-3 py-2 text-sm font-medium text-fg-body transition-colors hover:bg-hover disabled:opacity-50"
      >
        {addSource.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {t('addLink.add')}
      </button>
    </form>
  )
}
