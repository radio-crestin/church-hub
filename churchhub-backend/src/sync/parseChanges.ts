import { SyncError } from './SyncError'
import { type ChangeInput, ENTITY_TYPES, type EntityType } from './types'

/** Changes accepted in one request (a church's first sync sends chunks). */
export const MAX_CHANGES_PER_REQUEST = 1000

const UUID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

function invalid(message: string): never {
  throw new SyncError(400, 'invalid_request', message)
}

function parseChange(raw: unknown, where: string): ChangeInput {
  const change = (raw ?? {}) as Record<string, unknown>
  if (!ENTITY_TYPES.includes(change.type as EntityType)) {
    invalid(`${where}.type must be one of ${ENTITY_TYPES.join(', ')}`)
  }
  if (typeof change.uuid !== 'string' || !UUID_PATTERN.test(change.uuid)) {
    invalid(`${where}.uuid is invalid`)
  }
  const baseVersion = change.baseVersion
  if (!Number.isInteger(baseVersion) || (baseVersion as number) < 0) {
    invalid(`${where}.baseVersion must be a non-negative integer`)
  }
  const common = {
    type: change.type as EntityType,
    uuid: change.uuid,
    baseVersion: baseVersion as number,
  }

  if (change.op === 'upsert') {
    const data = change.data as Record<string, unknown> | undefined
    if (!data || typeof data !== 'object' || data.uuid !== change.uuid) {
      invalid(`${where}.data must be the aggregate, with its uuid`)
    }
    return { ...common, op: 'upsert', data }
  }
  if (change.op === 'delete') {
    if (!Number.isInteger(change.deletedAt)) {
      invalid(`${where}.deletedAt must be unix seconds`)
    }
    return { ...common, op: 'delete', deletedAt: change.deletedAt as number }
  }
  return invalid(`${where}.op must be upsert or delete`)
}

/** Validates `POST changes`' body: `{ changes: ChangeInput[], actingUserId? }`. */
export function parseChanges(body: unknown): {
  changes: ChangeInput[]
  actingUserId: string | null
} {
  if (!body || typeof body !== 'object') invalid('Body must be a JSON object')
  const { changes, actingUserId } = body as Record<string, unknown>
  if (!Array.isArray(changes) || changes.length === 0) {
    invalid('changes must be a non-empty array')
  }
  if (changes.length > MAX_CHANGES_PER_REQUEST) {
    invalid(`At most ${MAX_CHANGES_PER_REQUEST} changes per request`)
  }
  if (actingUserId != null && typeof actingUserId !== 'string') {
    invalid('actingUserId must be a string')
  }

  const seen = new Set<string>()
  const parsed = changes.map((raw, index) => {
    const change = parseChange(raw, `changes[${index}]`)
    const key = `${change.type}:${change.uuid}`
    if (seen.has(key)) invalid(`changes[${index}] repeats ${key}`)
    seen.add(key)
    return change
  })
  return { changes: parsed, actingUserId: (actingUserId as string) ?? null }
}
