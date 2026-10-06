import type { Database } from 'bun:sqlite'
import { calmTransitions } from '../../service/presentation/default-design/calmTransitions'

const MIGRATION_KEY = 'calm_factory_transitions_v1'
const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[upgrade-factory-transitions:${level}] ${message}`)
}

type Transition = { type?: string; duration?: number } | undefined
type TransitionKey = keyof ReturnType<typeof calmTransitions>

/**
 * Every transition earlier factory designs shipped, as "type/duration": the
 * old fades, the instant cuts (0 ms or none) and the livestream slide-in.
 * A missing slide transition is factory too.
 */
const OLD_FACTORY: Record<TransitionKey, string[]> = {
  animationIn: ['fade/300', 'fade/0', 'none/0', 'slide-up/200'],
  animationOut: ['fade/200', 'fade/250', 'fade/0', 'none/0', 'slide-down/150'],
  slideTransitionIn: ['missing', 'fade/250', 'fade/0', 'none/0', 'none/250'],
  slideTransitionOut: ['missing', 'fade/250', 'fade/0', 'none/0', 'none/250'],
}

function signature(transition: Transition): string {
  if (!transition) return 'missing'
  return `${transition.type}/${transition.duration}`
}

function hasFactoryTransitions(element: Record<string, unknown>): boolean {
  if (!element.animationIn) return false
  return (Object.keys(OLD_FACTORY) as TransitionKey[]).every((key) =>
    OLD_FACTORY[key].includes(signature(element[key] as Transition)),
  )
}

/** Gives every element still on factory transitions the calm ones; true if any changed. */
function upgradeConfig(config: Record<string, unknown>): boolean {
  let changed = false
  for (const element of Object.values(config)) {
    if (!element || typeof element !== 'object') continue
    const fields = element as Record<string, unknown>
    if (!hasFactoryTransitions(fields)) continue
    Object.assign(fields, calmTransitions())
    changed = true
  }
  return changed
}

/**
 * Moves the screens' text elements from the transitions earlier factory
 * designs shipped (quick blinks, hard cuts) to the calm factory fades
 * (default-design/calmTransitions.ts). Transitions someone changed in the
 * screen editor keep their values. Runs once.
 */
export function upgradeFactoryTransitions(db: Database): void {
  const applied = db
    .query<{ count: number }, [string]>(
      'SELECT COUNT(*) as count FROM app_settings WHERE key = ?',
    )
    .get(MIGRATION_KEY)?.count
  if (applied && applied > 0) {
    log('debug', 'Already applied, skipping')
    return
  }

  const rows = db
    .query<{ id: number; config: string }, []>(
      'SELECT id, config FROM screen_content_configs',
    )
    .all()

  let upgraded = 0
  db.run('BEGIN TRANSACTION')
  try {
    for (const row of rows) {
      const config = JSON.parse(row.config) as Record<string, unknown>
      if (!upgradeConfig(config)) continue
      db.run(
        'UPDATE screen_content_configs SET config = ?, updated_at = unixepoch() WHERE id = ?',
        [JSON.stringify(config), row.id],
      )
      upgraded++
    }
    db.run(
      'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
      [MIGRATION_KEY, JSON.stringify({ configsUpgraded: upgraded })],
    )
    db.run('COMMIT')
  } catch (error) {
    db.run('ROLLBACK')
    log('error', `Failed: ${error}`)
    throw error
  }
  log('info', `Calm transitions on ${upgraded} screen content config(s)`)
}
