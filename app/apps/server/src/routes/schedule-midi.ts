import { requirePermission } from '../middleware/permissions'
import type { RequestContext } from '../middleware/types'
import {
  midiFilePath,
  playMidiAudio,
  readMidiDuration,
  renderMidiAudio,
  saveMidiFile,
  stopMidiAudio,
} from '../service/midi-audio'
import {
  getScheduleItemById,
  setScheduleItemMidi,
  setScheduleItemMidiVerseTimes,
} from '../service/schedules'
import type { Permission } from '../service/users'
import { createLogger } from '../utils/logger'

type HandleCors = (req: Request, res: Response) => Response

const logger = createLogger('schedule-midi')

/** MIDI files are small; a hymn is a few KB. */
const MAX_MIDI_BYTES = 5 * 1024 * 1024
const MIDI_PATH = /^\/api\/schedules\/(\d+)\/items\/(\d+)\/midi(\/[a-z-]+)?$/

/**
 * A song item's MIDI file in a presentation (service/midi-audio):
 * - PUT    …/items/:itemId/midi?name=  raw .mid body → the item's midi
 * - DELETE …/items/:itemId/midi
 * - PUT    …/items/:itemId/midi/verse-times  { verseTimes: number[] | null }
 * - POST   …/items/:itemId/midi/play   { fromSeconds? } plays it (to sync)
 * - POST   …/items/:itemId/midi/stop
 * Reads of the item come with the presentation (GET /api/schedules/:id).
 */
export async function handleScheduleMidiRoutes(
  req: Request,
  url: URL,
  handleCors: HandleCors,
  context: RequestContext | null,
): Promise<Response | null> {
  const match = url.pathname.match(MIDI_PATH)
  if (!match) return null
  const scheduleId = Number(match[1])
  const itemId = Number(match[2])
  const action = match[3] ?? ''

  const respond = (status: number, payload: unknown): Response =>
    handleCors(
      req,
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  const checkPermission = (permission: Permission): Response | null => {
    if (!context) return respond(401, { error: 'Unauthorized' })
    const denied = requirePermission(permission)(context)
    return denied ? handleCors(req, denied) : null
  }

  const permError = checkPermission('programs.edit')
  if (permError) return permError

  const item = getScheduleItemById(itemId)
  if (!item || item.scheduleId !== scheduleId || item.itemType !== 'song') {
    return respond(404, { error: 'Song item not found' })
  }

  if (req.method === 'PUT' && action === '') {
    const bytes = new Uint8Array(await req.arrayBuffer())
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_MIDI_BYTES) {
      return respond(400, { error: 'A MIDI file of up to 5 MB is needed' })
    }
    const hash = saveMidiFile(bytes)
    let durationSeconds: number
    try {
      durationSeconds = readMidiDuration(midiFilePath(hash))
    } catch (error) {
      logger.warning(`Not a MIDI file: ${error}`)
      return respond(400, { error: 'Not a MIDI file' })
    }
    const fileName = url.searchParams.get('name') || 'song.mid'
    setScheduleItemMidi(scheduleId, itemId, { hash, fileName, durationSeconds })
    // Rendered now, so the run starts its music without waiting.
    renderMidiAudio(hash).catch((error) => {
      logger.error(`Rendering MIDI ${fileName} failed: ${error}`)
    })
    return respond(200, { data: getScheduleItemById(itemId)?.midi ?? null })
  }

  if (req.method === 'DELETE' && action === '') {
    if (item.midi) await stopMidiAudio(item.midi.hash)
    setScheduleItemMidi(scheduleId, itemId, null)
    return respond(200, { data: null })
  }

  if (!item.midi) return respond(404, { error: 'The item has no MIDI file' })

  if (req.method === 'PUT' && action === '/verse-times') {
    const body = (await req.json().catch(() => null)) as {
      verseTimes?: unknown
    } | null
    const times = body?.verseTimes
    const valid =
      times === null ||
      (Array.isArray(times) &&
        times.every(
          (time, index) =>
            typeof time === 'number' &&
            time >= 0 &&
            (index === 0 || time >= (times[index - 1] as number)),
        ))
    if (!valid) {
      return respond(400, {
        error: 'verseTimes must be rising seconds, or null',
      })
    }
    setScheduleItemMidiVerseTimes(scheduleId, itemId, times as number[] | null)
    return respond(200, { data: getScheduleItemById(itemId)?.midi ?? null })
  }

  if (req.method === 'POST' && action === '/play') {
    const body = (await req.json().catch(() => null)) as {
      fromSeconds?: unknown
    } | null
    const from = body?.fromSeconds ?? 0
    if (typeof from !== 'number' || from < 0) {
      return respond(400, { error: 'fromSeconds must be 0 or more' })
    }
    const audible = await playMidiAudio(
      item.midi.hash,
      item.song?.title ?? item.midi.fileName,
      Math.min(from, item.midi.durationSeconds),
    )
    return respond(200, { data: { audible } })
  }

  if (req.method === 'POST' && action === '/stop') {
    await stopMidiAudio(item.midi.hash)
    return respond(200, { data: { stopped: true } })
  }

  return respond(404, { error: 'Not found' })
}
