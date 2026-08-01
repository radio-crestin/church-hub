export {
  cancelDownload,
  findDownloadedArtifact,
  getDownloadState,
  markInstalling,
  startDownload,
} from './downloadUpdate'
export { installUpdate } from './installUpdate'
export type {
  OperationResult,
  UpdateConfig,
  UpdateDownloadPhase,
  UpdateDownloadState,
} from './types'
export {
  getDefaultDownloadDir,
  getUpdateConfig,
  resolveDownloadDir,
  setDownloadDir,
  UPDATE_DOWNLOAD_DIR_KEY,
} from './updateConfig'
