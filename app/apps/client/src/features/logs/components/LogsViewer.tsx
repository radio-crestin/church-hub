import { AlertCircle, RefreshCw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { LogsContent } from '../service'
import {
  type LogLevel,
  type ParsedLogLine,
  parseLogLines,
} from '../utils/parseLogLines'

interface LogsViewerProps {
  data: LogsContent | null
  isLoading: boolean
  error: string | null
  onRefresh: () => void
}

type FilterLevel = 'error' | 'warn' | 'info' | 'debug'
const FILTER_LEVELS: FilterLevel[] = ['error', 'warn', 'info', 'debug']

// Per-line text colour: errors red, warnings amber, info normal, debug muted.
const LINE_COLOR: Record<LogLevel, string> = {
  error: 'text-red-600 dark:text-red-400',
  warn: 'text-amber-600 dark:text-amber-400',
  info: 'text-gray-800 dark:text-gray-200',
  debug: 'text-gray-400 dark:text-gray-500',
  other: 'text-gray-600 dark:text-gray-300',
}

const CHIP_ACTIVE: Record<FilterLevel, string> = {
  error:
    'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300',
  warn: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  info: 'border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-200',
  debug:
    'border-gray-300 bg-gray-100 text-gray-600 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-300',
}
const CHIP_INACTIVE =
  'border-gray-200 bg-transparent text-gray-400 dark:border-gray-700 dark:text-gray-500'

const DOT: Record<FilterLevel, string> = {
  error: 'bg-red-500',
  warn: 'bg-amber-500',
  info: 'bg-gray-400',
  debug: 'bg-gray-300 dark:bg-gray-600',
}

function LogBlock({
  heading,
  lines,
}: {
  heading: string
  lines: ParsedLogLine[]
}) {
  const { t } = useTranslation('settings')
  return (
    <div className="min-w-0">
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {heading}
      </h4>
      <div className="max-h-72 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs leading-relaxed dark:border-gray-700 dark:bg-gray-900">
        {lines.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-500">
            {t('sections.logs.viewer.noMatches')}
          </p>
        ) : (
          lines.map((line, i) => (
            <div
              // Log lines aren't uniquely identifiable; the list never reorders.
              // biome-ignore lint/suspicious/noArrayIndexKey: log line list
              key={i}
              className={`whitespace-pre-wrap break-words ${
                line.isSeparator
                  ? 'mt-2 font-semibold text-indigo-600 dark:text-indigo-400'
                  : LINE_COLOR[line.level]
              }`}
            >
              {line.text}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/** Read-only viewer for the recent server + Tauri log tails. */
export function LogsViewer({
  data,
  isLoading,
  error,
  onRefresh,
}: LogsViewerProps) {
  const { t } = useTranslation('settings')
  const [enabled, setEnabled] = useState<Record<FilterLevel, boolean>>({
    error: true,
    warn: true,
    info: true,
    debug: true,
  })
  const [search, setSearch] = useState('')

  const serverParsed = useMemo(
    () => parseLogLines(data?.serverTail ?? ''),
    [data?.serverTail],
  )
  const tauriParsed = useMemo(
    () => parseLogLines(data?.tauriTail ?? ''),
    [data?.tauriTail],
  )

  const query = search.trim().toLowerCase()
  const matches = useMemo(() => {
    return (line: ParsedLogLine): boolean => {
      // 'other' (separators / unparsed) bypass the level filter.
      if (line.level !== 'other' && !enabled[line.level]) return false
      if (query && !line.text.toLowerCase().includes(query)) return false
      return true
    }
  }, [enabled, query])

  const serverLines = useMemo(
    () => serverParsed.filter(matches),
    [serverParsed, matches],
  )
  const tauriLines = useMemo(
    () => tauriParsed.filter(matches),
    [tauriParsed, matches],
  )

  const toggle = (level: FilterLevel) =>
    setEnabled((prev) => ({ ...prev, [level]: !prev[level] }))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 break-all font-mono text-xs text-gray-500 dark:text-gray-400">
          {data?.logsDir}
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading
            ? t('sections.logs.viewer.refreshing')
            : t('sections.logs.viewer.refresh')}
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {t('sections.logs.toast.loadFailed', { error })}
        </p>
      ) : (
        <>
          {/* Full-width search, with the level filters arranged below it. */}
          <div className="space-y-2">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('sections.logs.viewer.search')}
                className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {FILTER_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => toggle(level)}
                  aria-pressed={enabled[level]}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    enabled[level] ? CHIP_ACTIVE[level] : CHIP_INACTIVE
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${DOT[level]}`} />
                  {t(
                    `sections.logs.viewer.levels.${
                      level === 'warn' ? 'warning' : level
                    }`,
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <LogBlock
              heading={t('sections.logs.viewer.serverHeading')}
              lines={serverLines}
            />
            <LogBlock
              heading={t('sections.logs.viewer.tauriHeading')}
              lines={tauriLines}
            />
          </div>
        </>
      )}
    </div>
  )
}
