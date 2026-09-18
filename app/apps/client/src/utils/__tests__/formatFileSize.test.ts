import { describe, expect, it } from 'vitest'

import { formatFileSize } from '../formatFileSize'

const KIB = 1024
const MIB = KIB * 1024
const GIB = MIB * 1024

describe('formatFileSize', () => {
  it('shows small files in bytes', () => {
    expect(formatFileSize(0, 'en')).toBe('0 B')
    expect(formatFileSize(512, 'en')).toBe('512 B')
  })

  it('steps up by 1024 and keeps one decimal', () => {
    expect(formatFileSize(1536, 'en')).toBe('1.5 KB')
    expect(formatFileSize(3.5 * MIB, 'en')).toBe('3.5 MB')
    expect(formatFileSize(50 * MIB, 'en')).toBe('50 MB')
    expect(formatFileSize(1.25 * GIB, 'en')).toBe('1.3 GB')
  })

  it("uses the locale's decimal separator", () => {
    expect(formatFileSize(3.5 * MIB, 'ro')).toBe('3,5 MB')
  })

  it('does not go past gigabytes', () => {
    expect(formatFileSize(2048 * GIB, 'en')).toBe('2,048 GB')
  })
})
