import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { getDatabasePath } from '../../utils/paths'

/**
 * Whether anonymous usage data may be sent, and the random id of this
 * install. Kept in a small file next to the database rather than in it:
 * PostHog is used from the very first line of the server (boot heartbeat,
 * boot failures), before the database is open.
 */
export interface AnalyticsConfig {
  enabled: boolean
  installId: string
}

let cached: AnalyticsConfig | null = null

function configPath(): string {
  return join(dirname(getDatabasePath()), 'analytics.json')
}

function save(config: AnalyticsConfig): void {
  const path = configPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(config, null, 2))
}

function load(): AnalyticsConfig {
  const path = configPath()
  if (existsSync(path)) {
    const saved = JSON.parse(
      readFileSync(path, 'utf8'),
    ) as Partial<AnalyticsConfig>
    if (typeof saved.installId === 'string' && saved.installId) {
      return { enabled: saved.enabled !== false, installId: saved.installId }
    }
  }
  // On by default, as the user asked; the id is random, tied to nothing.
  const fresh = { enabled: true, installId: randomUUID() }
  save(fresh)
  return fresh
}

export function getAnalyticsConfig(): AnalyticsConfig {
  cached ??= load()
  return cached
}

export function upsertAnalyticsEnabled(enabled: boolean): AnalyticsConfig {
  cached = { ...getAnalyticsConfig(), enabled }
  save(cached)
  return cached
}
