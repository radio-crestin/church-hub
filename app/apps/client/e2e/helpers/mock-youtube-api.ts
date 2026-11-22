import { readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

/**
 * A local stand-in for the YouTube Data API (the server's
 * `YOUTUBE_API_ORIGIN`): a channel with two past broadcasts, two stream keys
 * and two playlists. It records every request, so a spec can check what the
 * server sent when it created a broadcast.
 */
export interface YouTubeRequest {
  method: string
  path: string
  query: URLSearchParams
  contentType?: string
  body: string
}

export interface MockYouTubeApi {
  origin: string
  requests: YouTubeRequest[]
  /** The JSON bodies sent with `method` to `path` (e.g. POST /youtube/v3/liveBroadcasts). */
  bodiesOf: (method: string, path: string) => Record<string, unknown>[]
  close: () => Promise<void>
}

/** A real photo, so the settings page shows the thumbnail. */
const THUMBNAIL = readFileSync(
  new URL('../fixtures/background-still.jpg', import.meta.url),
)

export const CREATED_BROADCAST_ID = 'new-broadcast-1'

export const PAST_BROADCASTS = [
  {
    id: 'past-sunday',
    title: 'Serviciu divin 16.11.2025',
    description: 'Biserica Baptistă Adunare: serviciul de duminică.',
    privacyStatus: 'public',
    completedAt: '2025-11-16T12:00:00Z',
    categoryId: '29',
    tags: ['biserica', 'predica'],
    madeForKids: false,
    latencyPreference: 'low',
  },
  {
    id: 'past-wednesday',
    title: 'Rugăciune 12 noiembrie 2025',
    description: 'Seara de rugăciune.',
    privacyStatus: 'unlisted',
    completedAt: '2025-11-12T19:00:00Z',
    categoryId: '22',
    tags: ['rugaciune'],
    madeForKids: false,
    latencyPreference: 'normal',
  },
]

export const STREAM_KEYS = [
  { id: 'key-main', title: 'Cheia principală' },
  { id: 'key-backup', title: 'Cheia de rezervă' },
]

export const PLAYLISTS = [
  { id: 'pl-sundays', title: 'Duminici' },
  { id: 'pl-prayer', title: 'Rugăciune' },
]

function json(res: import('node:http').ServerResponse, body: unknown) {
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

export async function startMockYouTubeApi(): Promise<MockYouTubeApi> {
  const requests: YouTubeRequest[] = []
  let origin = ''

  const thumbnails = (id: string) => ({
    high: { url: `${origin}/thumbs/${id}-high.jpg` },
    maxres: { url: `${origin}/thumbs/${id}-maxres.jpg` },
  })
  const broadcastItem = (b: (typeof PAST_BROADCASTS)[number]) => ({
    id: b.id,
    snippet: {
      title: b.title,
      description: b.description,
      actualStartTime: b.completedAt,
      actualEndTime: b.completedAt,
      thumbnails: thumbnails(b.id),
    },
    status: {
      lifeCycleStatus: 'complete',
      privacyStatus: b.privacyStatus,
      selfDeclaredMadeForKids: b.madeForKids,
    },
    contentDetails: {
      boundStreamId: STREAM_KEYS[0].id,
      latencyPreference: b.latencyPreference,
      enableDvr: true,
      enableEmbed: true,
      recordFromStart: true,
    },
  })

  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://mock')
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      const body = Buffer.concat(chunks)
      const method = req.method ?? 'GET'
      const path = url.pathname
      requests.push({
        method,
        path,
        query: url.searchParams,
        contentType: req.headers['content-type'],
        body: body.toString('utf8'),
      })
      const id = url.searchParams.get('id')
      const status = url.searchParams.get('broadcastStatus')

      if (path.startsWith('/thumbs/')) {
        res.writeHead(200, { 'content-type': 'image/jpeg' })
        res.end(THUMBNAIL)
        return
      }
      if (path === '/youtube/v3/liveBroadcasts' && method === 'GET') {
        if (id) {
          const found = PAST_BROADCASTS.filter((b) => b.id === id)
          return json(res, { items: found.map(broadcastItem) })
        }
        if (status === 'completed') {
          return json(res, { items: PAST_BROADCASTS.map(broadcastItem) })
        }
        return json(res, { items: [] })
      }
      if (path === '/youtube/v3/liveBroadcasts' && method === 'POST') {
        return json(res, {
          id: CREATED_BROADCAST_ID,
          ...JSON.parse(body.toString()),
        })
      }
      if (path === '/youtube/v3/videos' && method === 'GET') {
        const found = PAST_BROADCASTS.filter((b) => b.id === id)
        return json(res, {
          items: found.map((b) => ({
            id: b.id,
            snippet: {
              title: b.title,
              description: b.description,
              categoryId: b.categoryId,
              tags: b.tags,
              defaultLanguage: 'ro',
              thumbnails: thumbnails(b.id),
            },
            status: { madeForKids: b.madeForKids },
          })),
        })
      }
      if (path === '/youtube/v3/liveStreams') {
        return json(res, {
          items: STREAM_KEYS.map((k) => ({
            id: k.id,
            snippet: { title: k.title },
          })),
        })
      }
      if (path === '/youtube/v3/playlists') {
        return json(res, {
          items: PLAYLISTS.map((p) => ({
            id: p.id,
            snippet: { title: p.title, description: '' },
            contentDetails: { itemCount: 3 },
          })),
        })
      }
      if (path === '/youtube/v3/videoCategories') {
        return json(res, {
          items: [
            {
              id: '22',
              snippet: { title: 'People & Blogs', assignable: true },
            },
            {
              id: '29',
              snippet: { title: 'Nonprofits & Activism', assignable: true },
            },
          ],
        })
      }
      // Writes: liveBroadcasts/bind, videos (PUT), playlistItems, thumbnails/set.
      return json(res, { id: CREATED_BROADCAST_ID })
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  origin = `http://127.0.0.1:${port}`

  return {
    origin,
    requests,
    bodiesOf: (method, path) =>
      requests
        .filter((r) => r.method === method && r.path === path)
        .map((r) => JSON.parse(r.body) as Record<string, unknown>),
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}
