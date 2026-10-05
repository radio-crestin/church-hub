import { getServerPort } from './serverPort'
import { afterEach, describe, expect, it } from 'bun:test'

const saved = { PORT: process.env.PORT, TAURI_MODE: process.env.TAURI_MODE }

function setEnv(port: string | undefined, tauriMode: string | undefined) {
  if (port === undefined) delete process.env.PORT
  else process.env.PORT = port
  if (tauriMode === undefined) delete process.env.TAURI_MODE
  else process.env.TAURI_MODE = tauriMode
}

describe('getServerPort', () => {
  afterEach(() => setEnv(saved.PORT, saved.TAURI_MODE))

  it('uses PORT when given', () => {
    setEnv('4196', 'true')
    expect(getServerPort()).toBe(4196)
  })

  it('defaults to 3000 for the installed app', () => {
    setEnv(undefined, 'true')
    expect(getServerPort()).toBe(3000)
  })

  it('defaults to 3001 for the dev server', () => {
    setEnv(undefined, undefined)
    expect(getServerPort()).toBe(3001)
  })
})
