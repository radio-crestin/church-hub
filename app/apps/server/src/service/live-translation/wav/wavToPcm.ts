export interface WavPcm {
  sampleRate: number
  channels: number
  /** 16-bit little-endian samples, interleaved. */
  pcm: Buffer
}

/** Reads a 16-bit PCM WAV; throws on anything else. */
export function wavToPcm(wav: Buffer): WavPcm {
  if (
    wav.length < 12 ||
    wav.toString('ascii', 0, 4) !== 'RIFF' ||
    wav.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    throw new Error('Not a WAV file')
  }
  let format: { sampleRate: number; channels: number } | null = null
  for (let at = 12; at + 8 <= wav.length; ) {
    const id = wav.toString('ascii', at, at + 4)
    const size = wav.readUInt32LE(at + 4)
    const body = at + 8
    if (id === 'fmt ') {
      if (wav.readUInt16LE(body) !== 1 || wav.readUInt16LE(body + 14) !== 16) {
        throw new Error('Only 16-bit PCM WAV is supported')
      }
      format = {
        channels: wav.readUInt16LE(body + 2),
        sampleRate: wav.readUInt32LE(body + 4),
      }
    } else if (id === 'data') {
      if (!format) throw new Error('WAV data before its format')
      return { ...format, pcm: wav.subarray(body, body + size) }
    }
    at = body + size + (size % 2)
  }
  throw new Error('WAV has no data')
}
