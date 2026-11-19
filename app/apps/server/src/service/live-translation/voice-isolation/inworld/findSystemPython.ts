import { execFileSync } from 'node:child_process'

import { inworldLogger as logger } from './inworldLogger'

export interface PythonCommand {
  command: string
  args: string[]
}

/** Inworld Voice Isolator needs Python 3.10 or later. */
const MIN_VERSION = 310

/**
 * Where a Python may be. A desktop app started from the Dock or Finder gets
 * a bare PATH, and macOS's own /usr/bin/python3 is 3.9, so Homebrew's and
 * python.org's install folders are tried by path too.
 */
function candidates(): PythonCommand[] {
  const override = process.env.CHURCH_HUB_PYTHON
  const found: PythonCommand[] = override
    ? [{ command: override, args: [] }]
    : []
  if (process.platform === 'win32') {
    return [
      ...found,
      { command: 'py', args: ['-3'] },
      { command: 'python', args: [] },
      { command: 'python3', args: [] },
    ]
  }
  return [
    ...found,
    { command: 'python3', args: [] },
    { command: '/opt/homebrew/bin/python3', args: [] },
    { command: '/usr/local/bin/python3', args: [] },
    { command: 'python', args: [] },
  ]
}

function version(python: PythonCommand): number | null {
  try {
    const out = execFileSync(
      python.command,
      [
        ...python.args,
        '-c',
        'import sys; print(sys.version_info[0] * 100 + sys.version_info[1])',
      ],
      { stdio: 'pipe', timeout: 10000 },
    )
    return Number(out.toString().trim()) || null
  } catch {
    return null
  }
}

let cached: PythonCommand | null = null

/** The first Python 3.10+ on this machine, or null (looked up again then). */
export function findSystemPython(): PythonCommand | null {
  if (cached) return cached
  for (const python of candidates()) {
    const found = version(python)
    logger.debug('Python candidate', { ...python, version: found })
    if (found && found >= MIN_VERSION) {
      cached = python
      return python
    }
  }
  return null
}

/** The system Python as a command line, or null when there is none. */
export function systemPythonLabel(): string | null {
  const python = findSystemPython()
  return python ? [python.command, ...python.args].join(' ') : null
}
