import type { AudioFormat } from '../types'

export const SUPPORTED_AUDIO_EXTENSIONS: AudioFormat[] = [
  'mp3',
  'wav',
  'ogg',
  'm4a',
  'flac',
]

export function isAudioFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase()
  return SUPPORTED_AUDIO_EXTENSIONS.includes(ext as AudioFormat)
}

export function getAudioFormat(filename: string): AudioFormat | null {
  const ext = filename.split('.').pop()?.toLowerCase()
  return SUPPORTED_AUDIO_EXTENSIONS.includes(ext as AudioFormat)
    ? (ext as AudioFormat)
    : null
}
