import type { S3Storage, S3StorageView } from './types'

/** The storage without its secret, for the client. */
export function toS3StorageView(storage: S3Storage): S3StorageView {
  const { secretAccessKey, ...rest } = storage
  return { ...rest, hasSecret: secretAccessKey.length > 0 }
}
