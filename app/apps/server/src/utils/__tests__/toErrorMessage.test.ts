import { describe, expect, it } from 'bun:test'
import { toErrorMessage } from '../toErrorMessage'

describe('toErrorMessage', () => {
  it('returns the message of an Error, never its stack', () => {
    const error = new Error('UNIQUE constraint failed: users.name')
    expect(toErrorMessage(error)).toBe('UNIQUE constraint failed: users.name')
    expect(toErrorMessage(error)).not.toContain('at ')
  })

  it('hides values that are not Errors', () => {
    expect(toErrorMessage({ stack: 'at secret.ts:1' })).toBe('Unexpected error')
    expect(toErrorMessage(undefined)).toBe('Unexpected error')
  })
})
