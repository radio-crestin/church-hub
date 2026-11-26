import { type BackendProcess, startBackendProcess } from './backend-process'
import { SYNC_SERVICE_PORT } from '../../playwright.config'

const READY_LINE = /\[server\] Church Hub backend listening/
/**
 * Ready once the server listens and /sync's startup probe has checked the
 * bucket's conditional writes (createSyncGuard): until then /sync answers
 * 503 not_configured. Both lines, in either order, in the output so far.
 */
const BOTH_READY = new RegExp(
  `${READY_LINE.source}[\s\S]*\[sync\] conditional writes verified|\[sync\] conditional writes verified[\s\S]*${READY_LINE.source}`,
)

/** The bucket the service writes to, on the spec's fake S3. */
export const SYNC_BUCKET = 'church-hub-sync'

/**
 * churchhub-backend, self-hosted on Bun the way a church would run it
 * (its Node entry), with the spec's S3 stand-in as its only storage: the
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
      'src/node/server.ts',
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
        // Every spec registers its churches from 127.0.0.1.
        SYNC_RATE_LIMIT_PER_MINUTE: '1000',
        ...env,
      },
      BOTH_READY,
    )
  }

  async dispose(): Promise<void> {
    const process = this.process
    this.process = undefined
    await process?.stop()
  }
}
