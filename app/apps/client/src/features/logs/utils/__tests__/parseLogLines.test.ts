import { describe, expect, it } from 'vitest'

import { parseLogLines } from '../parseLogLines'

describe('parseLogLines', () => {
  it('classifies each level from the on-disk format', () => {
    const blob = [
      '[2026-06-06T08:25:50.245Z] [INFO] [midi] Initializing',
      '[2026-06-06T08:25:50.246Z] [WARN] [http] GET /x → 404',
      '[2026-06-06T08:25:50.247Z] [ERROR] [api-handler] boom',
      '[2026-06-06T08:25:50.248Z] [DEBUG] [websocket] tick',
    ].join('\n')

    const lines = parseLogLines(blob)
    expect(lines.map((l) => l.level)).toEqual([
      'info',
      'warn',
      'error',
      'debug',
    ])
  })

  it('maps WARNING/TRACE/VERBOSE onto warn/debug', () => {
    const blob = [
      '[2026-06-06T08:25:50.245Z] [WARNING] x',
      '[2026-06-06T08:25:50.246Z] [TRACE] y',
      '[2026-06-06T08:25:50.247Z] [VERBOSE] z',
    ].join('\n')
    expect(parseLogLines(blob).map((l) => l.level)).toEqual([
      'warn',
      'debug',
      'debug',
    ])
  })

  it('marks day separators and inherits level on continuation lines', () => {
    const blob = [
      '=== server 2026-06-06 ===',
      '[2026-06-06T08:25:50.247Z] [ERROR] [api] failed',
      '    at someFunction (file.ts:10:5)',
      '    at next (file.ts:20:1)',
    ].join('\n')

    const lines = parseLogLines(blob)
    expect(lines[0]).toMatchObject({ isSeparator: true, level: 'other' })
    expect(lines[1].level).toBe('error')
    // Stack-trace continuation lines stay red (inherit the error level).
    expect(lines[2].level).toBe('error')
    expect(lines[3].level).toBe('error')
  })

  it('skips blank lines and handles empty input', () => {
    expect(parseLogLines('')).toEqual([])
    expect(parseLogLines('\n\n  \n')).toEqual([])
  })
})
