import { describe, expect, it } from 'vitest'

import { formatDuration } from '../formatDuration'

describe('music/utils/formatDuration', () => {
  it('formats 0 seconds as 0:00', () => {
    expect(formatDuration(0)).toBe('0:00')
  })

  it('formats seconds less than a minute', () => {
    expect(formatDuration(5)).toBe('0:05')
    expect(formatDuration(30)).toBe('0:30')
    expect(formatDuration(59)).toBe('0:59')
  })

  it('formats whole minutes', () => {
    expect(formatDuration(60)).toBe('1:00')
    expect(formatDuration(120)).toBe('2:00')
    expect(formatDuration(600)).toBe('10:00')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(90)).toBe('1:30')
    expect(formatDuration(125)).toBe('2:05')
    expect(formatDuration(3661)).toBe('61:01')
  })

  it('floors fractional seconds', () => {
    expect(formatDuration(90.7)).toBe('1:30')
    expect(formatDuration(59.9)).toBe('0:59')
  })

  it('returns --:-- for null', () => {
    expect(formatDuration(null)).toBe('--:--')
  })

  it('returns --:-- for undefined', () => {
    expect(formatDuration(undefined)).toBe('--:--')
  })

  it('returns --:-- for NaN', () => {
    expect(formatDuration(NaN)).toBe('--:--')
  })

  it('pads seconds with leading zero', () => {
    expect(formatDuration(61)).toBe('1:01')
    expect(formatDuration(9)).toBe('0:09')
  })
})
