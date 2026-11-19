import { createIsolationFilter } from './createIsolationFilter'
import type { VoiceIsolation } from './types'

/**
 * Runs a recording (48 kHz mono s16le) through the same filter as the live
 * microphone, waiting for the isolator instead of letting raw audio through.
 */
export async function isolateRecording(
  isolation: VoiceIsolation,
  pcm: Buffer,
): Promise<Buffer> {
  const out: Buffer[] = []
  const filter = createIsolationFilter(isolation, (chunk) => out.push(chunk), {
    maxLagMs: Number.POSITIVE_INFINITY,
  })
  await filter.ready
  filter.push(pcm)
  await filter.end()
  return Buffer.concat(out)
}
