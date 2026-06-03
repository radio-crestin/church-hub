import { Link } from '@tanstack/react-router'
import { Crown, ExternalLink, Layers, Loader2, Unlink } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { LinkVersionsModal } from './LinkVersionsModal'
import { useSetPrimarySong } from '../hooks/useSetPrimarySong'
import { useSongGroup } from '../hooks/useSongGroup'
import { useUnlinkSong } from '../hooks/useUnlinkSong'

interface SongVersionsPanelProps {
  songId: number
  /**
   * The current song's title — used as the modal subject when the user
   * doesn't yet have a group (the panel surfaces a "Same song as…" button).
   */
  songTitle: string
  /**
   * When `true`, the user has permission to mutate the group (link / set
   * primary / unlink). Otherwise the panel renders as read-only.
   */
  canEdit: boolean
}

/**
 * Read+write panel for the "Other versions" section of a song. When the
 * song has no group yet, it only shows a "Same song as…" call to action.
 * When grouped, it lists every member with quick actions.
 */
export function SongVersionsPanel({
  songId,
  songTitle,
  canEdit,
}: SongVersionsPanelProps) {
  const { t } = useTranslation('songs')
  const { data: group, isLoading } = useSongGroup(songId)
  const setPrimary = useSetPrimarySong()
  const unlink = useUnlinkSong()
  const [isLinkModalOpen, setLinkModalOpen] = useState(false)

  // While loading, render a tight placeholder so the page layout doesn't jump.
  if (isLoading) {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 size={14} className="animate-spin" />
        </div>
      </section>
    )
  }

  // Standalone song — no group yet. Surface the call to action only when the
  // user is allowed to edit; viewers see nothing.
  if (!group) {
    if (!canEdit) return null
    return (
      <section className="rounded-lg border border-dashed border-gray-300 bg-white p-4 dark:border-gray-600 dark:bg-gray-800">
        <header className="mb-2 flex items-center gap-2 text-gray-700 dark:text-gray-200">
          <Layers size={16} />
          <h3 className="text-sm font-semibold">{t('versions.title')}</h3>
        </header>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('versions.description')}
        </p>
        <button
          type="button"
          onClick={() => setLinkModalOpen(true)}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Layers size={14} />
          {t('versions.linkButton')}
        </button>

        <LinkVersionsModal
          isOpen={isLinkModalOpen}
          onClose={() => setLinkModalOpen(false)}
          currentSongId={songId}
          currentSongTitle={songTitle}
        />
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
          <Layers size={16} />
          <h3 className="text-sm font-semibold">{t('versions.title')}</h3>
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
            {t('versions.count', { count: group.members.length })}
          </span>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setLinkModalOpen(true)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
          >
            + {t('versions.linkButtonShort')}
          </button>
        ) : null}
      </header>

      <ul className="space-y-1.5">
        {group.members.map((member) => {
          const isCurrent = member.songId === songId
          return (
            <li
              key={member.songId}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                isCurrent
                  ? 'border-indigo-200 bg-indigo-50/50 dark:border-indigo-500/40 dark:bg-indigo-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-gray-900 dark:text-white">
                    {member.title}
                  </span>
                  {member.isPrimary ? (
                    <span
                      title={t('versions.primary')}
                      className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                    >
                      <Crown size={10} />
                      {t('versions.primary')}
                    </span>
                  ) : null}
                </div>
                {member.author || member.hymnNumber ? (
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {[member.hymnNumber, member.author]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {!isCurrent ? (
                  <Link
                    to="/songs/$songId"
                    params={{ songId: String(member.songId) }}
                    title={t('versions.open')}
                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                  >
                    <ExternalLink size={14} />
                  </Link>
                ) : null}

                {canEdit && !member.isPrimary ? (
                  <button
                    type="button"
                    onClick={() =>
                      setPrimary.mutate({
                        groupId: group.id,
                        songId: member.songId,
                      })
                    }
                    disabled={setPrimary.isPending}
                    title={t('versions.setAsPrimary')}
                    className="rounded p-1.5 text-gray-500 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50 dark:hover:bg-amber-900/30 dark:hover:text-amber-300"
                  >
                    <Crown size={14} />
                  </button>
                ) : null}

                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t('versions.unlinkConfirm'))) {
                        unlink.mutate(member.songId)
                      }
                    }}
                    disabled={unlink.isPending}
                    title={t('versions.unlink')}
                    className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/30 dark:hover:text-red-300"
                  >
                    <Unlink size={14} />
                  </button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>

      <LinkVersionsModal
        isOpen={isLinkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        currentSongId={songId}
        currentSongTitle={songTitle}
      />
    </section>
  )
}
