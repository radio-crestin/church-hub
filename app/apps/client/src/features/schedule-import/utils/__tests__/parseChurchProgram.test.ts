import { describe, expect, it } from 'vitest'

import { parseChurchProgram } from '../parseChurchProgram'

describe('schedule-import/utils/parseChurchProgram', () => {
  const validProgram = {
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
        song: {
          title: 'Amazing Grace',
          slides: [{ content: '<p>Verse 1</p>', label: 'V1', sortOrder: 0 }],
        },
      },
      {
        itemType: 'slide',
        sortOrder: 1,
        slideType: 'announcement',
        slideContent: '<p>Welcome</p>',
      },
    ],
  }

  it('parses a valid church program', () => {
    const result = parseChurchProgram(JSON.stringify(validProgram))
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data!.schedule.title).toBe('Sunday Service')
    expect(result.data!.items).toHaveLength(2)
  })

  it('returns error for invalid JSON', () => {
    const result = parseChurchProgram('not json')
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('returns error for wrong type field', () => {
    const result = parseChurchProgram(
      JSON.stringify({ ...validProgram, type: 'wrong' }),
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid')
  })

  it('returns error for missing version', () => {
    const { version, ...noVersion } = validProgram
    const result = parseChurchProgram(JSON.stringify(noVersion))
    expect(result.success).toBe(false)
  })

  it('returns error for missing schedule', () => {
    const { schedule, ...noSchedule } = validProgram
    const result = parseChurchProgram(JSON.stringify(noSchedule))
    expect(result.success).toBe(false)
  })

  it('returns error for missing schedule title', () => {
    const result = parseChurchProgram(
      JSON.stringify({
        ...validProgram,
        schedule: { description: null },
      }),
    )
    expect(result.success).toBe(false)
  })

  it('returns error for non-array items', () => {
    const result = parseChurchProgram(
      JSON.stringify({
        ...validProgram,
        items: 'not an array',
      }),
    )
    expect(result.success).toBe(false)
  })

  it('returns error for items with invalid itemType', () => {
    const result = parseChurchProgram(
      JSON.stringify({
        ...validProgram,
        items: [{ itemType: 'invalid', sortOrder: 0 }],
      }),
    )
    expect(result.success).toBe(false)
  })

  it('returns error for items missing sortOrder', () => {
    const result = parseChurchProgram(
      JSON.stringify({
        ...validProgram,
        items: [{ itemType: 'song', song: { title: 'T', slides: [] } }],
      }),
    )
    expect(result.success).toBe(false)
  })

  it('returns error for null input', () => {
    const result = parseChurchProgram(JSON.stringify(null))
    expect(result.success).toBe(false)
  })

  it('handles song items without a song object', () => {
    const result = parseChurchProgram(
      JSON.stringify({
        ...validProgram,
        items: [{ itemType: 'song', sortOrder: 0 }],
      }),
    )
    // This should fail because song items need a song object
    expect(result.success).toBe(false)
  })
})
