export { AboutSection } from './components/AboutSection'
export { UpdateAvailableModal } from './components/UpdateAvailableModal'
export { UpdateNotification } from './components/UpdateNotification'
export { UpdateSettingsPanel } from './components/UpdateSettingsPanel'
export { VersionDisplay } from './components/VersionDisplay'
export { useAppUpdate } from './hooks/useAppUpdate'
export { useUpdateDownload } from './hooks/useUpdateDownload'
export type { GithubRelease, UpdateInfo } from './services/versionService'
export {
  checkForUpdates,
  getCurrentVersion,
  openDownloadUrl,
} from './services/versionService'
