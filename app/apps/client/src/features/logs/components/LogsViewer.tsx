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
  info: 'text-fg-body',
  debug: 'text-fg-hint',
  other: 'text-fg-label',
}

const CHIP_ACTIVE = 'bg-selected text-fg'
const CHIP_INACTIVE = 'text-fg-hint hover:bg-hover hover:text-fg'

const DOT: Record<FilterLevel, string> = {
  error: 'bg-red-500',
  warn: 'bg-amber-500',
  info: 'bg-fg-label',
  debug: 'bg-fg-hint',
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
      <h4 className="mb-1.5 text-xs font-medium text-fg-hint">{heading}</h4>
      <div className="max-h-72 overflow-auto rounded-xl border border-line bg-app p-3 font-mono text-xs leading-relaxed">
        {lines.length === 0 ? (
          <p className="text-fg-hint">{t('sections.logs.viewer.noMatches')}</p>
        ) : (
          lines.map((line, i) => (
            <div
              // Log lines aren't uniquely identifiable; the list never reorders.
              key={i}
              className={`whitespace-pre-wrap break-words ${
                line.isSeparator
                  ? 'mt-2 font-semibold text-fg'
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
        <p className="min-w-0 break-all font-mono text-xs text-fg-hint">
          {data?.logsDir}
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex h-8 items-center gap-2 rounded-lg bg-field px-3 text-sm font-medium text-fg transition-colors hover:bg-hover disabled:opacity-50"
        >
          <RefreshCw
            strokeWidth={1.5}
            className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
          />
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
          <AlertCircle strokeWidth={1.5} className="h-4 w-4 shrink-0" />
          {t('sections.logs.toast.loadFailed', { error })}
        </p>
      ) : (
        <>
          {/* Full-width search, with the level filters arranged below it. */}
          <div className="space-y-2">
            <div className="relative w-full">
              <Search
                strokeWidth={1.5}
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-hint"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('sections.logs.viewer.search')}
                className="h-9 w-full rounded-[10px] bg-field pl-9 pr-3 text-sm text-fg placeholder:text-fg-hint outline-none transition-colors focus:ring-1 focus:ring-inset focus:ring-focus"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {FILTER_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => toggle(level)}
                  aria-pressed={enabled[level]}
                  className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors ${
                    enabled[level] ? CHIP_ACTIVE : CHIP_INACTIVE
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${DOT[level]}`} />
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
