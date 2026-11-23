/**
 * A stand-in for the desktop app's audio server (Tauri's rodio player on
 * 127.0.0.1:3199), for the suite's server to "play" music in a browser-only
 * run: it answers the same HTTP calls and keeps a clock, without any sound.
 * A spec starts it with startFakeAudioServer (fake-audio.ts) on the port the
 * test server looks at; the server takes it on at its first music command.
 *
 * Usage: bun e2e/helpers/fake-audio-server.ts <port>
 */

const TRACK_SECONDS = 180

const port = Number(process.argv[2])
if (!port) throw new Error('usage: bun fake-audio-server.ts <port>')

let currentFile: string | null = null
let isPlaying = false
let isMuted = false
let volume = 50
let offset = 0
let startedAt = 0

const currentTime = () =>
  Math.min(
    TRACK_SECONDS,
    offset + (isPlaying ? (Date.now() - startedAt) / 1000 : 0),
  )

function seekTo(time: number, playing: boolean) {
  offset = time
  startedAt = Date.now()
  isPlaying = playing
}

const actions: Record<string, (body: Record<string, unknown>) => void> = {
  '/play': (body) => {
    currentFile = String(body.path)
    seekTo(0, true)
  },
  '/pause': () => seekTo(currentTime(), false),
  '/resume': () => seekTo(currentTime(), currentFile !== null),
  '/stop': () => {
    currentFile = null
    seekTo(0, false)
  },
  '/seek': (body) => seekTo(Number(body.time), isPlaying),
  '/volume': (body) => {
    volume = Number(body.level)
  },
  '/mute': (body) => {
    isMuted = Boolean(body.muted)
  },
}

Bun.serve({
  port,
  hostname: '127.0.0.1',
  async fetch(req) {
    const { pathname } = new URL(req.url)
    if (pathname === '/health') return Response.json({ ok: true })
    if (pathname === '/state') {
      return Response.json({
        is_playing: isPlaying && currentTime() < TRACK_SECONDS,
        current_time: currentTime(),
        duration: currentFile ? TRACK_SECONDS : 0,
        volume,
        is_muted: isMuted,
        current_file: currentFile,
      })
    }
    const action = actions[pathname]
    if (req.method !== 'POST' || !action) {
      return new Response('not found', { status: 404 })
    }
    action(
      req.headers.get('content-length') === '0'
        ? {}
        : await req.json().catch(() => ({})),
    )
    return Response.json({ ok: true })
  },
})

// biome-ignore lint/suspicious/noConsole: startFakeAudioServer waits for this line
console.log(`[fake-audio] listening on 127.0.0.1:${port}`)
