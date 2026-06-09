/**
 * Parses the on-disk log format
 *   [ISO_TIMESTAMP] [LEVEL] [category] message
 * (Tauri lines omit the category) into structured, colourable lines.
 *
 * Lines that don't start with a timestamp are either day separators
 * ("=== server 2026-06-06 ===", emitted by readRecentLogs) or continuation
 * lines of a multi-line message (e.g. a stack trace). Continuations inherit the
 * previous line's level so a whole error block stays red.
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'other'

export interface ParsedLogLine {
  level: LogLevel
  /** True for the "=== server DATE ===" day separators. */
  isSeparator: boolean
  text: string
}

const LINE_RE = /^\[\d{4}-\d{2}-\d{2}T[^\]]+\]\s+\[([A-Za-z]+)\]/

function toLevel(token: string): LogLevel {
  switch (token.toLowerCase()) {
    case 'error':
      return 'error'
    case 'warn':
    case 'warning':
      return 'warn'
    case 'info':
      return 'info'
    case 'debug':
    case 'trace':
    case 'verbose':
      return 'debug'
    default:
      return 'other'
  }
}

export function parseLogLines(blob: string): ParsedLogLine[] {
  if (!blob) return []
  const out: ParsedLogLine[] = []
  let lastLevel: LogLevel = 'other'

  for (const text of blob.split('\n')) {
    if (text.trim() === '') continue

    const match = text.match(LINE_RE)
    if (match) {
      lastLevel = toLevel(match[1])
      out.push({ level: lastLevel, isSeparator: false, text })
      continue
    }

    if (text.startsWith('=== ')) {
      lastLevel = 'other'
      out.push({ level: 'other', isSeparator: true, text })
      continue
    }

    // Continuation line (stack trace, wrapped message) — keep the parent level.
    out.push({ level: lastLevel, isSeparator: false, text })
  }

  return out
}
