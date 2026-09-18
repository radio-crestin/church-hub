import type { BackgroundMediaErrorCode } from './types'

/** A refused or failed upload; `code` picks the message shown to the operator. */
export class BackgroundMediaUploadError extends Error {
  readonly code: BackgroundMediaErrorCode

  constructor(code: BackgroundMediaErrorCode, message: string) {
    super(message)
    this.name = 'BackgroundMediaUploadError'
    this.code = code
  }
}
