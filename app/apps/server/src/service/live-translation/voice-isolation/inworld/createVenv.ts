import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { findSystemPython } from './findSystemPython'
import {
  getInworldDir,
  getVenvDir,
  getVenvMarkerPath,
  getVenvPython,
} from './inworldPaths'
import { runProcess } from './runProcess'

const GET_PIP_URL = 'https://bootstrap.pypa.io/get-pip.py'

/**
 * Makes the helper's venv from the system Python. Without pip, then pip from
 * get-pip.py: Debian and Ubuntu leave `ensurepip` out of their Python, so a
 * plain `-m venv` fails there unless python3-venv is installed.
 */
export async function createVenv(): Promise<void> {
  const python = findSystemPython()
  if (!python) throw new Error('Python 3.10 or later was not found')
  rmSync(getVenvDir(), { recursive: true, force: true })
  await runProcess(python.command, [
    ...python.args,
    '-m',
    'venv',
    '--without-pip',
    getVenvDir(),
  ])
  const response = await fetch(GET_PIP_URL)
  if (!response.ok) throw new Error(`get-pip.py: HTTP ${response.status}`)
  const getPip = join(getInworldDir(), 'get-pip.py')
  writeFileSync(getPip, Buffer.from(await response.arrayBuffer()))
  await runProcess(getVenvPython(), [getPip, '--disable-pip-version-check'])
  rmSync(getPip)
  writeFileSync(getVenvMarkerPath(), 'pip')
}

export function isVenvReady(): boolean {
  return existsSync(getVenvPython()) && existsSync(getVenvMarkerPath())
}
