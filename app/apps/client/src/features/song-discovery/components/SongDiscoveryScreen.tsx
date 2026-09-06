import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, RefreshCw, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { defaultSongMetadata } from '~/features/songs/components/SongDetailsSection'
import { useCategories, useUpsertCategory } from '~/features/songs/hooks'
import { useToast } from '~/ui/toast'
import { CandidateEditorPanel } from './CandidateEditorPanel'
import { CandidateList } from './CandidateList'
import { DiscoveryProgress } from './DiscoveryProgress'
import { DiscoveryToolbar } from './DiscoveryToolbar'
import { useFetchCatalog } from '../hooks/useFetchCatalog'
import { useImportApproved } from '../hooks/useImportApproved'
import { useMatchCandidates } from '../hooks/useMatchCandidates'
import { getProvider, PROVIDERS } from '../providers'
import type { CandidateDraft, DiscoveryCandidate, StagingItem } from '../types'

interface SongDiscoveryScreenProps {
  onBack?: () => void
}

/** Seeds an editable draft from a parsed external candidate. */
function buildDraft(
  candidate: DiscoveryCandidate,
  defaultCategoryId: number | null,
): CandidateDraft {
  const m = candidate.parsed.metadata
  return {
    title: candidate.parsed.title,
    categoryId: defaultCategoryId,
    slides: candidate.parsed.slides.map((slide, idx) => ({
      id: `${candidate.tempId}-slide-${idx}`,
      content: slide.htmlContent,
      sortOrder: idx,
      label: slide.label ?? null,
    })),
    metadata: {
      ...defaultSongMetadata,
      sourceFilename: candidate.sourceFilename,
      author: m?.author ?? null,
      copyright: m?.copyright ?? null,
      ccli: m?.ccli ?? null,
      tempo: m?.tempo ?? null,
      timeSignature: m?.timeSignature ?? null,
      theme: m?.theme ?? null,
      altTheme: m?.altTheme ?? null,
      hymnNumber: m?.hymnNumber ?? null,
      keyLine: m?.keyLine ?? null,
      presentationOrder: m?.presentationOrder ?? null,
    },
  }
}

/** A compact count chip for the stats strip. */
function StatChip({
  value,
  label,
  accent = false,
}: {
  value: number
  label: string
  accent?: boolean
}) {
  return (
    <div
      className={`flex items-baseline gap-1.5 rounded-lg px-3 py-1.5 ${
        accent
          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
      }`}
    >
      <span className="text-sm font-semibold tabular-nums">{value}</span>
      <span className="text-xs">{label}</span>
    </div>
  )
}

/**
 * Staging screen for importing new songs from external sources. Reuses the
 * catalog the background sync already downloaded (so it appears instantly),
 * streams the library diff with a live progress indicator, and lets the
 * operator edit + approve/skip each new song before a single batch import.
 */
