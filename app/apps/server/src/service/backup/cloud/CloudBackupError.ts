/**
 * A cloud backup failure the app can explain: the service's code
 * (quota_exceeded, daily_limit, …) or this PC's own (cloud_sign_in_required,
 * backup_unreadable, busy), and the HTTP status the local route answers.
 */
export class CloudBackupError extends Error {
  constructor(
    readonly code: string,
    readonly status = 502,
    /** Numbers the app can show, e.g. a quota refusal's used and needed bytes. */
    readonly details: Record<string, number> = {},
  ) {
    super(code)
    this.name = 'CloudBackupError'
  }
}

export const signInRequired = () =>
  new CloudBackupError('cloud_sign_in_required', 401)
