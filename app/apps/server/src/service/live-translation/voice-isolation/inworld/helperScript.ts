import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import helperSource from './helper.py' with { type: 'text' }
import { getInworldDir } from './inworldPaths'

/**
 * The bridge script, embedded in the server (and its compiled binary) and
 * written to the Inworld folder when missing or changed, so Python can run it.
 */
export function writeHelperScript(): string {
  const path = join(getInworldDir(), 'helper.py')
  if (!existsSync(path) || readFileSync(path, 'utf8') !== helperSource) {
    mkdirSync(getInworldDir(), { recursive: true })
    writeFileSync(path, helperSource)
  }
  return path
}