export function SongDiscoveryScreen({ onBack }: SongDiscoveryScreenProps) {
  const { t } = useTranslation('songDiscovery')
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  // Single source today; the provider registry stays extensible for more.
  const providerId = PROVIDERS[0]?.id ?? ''
  const [selectedTempId, setSelectedTempId] = useState<string | null>(null)
  // Per-candidate edits/decisions, keyed by tempId, preserved across re-diffs.
  const [items, setItems] = useState<Record<string, StagingItem>>({})
  // tempIds already imported this session — permanently dropped from the list so
  // they never reappear, without re-running the whole diff.
  const [importedTempIds, setImportedTempIds] = useState<Set<string>>(
    () => new Set(),
  )
  // Bumped only by the explicit "Refresh catalog" action to re-analyze.
  const [refreshNonce, setRefreshNonce] = useState(0)

  const { data: categories } = useCategories()
  const { mutateAsync: upsertCategory } = useUpsertCategory()
  // Auto-starts on mount — the background sync usually primed the cache, so the
  // catalog (and the diff) appear immediately with no extra click.
  const {
    candidates,
    isFetching,
    progress,
    refetch,
    error: fetchError,
  } = useFetchCatalog(providerId)

  const {
    results,
    isMatching,
    progress: matchProgress,
    error: matchError,
  } = useMatchCandidates(providerId, candidates, refreshNonce)

  const defaultCategoryId = useMemo(() => {
    const provider = getProvider(providerId)
    if (!provider) return null
    return (
      categories?.find((c) => c.name === provider.defaultCategoryName)?.id ??
      null
    )
  }, [categories, providerId])

  // Reconcile match results into staging items, keeping only songs the user
  // lacks (verdict similar/new), excluding ones already imported this session,
  // and preserving any in-flight edits/decisions. Runs as results stream in, so
  // the list grows progressively.
  useEffect(() => {
    if (results.length === 0) {
      setItems({})
      return
    }
    const candidatesByTempId = new Map(candidates.map((c) => [c.tempId, c]))

    setItems((prev) => {
      const next: Record<string, StagingItem> = {}
      for (const result of results) {
        if (
          result.verdict === 'exact-filename' ||
          result.verdict === 'exact-title'
        ) {
          continue // already in the library — hide it
        }
        if (importedTempIds.has(result.tempId)) {
          continue // imported this session — don't bring it back
        }
        const candidate = candidatesByTempId.get(result.tempId)
        if (!candidate) continue

        const existing = prev[result.tempId]
        next[result.tempId] = {
          tempId: result.tempId,
          candidate,
          verdict: result.verdict,
          similar: result.similar,
          draft: existing?.draft ?? buildDraft(candidate, defaultCategoryId),
          decision: existing?.decision ?? 'pending',
        }
      }
      return next
    })
  }, [results, defaultCategoryId, importedTempIds])

  const stagingItems = useMemo(
    () => Object.values(items).sort((a, b) => a.tempId.localeCompare(b.tempId)),
    [items],
  )

  const approvedItems = useMemo(
    () => stagingItems.filter((i) => i.decision === 'approve'),
    [stagingItems],
  )

  const selectedItem = selectedTempId ? items[selectedTempId] : null

  const { importApproved, isPending: isImporting } = useImportApproved()

  const handleDecide = (tempId: string, decision: 'approve' | 'skip') => {
    setItems((prev) => {
      const item = prev[tempId]
      if (!item) return prev
      // Toggle off when re-clicking the active decision.
      const nextDecision = item.decision === decision ? 'pending' : decision
      return { ...prev, [tempId]: { ...item, decision: nextDecision } }
    })
  }

  const handleDraftChange = (tempId: string, draft: CandidateDraft) => {
    setItems((prev) => {
      const item = prev[tempId]
      if (!item) return prev
      return { ...prev, [tempId]: { ...item, draft } }
    })
  }

  const handleApproveAllNew = () => {
    setItems((prev) => {
      const next = { ...prev }
      for (const tempId of Object.keys(next)) {
        next[tempId] = { ...next[tempId], decision: 'approve' }
      }
      return next
    })
  }

  const handleImport = async () => {
    if (approvedItems.length === 0) return

    // Ensure the provider's default category exists for items that still point
    // at it by id-less default (categoryId null seeded from a missing category).
    let resolvedCategoryId = defaultCategoryId
    const provider = getProvider(providerId)
    if (resolvedCategoryId == null && provider) {
      const created = await upsertCategory({
        name: provider.defaultCategoryName,
      })
      if (created.success && created.category) {
        resolvedCategoryId = created.category.id
      }
    }

    const toImport = approvedItems.map((item) =>
      item.draft.categoryId == null && resolvedCategoryId != null
        ? { ...item, draft: { ...item.draft, categoryId: resolvedCategoryId } }
        : item,
    )

    try {
      const importedIds = await importApproved(toImport)
      // Permanently drop the imported rows and KEEP the rest of the list as-is —
      // no automatic re-analyze. Tracking the tempIds also stops the streaming
      // reconcile from bringing them back. The main song list still refreshes.
      const justImported = approvedItems.map((i) => i.tempId)
      setImportedTempIds((prev) => {
        const next = new Set(prev)
        for (const id of justImported) next.add(id)
        return next
      })
      setItems((prev) => {
        const next: Record<string, StagingItem> = {}
        for (const [tempId, item] of Object.entries(prev)) {
          if (!justImported.includes(tempId)) next[tempId] = item
        }
        return next
      })
      if (selectedTempId && justImported.includes(selectedTempId)) {
        setSelectedTempId(null)
      }
      queryClient.invalidateQueries({ queryKey: ['songs'] })
      showToast(t('toast.imported', { count: importedIds.length }), 'success')
    } catch (error) {
      showToast(t('toast.importFailed', { error: String(error) }), 'error')
    }
  }

  // Explicit, user-initiated re-analyze: re-download the catalog and re-run the
  // diff from scratch (clears the session's imported set).
  const handleRefresh = () => {
    setItems({})
    setImportedTempIds(new Set())
    setSelectedTempId(null)
    setRefreshNonce((n) => n + 1)
    refetch()
  }

  // Phase booleans for the progress / empty states.
  const fetchRatio =
    progress && progress.total ? progress.current / progress.total : null
  const analyzePct =
    matchProgress.total > 0
      ? Math.round((matchProgress.analyzed / matchProgress.total) * 100)
      : 0
  const isBusy = isFetching || isMatching

  // Rich progress detail so the bar visibly reports what's happening.
  const toMb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10
  const fetchLabel = progress
    ? t(`status.phase.${progress.phase}`, {
        defaultValue: t('status.fetching'),
      })
    : t('status.fetching')
  const fetchDetail =
    fetchRatio != null ? `${Math.round(fetchRatio * 100)}%` : undefined
  const fetchMeta = !progress
    ? undefined
    : progress.phase === 'downloading'
      ? progress.total
        ? `${toMb(progress.current)} / ${toMb(progress.total)} MB`
        : progress.current > 0
          ? `${toMb(progress.current)} MB`
          : undefined
      : progress.total
        ? t('status.filesMeta', {
            current: progress.current,
            total: progress.total,
          })
        : (progress.currentFile ?? undefined)
  const analyzeMeta = t('status.analyzeMeta', {
    analyzed: matchProgress.analyzed.toLocaleString(),
    total: matchProgress.total.toLocaleString(),
    found: stagingItems.length,
  })
  const loadError = fetchError ?? matchError
  const showAllPresent =
    !isBusy && candidates.length > 0 && stagingItems.length === 0
  const showResults = stagingItems.length > 0

  // No padding of its own: the app layout already pads every page, and
  // doubling it left a visible gap above the title.
  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            aria-label={t('back')}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-gray-900 dark:text-white">
            {t('title')}
          </h1>
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">
            {t('description')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isBusy}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
        >
          <RefreshCw className={`h-4 w-4 ${isBusy ? 'animate-spin' : ''}`} />
          {t('source.refresh')}
        </button>
      </div>

      {/* Progress band — download/parse, then analyze, with live counts. */}
      {isFetching && (
        <DiscoveryProgress
          label={fetchLabel}
          ratio={fetchRatio}
          detail={fetchDetail}
          meta={fetchMeta}
        />
      )}
      {!isFetching && isMatching && (
        <DiscoveryProgress
          label={t('status.analyzing')}
          ratio={matchProgress.total > 0 ? analyzePct / 100 : null}
          detail={matchProgress.total > 0 ? `${analyzePct}%` : undefined}
          meta={matchProgress.total > 0 ? analyzeMeta : undefined}
        />
      )}

      {/* Stats strip */}
      {(showResults || (!isBusy && candidates.length > 0)) && (
        <div className="flex flex-wrap items-center gap-2">
          <StatChip value={candidates.length} label={t('stats.online')} />
          <StatChip value={stagingItems.length} label={t('stats.new')} accent />
          {approvedItems.length > 0 && (
            <StatChip
              value={approvedItems.length}
              label={t('stats.selected')}
            />
          )}
        </div>
      )}

      {loadError && !isBusy && !showResults ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
            {t('error.failed')}
          </p>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            <RefreshCw className="h-4 w-4" />
            {t('error.retry')}
          </button>
        </div>
      ) : showAllPresent ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400">
            <Sparkles className="h-6 w-6" />
          </div>
          <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
            {importedTempIds.size > 0 ? t('allDone') : t('allPresent')}
          </p>
          {/* Re-analyzing the catalog is now opt-in: offer it here once the list
              is empty, instead of forcing it after every import. */}
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            <RefreshCw className="h-4 w-4" />
            {t('source.refresh')}
          </button>
        </div>
      ) : !showResults && isBusy ? (
        // Skeleton placeholder while the first results stream in.
        <div className="flex flex-1 flex-col gap-2">
          {['a', 'b', 'c', 'd', 'e'].map((k) => (
            <div
              key={k}
              className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800/60"
            />
          ))}
        </div>
      ) : showResults ? (
        <>
          <DiscoveryToolbar
            totalCount={stagingItems.length}
            approvedCount={approvedItems.length}
            onApproveAllNew={handleApproveAllNew}
            onImport={handleImport}
            isImporting={isImporting}
          />

          <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
            <div className="w-full shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:max-w-sm">
              <CandidateList
                items={stagingItems}
                selectedTempId={selectedTempId}
                onSelect={setSelectedTempId}
                onDecide={handleDecide}
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {selectedItem ? (
                <CandidateEditorPanel
                  item={selectedItem}
                  onDraftChange={handleDraftChange}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <Sparkles className="h-6 w-6 text-gray-300 dark:text-gray-600" />
                  {t('selectPrompt')}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
