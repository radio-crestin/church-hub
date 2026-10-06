import { canonicalShortcut } from './canonicalShortcut'
import type {
  GlobalShortcutsConfig,
  ShortcutKind,
  ShortcutScope,
} from '../types'

/**
 * Where a key works when the user has not chosen. Page and sidebar keys move
 * around inside Church Hub, so they stay with it; presentation, livestream and
 * OBS scene keys run the service from any program.
 */
const DEFAULT_SCOPE: Record<ShortcutKind, ShortcutScope> = {
  sidebar: 'app',
  page: 'app',
  action: 'system',
  scene: 'system',
}

/** The stored spellings of `shortcut` ("Down" and "ArrowDown" are one key). */
function storedSpellings(
  config: GlobalShortcutsConfig,
  shortcut: string,
): string[] {
  const key = canonicalShortcut(shortcut)
  return Object.keys(config.keyScopes ?? {}).filter(
    (stored) => canonicalShortcut(stored) === key,
  )
}

/** Where `shortcut` works: the user's choice for that key, else its kind's default. */
export function shortcutScope(
  config: GlobalShortcutsConfig,
  shortcut: string,
  kind: ShortcutKind,
): ShortcutScope {
  const [stored] = storedSpellings(config, shortcut)
  return (stored && config.keyScopes?.[stored]) || DEFAULT_SCOPE[kind]
}

/** The config with `shortcut` set to work in `scope`. */
export function withShortcutScope(
  config: GlobalShortcutsConfig,
  shortcut: string,
  scope: ShortcutScope,
): GlobalShortcutsConfig {
  const keyScopes = { ...config.keyScopes }
  for (const stored of storedSpellings(config, shortcut))
    delete keyScopes[stored]
  keyScopes[shortcut] = scope
  return { ...config, keyScopes }
}
