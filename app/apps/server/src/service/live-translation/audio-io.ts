import { log } from '../../utils/fileLogger'

const logger = {
  debug: (msg: string, data?: unknown) => log('audio-io', 'debug', msg, data),
  info: (msg: string, data?: unknown) => log('audio-io', 'info', msg, data),
  warn: (msg: string, data?: unknown) => log('audio-io', 'warn', msg, data),
  error: (msg: string, data?: unknown) => log('audio-io', 'error', msg, data),
}

let RtAudio: typeof import('audify').RtAudio | null = null
let RtAudioFormat: typeof import('audify').RtAudioFormat | null = null

async function loadAudify() {
  if (RtAudio) return
  try {
    const audify = await import('audify')
    RtAudio = audify.RtAudio
    RtAudioFormat = audify.RtAudioFormat
  } catch (error) {
    logger.error('Failed to load audify (audio features unavailable)', {
      error: String(error),
    })
    throw new Error(
      'Audio library (audify) is not available on this system. Live translation audio features require native audio support.',
    )
  }
}

let inputAudio: InstanceType<typeof import('audify').RtAudio> | null = null
let outputAudio: InstanceType<typeof import('audify').RtAudio> | null = null

/** Hardware capture rate (most devices support 48kHz) */
const HARDWARE_RATE = 48000
/** Gemini expects 16kHz input */
const GEMINI_INPUT_RATE = 16000
/** Gemini outputs 24kHz */
const GEMINI_OUTPUT_RATE = 24000

type AudioChunkCallback = (pcmBuffer: Buffer) => void

/**
 * Downsample 16-bit PCM from srcRate to dstRate using linear interpolation.
 */
function resampleInt16(
  input: Buffer,
  srcRate: number,
  dstRate: number,
): Buffer {
  if (srcRate === dstRate) return input

  const srcSamples = input.length / 2
  const ratio = srcRate / dstRate
  const dstSamples = Math.floor(srcSamples / ratio)
  const output = Buffer.alloc(dstSamples * 2)

  for (let i = 0; i < dstSamples; i++) {
    const srcPos = i * ratio
    const srcIdx = Math.floor(srcPos)
    const frac = srcPos - srcIdx
    const s0 = input.readInt16LE(srcIdx * 2)
    const s1 =
      srcIdx + 1 < srcSamples ? input.readInt16LE((srcIdx + 1) * 2) : s0
    const sample = Math.round(s0 + frac * (s1 - s0))
    output.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), i * 2)
  }

  return output
}

/**
 * Start capturing audio from the microphone using RtAudio.
 * Captures at 48kHz and resamples to 16kHz before calling onChunk.
 */
export async function startAudioCapture(
  onChunk: AudioChunkCallback,
  inputDeviceId?: number,
): Promise<void> {
  await loadAudify()

  if (inputAudio) {
    logger.warn('Audio capture already active')
    return
  }

  inputAudio = new RtAudio!()

  const deviceId = inputDeviceId ?? inputAudio.getDefaultInputDevice()

  logger.info('Starting audio capture', {
    deviceId,
    hardwareRate: HARDWARE_RATE,
  })

  // 1920 samples at 48kHz = 40ms frames
  inputAudio.openStream(
    null,
    { deviceId, nChannels: 1, firstChannel: 0 },
    RtAudioFormat!.RTAUDIO_SINT16,
    HARDWARE_RATE,
    1920,
    'translation-input',
    (pcm) => {
      const resampled = resampleInt16(pcm, HARDWARE_RATE, GEMINI_INPUT_RATE)
      onChunk(resampled)
    },
    null,
    0,
    (type, msg) => {
      logger.error('RtAudio input error', { type, msg })
    },
  )

  inputAudio.start()
  logger.info('Audio capture started')
}

/**
 * Stop audio capture.
 */
export function stopAudioCapture(): void {
  if (!inputAudio) return

  logger.info('Stopping audio capture')
  try {
    if (inputAudio.isStreamRunning()) {
      inputAudio.stop()
    }
    if (inputAudio.isStreamOpen()) {
      inputAudio.closeStream()
    }
  } catch (error) {
    logger.error('Error stopping audio capture', { error: String(error) })
  }
  inputAudio = null
}

/**
 * Start the audio playback stream using RtAudio at 48kHz.
 * Accepts 24kHz PCM via playAudioChunk() which resamples to 48kHz.
 */
export async function startAudioPlayback(
  outputDeviceId?: number,
): Promise<void> {
  await loadAudify()

  if (outputAudio) {
    logger.warn('Audio playback already active')
    return
  }

  outputAudio = new RtAudio!()

  const deviceId = outputDeviceId ?? outputAudio.getDefaultOutputDevice()

  logger.info('Starting audio playback', {
    deviceId,
    hardwareRate: HARDWARE_RATE,
  })

  // 1920 samples at 48kHz = 40ms frames
  outputAudio.openStream(
    { deviceId, nChannels: 1, firstChannel: 0 },
    null,
    RtAudioFormat!.RTAUDIO_SINT16,
    HARDWARE_RATE,
    1920,
    'translation-output',
    null,
    null,
    0,
    (type, msg) => {
      logger.error('RtAudio output error', { type, msg })
    },
  )

  outputAudio.start()
  logger.info('Audio playback started')
}

/**
 * Write a PCM audio chunk to the playback stream.
 * Input is 24kHz 16-bit mono PCM, resampled to 48kHz for hardware.
 */
export function playAudioChunk(pcmBuffer: Buffer): void {
  if (!outputAudio) {
    logger.warn('No playback stream active')
    return
  }

  try {
    const resampled = resampleInt16(
      pcmBuffer,
      GEMINI_OUTPUT_RATE,
      HARDWARE_RATE,
    )
    outputAudio.write(resampled)
  } catch (error) {
    logger.error('Failed to write audio to playback', { error: String(error) })
  }
}

/**
 * Stop audio playback.
 */
export function stopAudioPlayback(): void {
  if (!outputAudio) return

  logger.info('Stopping audio playback')
  try {
    if (outputAudio.isStreamRunning()) {
      outputAudio.stop()
    }
    if (outputAudio.isStreamOpen()) {
      outputAudio.closeStream()
    }
  } catch (error) {
    logger.error('Error stopping audio playback', { error: String(error) })
  }
  outputAudio = null
}

/**
 * Get available audio devices.
 */
export async function getAudioDevices() {
  await loadAudify()

  const rtAudio = new RtAudio!()
  const devices = rtAudio.getDevices()
  const defaultInput = rtAudio.getDefaultInputDevice()
  const defaultOutput = rtAudio.getDefaultOutputDevice()

  return {
    devices: devices.map((d) => ({
      id: d.id,
      name: d.name,
      inputChannels: d.inputChannels,
      outputChannels: d.outputChannels,
      isDefaultInput: d.id === defaultInput,
      isDefaultOutput: d.id === defaultOutput,
      sampleRates: d.sampleRates,
    })),
    defaultInputId: defaultInput,
    defaultOutputId: defaultOutput,
  }
}
