import { describe, expect, it } from 'vitest'

import type { ScheduleItem } from '../../types'
import { changedKeyLines } from '../changedKeyLines'
import type { ParsedScheduleItem } from '../parseScheduleText'

const shown = (songId: number, keyLine: string | null) =>
  ({ songId, keyLine }) as ScheduleItem

const line = (keyLine?: string): ParsedScheduleItem => ({
  type: 'song',
  content: 'Song',
  lineNumber: 1,
  ...(keyLine !== undefined && { keyLine }),
})

describe('schedules/utils/changedKeyLines', () => {
  it('keeps only gamas that differ from the program', () => {
    const edits = changedKeyLines(
      [line('Re'), line('Sol'), line(''), line()],
      [1, 2, 3, 4],
      [shown(1, 'Re'), shown(2, null), shown(3, 'La'), shown(4, 'Mi')],
    )
    expect(edits).toEqual([
      { songId: 2, keyLine: 'Sol' },
      { songId: 3, keyLine: '' },
    ])
  })

  it('treats empty braces on a song without gama as unchanged', () => {
    expect(changedKeyLines([line('')], [1], [shown(1, null)])).toEqual([])
  })

  it('writes the gama of a song new to the program, skips unresolved ones', () => {
    expect(
      changedKeyLines([line('Do'), line('Fa')], [9, undefined], []),
    ).toEqual([{ songId: 9, keyLine: 'Do' }])
  })
})
