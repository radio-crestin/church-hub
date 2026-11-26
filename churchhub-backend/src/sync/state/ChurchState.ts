import type { Bucket } from '../createBucket'
import type { ObjectRef } from '../types'

export interface DeviceRecord {
  id: string
  /** HMAC of the token (hashToken): the token itself is never kept. */
  tokenHash: string
  /** The user whose permissions apply to its writes (none: the server). */
  userId: string | null
  name: string
  isServer: boolean
  createdAt: number
  revokedAt: number | null
}

export interface RoleRecord {
  id: string
  name: string
  permissions: string[]
  version: number
  updatedAt: number
}

export interface UserRecord {
  id: string
  name: string
  roleId: string | null
  isSuperAdmin: boolean
  isActive: boolean
  permissions: string[]
  version: number
  updatedAt: number
}

/**
 * Everything the service knows about one church, kept in the bucket as one
 * encrypted object (`sync-state/<churchId>.bin`, see writeChurch): there is
 * no database. Every change is a compare-and-swap on that object's ETag.
 */
export interface ChurchState {
  schemaVersion: 1
  id: string
  /** The secret half of the public read prefix (churchPrefix). */
  pathSecret: string
  /** The last accepted write's seq: every row's version is one of these. */
  seq: number
  /** The latest snapshot, under the current prefix. */
  snapshot: ObjectRef | null
  /** The segments after the snapshot, oldest first (head.json lists them). */
  segments: ObjectRef[]
  devices: DeviceRecord[]
  roles: RoleRecord[]
  users: UserRecord[]
  /**
   * `type:uuid` → the seq that last changed the row: negative when that
   * change deleted it.
   */
  versions: Record<string, number>
  createdAt: number
  updatedAt: number
}

/** Where the service keeps state and publishes, and the key protecting both. */
export interface SyncStore {
  /** The public bucket readers fetch head.json, snapshots and segments from. */
  bucket: Bucket
  /** Where the encrypted church states live: the same bucket, or a private one. */
  states: Bucket
  /** SYNC_SECRET: hashes device tokens and (derived) encrypts the states. */
  secret: string
}
