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
  /**
   * Why the last attempt failed, so the client can say something more useful
   * than "check your connection": the network was unreachable, GitHub answered
   * with an error status, or the folder could not be written to.
   */
  errorCode: UpdateDownloadErrorCode | null
}

export type UpdateDownloadErrorCode =
  | 'network'
  | 'http'
  | 'filesystem'
  | 'unknown'

export interface UpdateConfig {
  /**
   * Folder new versions are downloaded into. Null means "not configured", in
   * which case the operating system's Downloads folder is used.
   */
  downloadDir: string | null
  /** The folder actually in use — the configured one, or the default. */
  effectiveDownloadDir: string
}

/**
 * What the installer window says, in the operator's language. The helper
 * runs outside the app — after it has quit — so the client hands the texts
 * over instead of the helper reaching for the app's translations.
 */
export interface UpdateInstallerLabels {
  /** Window heading, e.g. "Church Hub". */
  title: string
  /** "Closing the app…" */
  closing: string
  /** "Installing version {{version}}…" — already interpolated. */
  installing: string
  /** "Starting the new version…" */
  launching: string
  /** Small print under the bar: "The app reopens by itself when done." */
  hint: string
  /** "The update could not be installed: {{reason}}" — `{{reason}}` is filled by the helper. */
  failed: string
  /** What to do after a failure: "Open Church Hub yourself; the installer is in the downloads folder." */
  openManually: string
}

export interface OperationResult {
  success: boolean
  error?: string
}
