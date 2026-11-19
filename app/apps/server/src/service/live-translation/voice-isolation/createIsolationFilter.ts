import { inworldLogger as logger } from './inworld/inworldLogger'
import { isInworldReady } from './inworld/isInworldReady'
import {
  type InworldStream,
  startInworldStream,
} from './inworld/startInworldStream'
import type { VoiceIsolation, VoiceIsolationStatus } from './types'

/** 48 kHz mono s16le: 96 bytes per millisecond. */
const BYTES_PER_MS = 96
/** Cleaned audio leaves in 40 ms frames, as the microphone delivers it. */
const FRAME_BYTES = 40 * BYTES_PER_MS

export interface IsolationFilterOptions {
  /** How far the isolated voice may fall behind the microphone before the
   *  filter gives up and lets the raw audio through. */
  maxLagMs: number
  onStatus?: (status: VoiceIsolationStatus) => void
}

export interface IsolationFilter {
  /** Resolves once the isolator runs (at once when off); rejects if it can't. */
  ready: Promise<void>
  /** 48 kHz mono s16le from the microphone. */
  push: (pcm: Buffer) => void
  /** No more input: resolves once every cleaned sample has been handed on. */
  end: () => Promise<void>
  stop: () => void
}

/**
 * The microphone's path to translation: 48 kHz mono s16le in, `onAudio` out.
 * Off, it hands the audio on as is. With Inworld, the raw audio goes through
 * while the helper loads, then the isolated voice does; if the helper fails
 * or falls more than `maxLagMs` behind, the raw audio goes through for the
 * rest of the session, so the translation never stalls.
 */
export function createIsolationFilter(
  isolation: VoiceIsolation,
  onAudio: (pcm: Buffer) => void,
  options: IsolationFilterOptions,
): IsolationFilter {
  if (isolation === 'off') {
    options.onStatus?.('off')
    return {
      ready: Promise.resolve(),
      push: onAudio,
      end: () => Promise.resolve(),
      stop: () => {},
    }
  }

  let status: VoiceIsolationStatus = 'starting'
  let sent = 0
  let received = 0
  let pending = Buffer.alloc(0)
  let stream: InworldStream | null = null
  let stopped = false
  let ended: () => void = () => {}
  const done = new Promise<void>((resolve) => {
    ended = resolve
  })

  const setStatus = (next: VoiceIsolationStatus) => {
    if (status === next) return
    status = next
    logger.info('Voice isolation status', { status })
    options.onStatus?.(status)
  }

  const bypass = (reason: string) => {
    if (status === 'bypassed') return
    logger.warn('Voice isolation bypassed: raw microphone audio goes on', {
      reason,
    })
    setStatus('bypassed')
    stream?.kill()
  }

  const ready = new Promise<void>((resolve, reject) => {
    if (!isInworldReady()) {
      bypass('Inworld Voice Isolator is not set up')
      reject(new Error('Inworld Voice Isolator is not set up'))
      ended()
      return
    }
    options.onStatus?.(status)
    stream = startInworldStream({
      onReady: (device) => {
        logger.info('Inworld stream ready', { device })
        setStatus('active')
        resolve()
      },
      onVoice: (pcm) => {
        received += pcm.length
        if (status !== 'active') return
        pending = Buffer.concat([pending, pcm])
        const whole = pending.length - (pending.length % FRAME_BYTES)
        for (let at = 0; at < whole; at += FRAME_BYTES) {
          onAudio(pending.subarray(at, at + FRAME_BYTES))
        }
        pending = pending.subarray(whole)
      },
      onExit: (code) => {
        if (status === 'active' && pending.length >= 2) {
          onAudio(pending.subarray(0, pending.length - (pending.length % 2)))
        }
        pending = Buffer.alloc(0)
        if (!stopped && (status !== 'active' || code !== 0))
          bypass(`helper exited (${code})`)
        reject(new Error(`Inworld Voice Isolator exited (${code})`))
        ended()
      },
    })
  })
  // A live session doesn't wait for it; the status says what happened.
  ready.catch(() => {})

  return {
    ready,
    push: (pcm) => {
      if (status !== 'active' || !stream) {
        onAudio(pcm)
        return
      }
      stream.write(pcm)
      sent += pcm.length
      if ((sent - received) / BYTES_PER_MS > options.maxLagMs) {
        bypass(`fell ${Math.round((sent - received) / BYTES_PER_MS)} ms behind`)
      }
    },
    end: () => {
      stream?.end()
      return done
    },
    stop: () => {
      stopped = true
      stream?.kill()
    },
  }
}
