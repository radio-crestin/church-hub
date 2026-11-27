import { installBackendDependencies } from './helpers/backend-dependencies'

/**
 * Runs once, before any worker: installs churchhub-backend's packages here,
 * so two workers never run `npm ci` at once (one wiping node_modules under
 * the other, leaving a half-installed tree every later start fails on).
 */
export default function globalSetup() {
  installBackendDependencies()
}
