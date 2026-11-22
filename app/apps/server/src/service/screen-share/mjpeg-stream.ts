import { createLogger } from '../../utils/logger'

const logger = createLogger('screen-share')

export const MJPEG_BOUNDARY = 'frame'
const encoder = new TextEncoder()

const viewers = new Set<ReadableStreamDefaultController<Uint8Array>>()
let latestFrame: Uint8Array | null = null

function framePart(jpeg: Uint8Array): Uint8Array[] {
  return [
    encoder.encode(
      `--${MJPEG_BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpeg.byteLength}\r\n\r\n`,
    ),
    jpeg,
    encoder.encode('\r\n'),
  ]
}

function send(
  viewer: ReadableStreamDefaultController<Uint8Array>,
  jpeg: Uint8Array,
) {
  // A viewer still reading the previous frame skips this one: only the
  // newest frame matters on a projector, never a backlog.
  if ((viewer.desiredSize ?? 1) <= 0) return
  try {
    for (const chunk of framePart(jpeg)) viewer.enqueue(chunk)
  } catch (error) {
    logger.debug(`Dropping a closed viewer: ${error}`)
    viewers.delete(viewer)
  }
}

/** Sends a frame to every open stream, and keeps it for streams opened later. */
export function publishFrame(jpeg: Uint8Array) {
  latestFrame = jpeg
  for (const viewer of viewers) send(viewer, jpeg)
}

/** The share as multipart/x-mixed-replace MJPEG, starting with the latest frame. */
export function openMjpegStream(): Response {
  let controller: ReadableStreamDefaultController<Uint8Array>
  const stream = new ReadableStream<Uint8Array>(
    {
      start(c) {
        controller = c
        viewers.add(c)
        logger.debug(`Viewer joined (${viewers.size} watching)`)
        if (latestFrame) send(c, latestFrame)
      },
      cancel() {
        viewers.delete(controller)
        logger.debug(`Viewer left (${viewers.size} watching)`)
      },
    },
    // One frame's three chunks may queue; more means the viewer is behind.
    { highWaterMark: 3 },
  )
  return new Response(stream, {
    headers: {
      'Content-Type': `multipart/x-mixed-replace; boundary=${MJPEG_BOUNDARY}`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

/** Ends every open stream and forgets the last frame (the share stopped). */
export function closeMjpegStreams() {
  latestFrame = null
  for (const viewer of viewers) {
    try {
      viewer.close()
    } catch {
      // Already closed by the viewer.
    }
  }
  viewers.clear()
}
