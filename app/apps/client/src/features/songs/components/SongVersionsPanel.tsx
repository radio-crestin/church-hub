import { Link } from '@tanstack/react-router'
import {
  Check,
  ChevronDown,
  Crown,
  Layers,
  Loader2,
  Music2,
  Plus,
  Sparkles,
  Tag,
  Unlink,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { LinkVersionsModal } from './LinkVersionsModal'
import { useLinkSongs } from '../hooks/useLinkSongs'
import { useSetPrimarySong } from '../hooks/useSetPrimarySong'
import { useSimilarSongs } from '../hooks/useSimilarSongs'
import { useSongGroup } from '../hooks/useSongGroup'
import { useUnlinkSong } from '../hooks/useUnlinkSong'
import { dismissSuggestion, isDismissed } from '../utils/dismissedSuggestions'

/**
 * Row chrome for the currently-opened song — an indigo tint + ring so the
 * "you are here" row pops out of the list without screaming. Shared by the
 * grouped member row and the standalone (suggestions-only) state.
 */
const currentRowClasses =
  'border-indigo-300 bg-indigo-50/70 ring-1 ring-indigo-200/60 dark:border-indigo-500/50 dark:bg-indigo-900/25 dark:ring-indigo-500/20'

/**
 * Title + badges + author/hymn + category/key chips for one version row.
 * Shared between the grouped member rows and the current-song row shown in
 * the suggestions-only state, so both render identically.
 */
function VersionRowInfo({
  title,
  hymnNumber,
  author,
  keyLine,
  categoryName,
  isPrimary = false,
  isCurrent = false,
}: {
  title: string
  hymnNumber: string | null
  author: string | null
  keyLine: string | null
  categoryName: string | null
  isPrimary?: boolean
  isCurrent?: boolean
}) {
  const { t } = useTranslation('songs')
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="truncate text-sm font-medium text-gray-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
          {title}
        </span>
        {isCurrent ? (
          <span className="inline-flex items-center rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white dark:bg-indigo-500">
            {t('versions.currentBadge')}
          </span>
        ) : null}
        {isPrimary ? (
          <span
            title={t('versions.primary')}
            className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          >
            <Crown size={10} />
            {t('versions.primary')}
          </span>
        ) : null}
      </div>
      {author || hymnNumber ? (
        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
          {[hymnNumber, author].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      {categoryName || keyLine ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          {categoryName ? (
            <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              <Tag className="h-3 w-3" />
              {categoryName}
            </span>
          ) : null}
          {keyLine ? (
            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <Music2 className="h-3 w-3" />
              {keyLine}
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

/**
 * Renders the "Sugestii" sub-section: songs the server flagged as likely
 * versions (highest similarity first), with accept ("aceeași cântare") and
 * dismiss controls. When the server returns nothing it's hidden — unless
 * `showEmptyState` asks for the subtle "no other versions" line (used in
 * the standalone state, where the section is the whole panel body).
 */
function SuggestionsSection({
  songId,
  canAdd,
  topBorder = true,
  showEmptyState = false,
}: {
  songId: number
  /**
   * Lets the operator turn a suggestion into a linked version (the ✓ accept
   * and ✗ dismiss buttons). Mapped to `songs.create` at the route level —
   * an operator who can add songs to the corpus can also link suggested
   * ones; view-only operators see the suggestions but no buttons.
   */
  canAdd: boolean
  /** Draw the separating top border. False when this is the first thing in
   *  the panel body (no linked versions above it) so there's no stray line. */
  topBorder?: boolean
  /** Render a subtle "no other versions found" line instead of vanishing
   *  when there are no suggestions. */
  showEmptyState?: boolean
}) {
  const { t } = useTranslation('songs')
  const { showToast } = useToast()
  const { data: suggestions = [], isLoading } = useSimilarSongs(songId)
  const linkMutation = useLinkSongs()
  // Track ids that just got accepted so the row can play a brief fade-out
  // before vanishing. Without this the click would feel jarring — the row
  // would disappear with no acknowledgement.
  const [acceptingIds, setAcceptingIds] = useState<Set<number>>(new Set())
  // Ids that have been linked this session — kept filtered out so a just-
  // approved song never flashes back in before the server refetch (which
  // already excludes group members) lands.
  const [linkedIds, setLinkedIds] = useState<Set<number>>(new Set())
  // Forces a re-render after a dismissal so the row disappears immediately
  // without waiting for the query cache to refresh.
  const [dismissTick, setDismissTick] = useState(0)

  const visible = useMemo(
    () =>
      suggestions
        .filter(
          (s) => !isDismissed(songId, s.songId) && !linkedIds.has(s.songId),
        )
        // Best match first — the percentage shown on each row is the score,
        // so the list must read top-down from most to least similar.
        .sort((a, b) => b.score - a.score),
    // dismissTick intentionally invalidates the memo after a dismissal so the
    // re-read of localStorage (isDismissed) takes effect immediately.
    [suggestions, songId, dismissTick, linkedIds],
  )

  // Suggestions are visible to *every* logged-in user (read-only viewers
  // included) — discovering that "this song looks like another one" is a
  // browse feature, not an edit one. The accept / dismiss buttons below
  // are still gated by `canAdd` so view-only operators can browse but
  // not mutate.
  if (isLoading) return null
  if (visible.length === 0) {
    if (!showEmptyState) return null
    return (
      <p
        data-testid="versions-empty-state"
        className="mt-3 px-1 text-xs italic text-gray-400 dark:text-gray-500"
      >
        {t('versions.noSuggestions')}
      </p>
    )
  }

  async function handleAccept(suggestedId: number, suggestedTitle: string) {
    setAcceptingIds((prev) => new Set(prev).add(suggestedId))
    try {
      await linkMutation.mutateAsync({
        songIdA: songId,
        songIdB: suggestedId,
      })
      // Brief acknowledgement so the user sees the action register; the
      // panel above will refresh its members list automatically.
      showToast(t('versions.linkSuccess', { title: suggestedTitle }), 'success')
      // The 220ms timeout matches the row's exit transition so the toast
      // appears and the row fades out simultaneously — feels coherent. Once
      // the fade is done, mark it linked so it stays gone regardless of when
      // the suggestions refetch lands.
      window.setTimeout(() => {
        setLinkedIds((prev) => new Set(prev).add(suggestedId))
        setAcceptingIds((prev) => {
          const next = new Set(prev)
          next.delete(suggestedId)
          return next
        })
      }, 220)
    } catch (error) {
      setAcceptingIds((prev) => {
        const next = new Set(prev)
        next.delete(suggestedId)
        return next
      })
      showToast(
        t('versions.linkError', {
          error: error instanceof Error ? error.message : String(error),
        }),
        'error',
      )
    }
  }

  function handleDismiss(suggestedId: number) {
    dismissSuggestion(songId, suggestedId)
    setDismissTick((n) => n + 1)
  }

  return (
    <div
      className={
        topBorder
          ? 'mt-3 border-t border-gray-200 pt-3 dark:border-gray-700'
          : ''
      }
    >
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <Sparkles size={12} />
        {t('versions.suggestionsTitle')}
      </div>
      <ul className="space-y-1">
        {visible.map((s) => {
          const isAccepting = acceptingIds.has(s.songId)
          return (
            <li
              key={s.songId}
              data-testid="version-suggestion-row"
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-all duration-200 ${
                isAccepting
                  ? 'translate-x-2 opacity-0'
                  : 'opacity-100 hover:bg-gray-50 dark:hover:bg-gray-700/40'
              }`}
            >
              <Link
                to="/songs/$songId"
                params={{ songId: String(s.songId) }}
                className="min-w-0 flex-1"
              >
                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                  {s.title}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {s.categoryName ? (
                    <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      <Tag className="h-3 w-3" />
                      {s.categoryName}
                    </span>
                  ) : null}
                  {s.keyLine ? (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      <Music2 className="h-3 w-3" />
                      {s.keyLine}
                    </span>
                  ) : null}
                  <span>
                    {t('versions.percentSimilar', {
                      percent: Math.round(s.score * 100),
                    })}
                  </span>
                </div>
              </Link>
              {canAdd ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleAccept(s.songId, s.title)}
                    disabled={linkMutation.isPending || isAccepting}
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
                </>
              ) : null}
            </li>
          )
        })}
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
   * Display details for the currently-opened song, used to render its row
   * at the top of the panel when the song is standalone (no group yet).
   * Optional so callers without the detail payload degrade to title-only.
   */
  currentSong?: {
    hymnNumber: string | null
    author: string | null
    keyLine: string | null
    categoryName: string | null
  }
  /**
   * Lets the operator add new versions: the "+ Adaugă o versiune" CTA,
   * the ✓ accept suggestion button, and the ✗ dismiss suggestion button.
   * Mapped to `song_versions.create` at the route level.
   */
  canAdd: boolean
  /**
   * Lets the operator change which member is the primary version of the
   * group. Mapped to `song_versions.edit`.
   */
  canEdit: boolean
  /**
   * Lets the operator unlink a member ("Nu e aceeași cântare"). Mapped
   * to `song_versions.delete` — semantically a removal, not a content
   * edit.
   */
  canDelete: boolean
  /**
   * When provided, renders a chevron toggle inline with the title so the
   * panel can act as its own accordion section (no wrapping
   * `CollapsibleSection`, which used to introduce a redundant header bar).
   * The body collapses when `isCollapsed` is true; the header keeps the
   * count + "+ Link versions" CTA visible.
   */
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  /**
   * Optional badge rendered next to the count (e.g. `+2` for unread
   * suggestions). The route owns this so it can pull from
   * `useUndismissedSuggestionCount` without the panel re-fetching.
   */
  attentionBadge?: string | null
}

/**
 * Read+write panel for the "Versiuni ale cântării" section of a song. The
 * currently-opened song always leads the list, highlighted. When the song
 * has no group yet, it's followed by the suggestions list, best match
 * first (with a "Same song as…" CTA in the header when `canAdd` is true),
 * or a subtle empty line when nothing matches. When grouped, every member
 * is listed with quick actions.
 *
 * Always renders its own chrome + header so it visually mirrors
 * `SongBookmarksPanel` when both sit stacked in the right-column accordion.
 * The optional chevron prop makes the header act as a collapse toggle.
 */
export function SongVersionsPanel({
  songId,
  songTitle,
  currentSong,
  canAdd,
  canEdit,
  canDelete,
  isCollapsed = false,
  onToggleCollapse,
  attentionBadge,
}: SongVersionsPanelProps) {
  const { t } = useTranslation('songs')
  const { data: group, isLoading } = useSongGroup(songId)
  const setPrimary = useSetPrimarySong()
  const unlink = useUnlinkSong()
  const [isLinkModalOpen, setLinkModalOpen] = useState(false)

  const memberCount = group?.members.length ?? 0

  // The opened song always leads the list ("you are here"); the rest keep
  // the server's title order. Stable sort, so only the current song moves.
  const sortedMembers = useMemo(() => {
    if (!group) return []
    return [...group.members].sort((a, b) => {
      if (a.songId === songId) return -1
      if (b.songId === songId) return 1
      return 0
    })
  }, [group, songId])

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Header — mirrors SongBookmarksPanel: chevron (optional) + icon +
          title + count + attention badge + CTA on the right. */}
      <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <div className="flex min-w-0 items-center gap-2">
          {onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-expanded={!isCollapsed}
              aria-label={
                isCollapsed
                  ? t('versions.expand', 'Expand')
                  : t('versions.collapse', 'Collapse')
              }
              data-testid="versions-collapse-toggle"
              className="-ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-500 transition-transform hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
              />
            </button>
          ) : null}
          <Layers className="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
          <span className="truncate text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('versions.title')}
          </span>
          {memberCount > 0 ? (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({memberCount})
            </span>
          ) : null}
          {attentionBadge ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              {attentionBadge}
            </span>
          ) : null}
        </div>
        {canAdd && !isLoading ? (
          <button
            type="button"
            onClick={() => setLinkModalOpen(true)}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
          >
            <Plus size={14} />
            {t('versions.addButton')}
          </button>
        ) : null}
      </div>

      {/* Body — gated by isCollapsed. The three states (loading / no group /
          grouped) share the same chrome so transitions don't flicker. */}
      {isCollapsed ? null : (
        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 size={14} className="animate-spin" />
            </div>
          ) : !group ? (
            // Standalone song: the opened song leads (highlighted, "you are
            // here"), then the suggestions. View-only operators still get
            // the suggestions list (read-only) so they can discover that
            // "this song might have a sibling" without being able to
            // mutate. Editors get the same list plus the accept/dismiss
            // buttons that `SuggestionsSection` renders internally.
            <>
              <div
                data-testid="version-current-row"
                className={`relative flex items-center gap-3 rounded-lg border px-3 py-2 ${currentRowClasses}`}
              >
                <div className="min-w-0 flex-1">
                  <VersionRowInfo
                    title={songTitle}
                    hymnNumber={currentSong?.hymnNumber ?? null}
                    author={currentSong?.author ?? null}
                    keyLine={currentSong?.keyLine ?? null}
                    categoryName={currentSong?.categoryName ?? null}
                    isCurrent
                  />
                </div>
              </div>
              <SuggestionsSection
                songId={songId}
                canAdd={canAdd}
                showEmptyState
              />
            </>
          ) : (
            <>
              <ul className="space-y-1.5">
                {sortedMembers.map((member) => {
                  const isCurrent = member.songId === songId
                  return (
                    <li
                      key={member.songId}
                      data-testid={
                        isCurrent ? 'version-current-row' : 'version-member-row'
                      }
                      className={`relative flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                        isCurrent
                          ? currentRowClasses
                          : 'group cursor-pointer border-gray-200 hover:border-indigo-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-indigo-500/40 dark:hover:bg-gray-700/40'
                      }`}
                    >
                      {/* Whole-box click target (non-current). Sits beneath the
                          action buttons (relative z-10) so they stay clickable;
                          everything else in the row opens the song. */}
                      {!isCurrent ? (
                        <Link
                          to="/songs/$songId"
                          params={{ songId: String(member.songId) }}
                          title={t('versions.open')}
                          aria-label={member.title}
                          className="absolute inset-0 rounded-lg"
                        />
                      ) : null}
                      {/* Title + badges + author/hymn line. For other members
                          the stretched Link above makes the whole row a click
                          target; the title tints via the row's `group` hover. */}
                      <div className="min-w-0 flex-1">
                        <VersionRowInfo
                          title={member.title}
                          hymnNumber={member.hymnNumber}
                          author={member.author}
                          keyLine={member.keyLine}
                          categoryName={member.categoryName}
                          isPrimary={member.isPrimary}
                          isCurrent={isCurrent}
                        />
                      </div>

                      <div className="relative z-10 flex shrink-0 items-center gap-1">
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
                        {canDelete ? (
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
              <SuggestionsSection songId={songId} canAdd={canAdd} />
            </>
          )}
        </div>
      )}

      <LinkVersionsModal
        isOpen={isLinkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        currentSongId={songId}
        currentSongTitle={songTitle}
      />
    </div>
  )
}
