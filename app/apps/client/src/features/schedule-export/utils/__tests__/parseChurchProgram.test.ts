import { describe, expect, it } from 'vitest'

import { parseChurchProgram } from '../parseChurchProgram'

describe('schedule-export/utils/parseChurchProgram', () => {
  const validData = {
    type: 'churchprogram',
    version: 1,
    schedule: {
      title: 'Sunday Service',
      description: null,
    },
    items: [
      {
        itemType: 'song',
        sortOrder: 0,
        song: { title: 'Grace', slides: [] },
      },
      {
        itemType: 'slide',
        sortOrder: 1,
      },
      {
        itemType: 'bible_passage',
        sortOrder: 2,
      },
    ],
  }

  it('parses valid church program JSON', () => {
    const result = parseChurchProgram(JSON.stringify(validData))
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data!.schedule.title).toBe('Sunday Service')
    expect(result.data!.items).toHaveLength(3)
  })

  it('returns error for invalid JSON string', () => {
    const result = parseChurchProgram('{bad json}')
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('returns error when type is not churchprogram', () => {
    const result = parseChurchProgram(
      JSON.stringify({ ...validData, type: 'other' }),
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid')
  })

  it('returns error when version is not a number', () => {
    const result = parseChurchProgram(
      JSON.stringify({ ...validData, version: 'v1' }),
    )
    expect(result.success).toBe(false)
  })

  it('returns error when schedule is missing', () => {
    const { schedule, ...noSchedule } = validData
    const result = parseChurchProgram(JSON.stringify(noSchedule))
    expect(result.success).toBe(false)
  })

  it('returns error when schedule.title is not a string', () => {
    const result = parseChurchProgram(
      JSON.stringify({
        ...validData,
        schedule: { title: 123 },
      }),
    )
    expect(result.success).toBe(false)
  })

  it('returns error when items is not an array', () => {
    const result = parseChurchProgram(
      JSON.stringify({ ...validData, items: {} }),
    )
    expect(result.success).toBe(false)
  })

  it('returns error for item with invalid itemType', () => {
    const result = parseChurchProgram(
      JSON.stringify({
        ...validData,
        items: [{ itemType: 'video', sortOrder: 0 }],
      }),
    )
    expect(result.success).toBe(false)
  })

  it('returns error for item missing sortOrder', () => {
    const result = parseChurchProgram(
      JSON.stringify({
        ...validData,
        items: [{ itemType: 'song' }],
      }),
    )
    expect(result.success).toBe(false)
  })

  it('returns error for null data', () => {
    const result = parseChurchProgram('null')
    expect(result.success).toBe(false)
  })

  it('returns error for empty string', () => {
    const result = parseChurchProgram('')
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})
