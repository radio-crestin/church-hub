import {
  getInworldStatus,
  startInworldSetup,
} from '../service/live-translation/voice-isolation/inworld/setupInworld'
import { isolateRecording } from '../service/live-translation/voice-isolation/isolateRecording'
import {
  VOICE_ISOLATIONS,
  type VoiceIsolation,
} from '../service/live-translation/voice-isolation/types'
import { pcmToWav } from '../service/live-translation/wav/pcmToWav'
import { wavToPcm } from '../service/live-translation/wav/wavToPcm'
import { log } from '../utils/fileLogger'
import { toErrorMessage } from '../utils/toErrorMessage'

const SAMPLE_RATE = 48000
const BASE = '/api/live-translation/voice-isolation'

/** Voice isolation of the preacher microphone: Inworld's setup and a check. */
export function handleVoiceIsolationRoutes(
  req: Request,
  url: URL,
): Response | Promise<Response> | null {
  if (req.method === 'GET' && url.pathname === `${BASE}/inworld`) {
    return Response.json(getInworldStatus())
  }
  if (req.method === 'POST' && url.pathname === `${BASE}/inworld/setup`) {
    startInworldSetup()
    return Response.json(getInworldStatus(), { status: 202 })
  }
  if (req.method === 'POST' && url.pathname === `${BASE}/isolate`) {
    return handleIsolate(req, url)
  }
  return null
}

async function handleIsolate(req: Request, url: URL): Promise<Response> {
  const isolation = url.searchParams.get('isolation') as VoiceIsolation
  if (!VOICE_ISOLATIONS.includes(isolation)) {
    return Response.json(
      { error: `isolation must be one of ${VOICE_ISOLATIONS.join(', ')}` },
      { status: 400 },
    )
  }
  let wav: ReturnType<typeof wavToPcm>
  try {
    wav = wavToPcm(Buffer.from(await req.arrayBuffer()))
  } catch (error) {
    return Response.json({ error: toErrorMessage(error) }, { status: 400 })
  }
  if (wav.sampleRate !== SAMPLE_RATE || wav.channels !== 1) {
    return Response.json(
      { error: 'The recording must be 48 kHz mono' },
      { status: 400 },
    )
  }
  try {
    const voice = await isolateRecording(isolation, wav.pcm)
    return new Response(new Uint8Array(pcmToWav(voice, SAMPLE_RATE)), {
      headers: { 'Content-Type': 'audio/wav' },
    })
  } catch (error) {
    log('voice-isolation', 'error', 'Isolating a recording failed', {
      error: String(error),
    })
    return Response.json({ error: toErrorMessage(error) }, { status: 409 })
  }
}
