export type ExportMode = 'url' | 'staticFile'

export type ExportProgress =
  | 'idle'
  | 'generating'
  | 'saving'
  | 'success'
  | 'error'

export interface ExportResult {
  success: boolean
  cancelled?: boolean
  filePath?: string
  error?: string
}

export interface ScreenExportConfig {
  screenId: number
  serverUrl: string
  screenName: string
}
