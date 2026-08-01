/** Where a downloaded installer lives and how far along it is. */
export type UpdateDownloadPhase =
  | 'idle'
  | 'downloading'
  | 'ready'
  | 'installing'
  | 'error'

export interface UpdateDownloadState {
  phase: UpdateDownloadPhase
  /** Version being downloaded / already downloaded, without a leading "v". */
  version: string | null
  /** Absolute path of the artifact once it is on disk. */
  filePath: string | null
  fileName: string | null
  receivedBytes: number
  /** Null while the server has not been told a Content-Length. */
  totalBytes: number | null
  error: string | null
}

export interface UpdateConfig {
  /**
   * Folder new versions are downloaded into. Null means "not configured", in
   * which case the operating system's Downloads folder is used.
   */
  downloadDir: string | null
  /** The folder actually in use — the configured one, or the default. */
  effectiveDownloadDir: string
}

export interface OperationResult {
  success: boolean
  error?: string
}
