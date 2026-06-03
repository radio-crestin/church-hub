import { Link } from '@tanstack/react-router'
import {
  Check,
  Crown,
  ExternalLink,
  Layers,
  Loader2,
  Sparkles,
  Unlink,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { LinkVersionsModal } from './LinkVersionsModal'
import { useLinkSongs } from '../hooks/useLinkSongs'
import { useSetPrimarySong } from '../hooks/useSetPrimarySong'
import { useSimilarSongs } from '../hooks/useSimilarSongs'
import { useSongGroup } from '../hooks/useSongGroup'
import { useUnlinkSong } from '../hooks/useUnlinkSong'
import { dismissSuggestion, isDismissed } from '../utils/dismissedSuggestions'

/**
 * Renders the "Sugestii" sub-section: songs the server flagged as likely
 * versions, with accept ("aceeași cântare") and dismiss controls. Hidden
 * entirely when the server returns nothing — so a song with no candidates
 * doesn't waste vertical space.
 */
function SuggestionsSection({
  songId,
  canEdit,
}: {
  songId: number
  canEdit: boolean
}) {
  const { t } = useTranslation('songs')
  const { data: suggestions = [], isLoading } = useSimilarSongs(songId)
  const linkMutation = useLinkSongs()
  // Forces a re-render after a dismissal so the row disappears immediately
  // without waiting for the query cache to refresh.
  const [dismissTick, setDismissTick] = useState(0)

  const visible = useMemo(
    () => suggestions.filter((s) => !isDismissed(songId, s.songId)),
    // dismissTick intentionally invalidates the memo after a click.
    // biome-ignore lint/correctness/useExhaustiveDependencies: re-read localStorage on tick
    [suggestions, songId, dismissTick],
  )

  if (!canEdit) return null
  if (isLoading) return null
  if (visible.length === 0) return null

  function handleAccept(suggestedId: number) {
    linkMutation.mutate({ songIdA: songId, songIdB: suggestedId })
  }

  function handleDismiss(suggestedId: number) {
    dismissSuggestion(songId, suggestedId)
    setDismissTick((n) => n + 1)
  }

  return (
    <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <Sparkles size={12} />
        {t('versions.suggestionsTitle')}
      </div>
      <ul className="space-y-1">
        {visible.map((s) => (
          <li
            key={s.songId}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/40"
          >
            <Link
              to="/songs/$songId"
              params={{ songId: String(s.songId) }}
              className="min-w-0 flex-1"
            >
              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                {s.title}
              </p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                {t(`versions.reason.${s.reason}`)} · {Math.round(s.score * 100)}
                %{s.categoryName ? ` · ${s.categoryName}` : ''}
              </p>
            </Link>
            <button
              type="button"
              onClick={() => handleAccept(s.songId)}
              disabled={linkMutation.isPending}
              title={t('versions.suggestionAccept')}
              className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={() => handleDismiss(s.songId)}
              title={t('versions.suggestionDismiss')}
              className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

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
  /**
   * When `true`, render only the inner body (no outer card + heading) so
   * the panel can be slotted into a `CollapsibleSection` whose chrome and
   * header replace the panel's. The accordion takes ownership of the
   * title, the count badge, and the toggle affordance.
   */
  embedded?: boolean
}

/**
 * Read+write panel for the "Other versions" section of a song. When the
 * song has no group yet, it only shows a "Same song as…" call to action.
 * When grouped, it lists every member with quick actions.
 */
/**
 * Inner-body wrapper: keeps spacing consistent whether the panel renders
 * its own chrome (standalone) or hands chrome over to a parent accordion
 * (embedded). Scrollable when embedded so a long member list doesn't push
 * sibling panels out. Hoisted outside the component so it doesn't get a
 * fresh identity on every render.
 */
function PanelBody({
  embedded,
  children,
}: {
  embedded: boolean
  children: React.ReactNode
}) {
  return embedded ? (
    <div className="h-full overflow-y-auto p-3">{children}</div>
  ) : (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      {children}
    </section>
  )
}

export function SongVersionsPanel({
  songId,
  songTitle,
  canEdit,
  embedded = false,
}: SongVersionsPanelProps) {
  const { t } = useTranslation('songs')
  const { data: group, isLoading } = useSongGroup(songId)
  const setPrimary = useSetPrimarySong()
  const unlink = useUnlinkSong()
  const [isLinkModalOpen, setLinkModalOpen] = useState(false)

  // While loading, render a tight placeholder so the page layout doesn't jump.
  if (isLoading) {
    return (
      <PanelBody embedded={embedded}>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 size={14} className="animate-spin" />
        </div>
      </PanelBody>
    )
  }

  // Standalone song — no group yet. Surface the call to action only when the
  // user is allowed to edit; viewers see nothing.
  if (!group) {
    if (!canEdit) return null
    return (
      <PanelBody embedded={embedded}>
        {!embedded ? (
          <header className="mb-2 flex items-center gap-2 text-gray-700 dark:text-gray-200">
            <Layers size={16} />
            <h3 className="text-sm font-semibold">{t('versions.title')}</h3>
          </header>
        ) : null}
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

        <SuggestionsSection songId={songId} canEdit={canEdit} />

        <LinkVersionsModal
          isOpen={isLinkModalOpen}
          onClose={() => setLinkModalOpen(false)}
          currentSongId={songId}
          currentSongTitle={songTitle}
        />
      </PanelBody>
    )
  }

  return (
    <PanelBody embedded={embedded}>
      {!embedded ? (
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
      ) : canEdit ? (
        // Embedded: the accordion owns the title row, but the "link more"
        // CTA still needs a home — render it as a compact button above the
        // member list.
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => setLinkModalOpen(true)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
          >
            + {t('versions.linkButtonShort')}
          </button>
        </div>
      ) : null}

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

      <SuggestionsSection songId={songId} canEdit={canEdit} />

      <LinkVersionsModal
        isOpen={isLinkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        currentSongId={songId}
        currentSongTitle={songTitle}
      />
    </PanelBody>
  )
}
