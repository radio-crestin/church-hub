export { AboutSection } from './components/AboutSection'
export { UpdateNotification } from './components/UpdateNotification'
export { UpdatePanel } from './components/UpdatePanel'
export { useAppUpdate } from './hooks/useAppUpdate'
export { useUpdateDownload } from './hooks/useUpdateDownload'
export type { GithubRelease, UpdateInfo } from './services/versionService'
export {
  checkForUpdates,
  getCurrentVersion,
} from './services/versionService'
