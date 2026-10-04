import { describe, expect, it } from 'vitest'

import { todayProgramTitle } from '../todayProgramTitle'

describe('todayProgramTitle', () => {
  it('writes the date as DD.MM.YYYY', () => {
    expect(todayProgramTitle(new Date(2026, 9, 4))).toBe('04.10.2026')
    expect(todayProgramTitle(new Date(2026, 11, 25))).toBe('25.12.2026')
  })
})
