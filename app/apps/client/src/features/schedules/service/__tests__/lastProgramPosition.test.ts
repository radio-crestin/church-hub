import { describe, expect, it } from 'vitest'

import {
  readProgramPosition,
  rememberProgramPosition,
} from '../lastProgramPosition'

describe('lastProgramPosition', () => {
  it('is -1 for a program never seen live, or no program', () => {
    expect(readProgramPosition(41)).toBe(-1)
    expect(readProgramPosition(null)).toBe(-1)
  })

  it('keeps the latest step each program was live at', () => {
    rememberProgramPosition(42, 3)
    rememberProgramPosition(43, 7)
    rememberProgramPosition(42, 5)
    expect(readProgramPosition(42)).toBe(5)
    expect(readProgramPosition(43)).toBe(7)
  })
})
