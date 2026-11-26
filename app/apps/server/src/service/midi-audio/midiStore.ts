import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { getDataDir } from '../../utils/paths'

const HASH_PATTERN = /^[a-f0-9]{64}$/

function midiDir(): string {
  const dir = join(getDataDir(), 'midi')
  mkdirSync(dir, { recursive: true })
  return dir
}

/** Keeps an uploaded MIDI file under its content hash; returns the hash. */
export function saveMidiFile(bytes: Uint8Array): string {
  const hash = createHash('sha256').update(bytes).digest('hex')
  const path = midiFilePath(hash)
  if (!existsSync(path)) writeFileSync(path, bytes)
  return hash
}

export function isMidiHash(value: string): boolean {
  return HASH_PATTERN.test(value)
}

export function midiFilePath(hash: string): string {
  if (!isMidiHash(hash)) throw new Error(`Not a MIDI file hash: ${hash}`)
  return join(midiDir(), `${hash}.mid`)
}

/** Where the MIDI file's rendered audio is cached. */
export function midiAudioPath(hash: string): string {
  if (!isMidiHash(hash)) throw new Error(`Not a MIDI file hash: ${hash}`)
  return join(midiDir(), `${hash}.wav`)
}
