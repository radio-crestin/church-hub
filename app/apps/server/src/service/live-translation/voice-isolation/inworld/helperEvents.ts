import { inworldLogger as logger } from './inworldLogger'

export interface HelperEvent {
  event: 'progress' | 'done' | 'bench' | 'ready' | 'error'
  received?: number
  total?: number
  device?: string
  rtf?: number
  message?: string
}

/** A helper stderr line: its event, or null for a log line (logged). */
export function parseHelperLine(line: string): HelperEvent | null {
  if (line.startsWith('{"event"')) {
    try {
      return JSON.parse(line) as HelperEvent
    } catch {
      // a truncated line is only logged
    }
  }
  logger.debug('helper', { line })
  return null
}
