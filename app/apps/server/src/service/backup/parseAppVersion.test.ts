import { buildBackupFileName } from './constants'
import { parseAppVersion } from './parseAppVersion'
import { describe, expect, it } from 'bun:test'

describe('parseAppVersion', () => {
  it('reads the version from a backup file name', () => {
    expect(
      parseAppVersion('church-hub-backup-v0.1.85-2026-10-04T10-00-00-000Z.db'),
    ).toBe('0.1.85')
    expect(parseAppVersion(buildBackupFileName('1.2.3'))).toBe('1.2.3')
  })

  it('returns null for names without a version', () => {
    expect(parseAppVersion('my-backup.db')).toBeNull()
    expect(parseAppVersion('church-hub-backup-2026-10-04.db')).toBeNull()
  })

  it('stays fast on long hostile names', () => {
    const name = `-v0.${',.'.repeat(50_000)}`
    const start = performance.now()
    expect(parseAppVersion(name)).toBeNull()
    expect(performance.now() - start).toBeLessThan(100)
  })
})
