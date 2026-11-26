import { type BackendProcess, startBackendProcess } from './backend-process'
import { SYNC_SERVICE_PORT } from '../../playwright.config'

const READY_LINE = /\[sync\] Church Hub cloud sync listening/

/** The bucket the service writes to, on the spec's fake S3. */
export const SYNC_BUCKET = 'church-hub-sync'

/**
 * churchhub-backend's cloud sync service, self-hosted on Bun the way a
 * church would run it, with the spec's S3 stand-in as its only storage: the
 * public bucket, holding each church's encrypted state too (no database).
 */
export class SyncService {
  readonly url = `http://127.0.0.1:${SYNC_SERVICE_PORT}`
  private process: BackendProcess | undefined

  get log(): string {
    return this.process?.log() ?? ''
  }

  /** `s3Endpoint`: the fake S3's address; it is also the public read URL. */
  async start(s3Endpoint: string, env: Record<string, string> = {}) {
    this.process = await startBackendProcess(
      'src/selfhost/server.ts',
      {
        PORT: String(SYNC_SERVICE_PORT),
        HOST: '127.0.0.1',
        SYNC_SECRET: 'e2e-sync-secret',
        S3_ENDPOINT: s3Endpoint,
        S3_BUCKET: SYNC_BUCKET,
        S3_REGION: 'us-east-1',
        S3_ACCESS_KEY_ID: 'e2e-access-key',
        S3_SECRET_ACCESS_KEY: 'e2e-secret-key',
        S3_PUBLIC_URL: `${s3Endpoint}/${SYNC_BUCKET}`,
        ...env,
      },
      READY_LINE,
    )
  }

  async dispose(): Promise<void> {
    const process = this.process
    this.process = undefined
    await process?.stop()
  }
}
