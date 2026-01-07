export { UpdateNotification } from './components/UpdateNotification'
export { VersionDisplay } from './components/VersionDisplay'
export { useAppUpdate } from './hooks/useAppUpdate'
export type { GithubRelease, UpdateInfo } from './services/versionService'
export {
  checkForUpdates,
  getCurrentVersion,
  openDownloadUrl,
} from './services/versionService'
