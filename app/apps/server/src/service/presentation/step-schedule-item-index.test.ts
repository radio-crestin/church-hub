import { stepScheduleItemIndex } from './step-schedule-item-index'
import { describe, expect, it } from 'bun:test'

describe('stepScheduleItemIndex', () => {
  it('moves a program step along with the slide', () => {
    expect(stepScheduleItemIndex(4, 0, 1)).toBe(5)
    expect(stepScheduleItemIndex(6, 2, 1)).toBe(5)
  })

  it('leaves content that is not a program step without a position', () => {
    expect(stepScheduleItemIndex(undefined, 0, 1)).toBeUndefined()
    expect(stepScheduleItemIndex(-1, 0, 1)).toBe(-1)
  })
})
