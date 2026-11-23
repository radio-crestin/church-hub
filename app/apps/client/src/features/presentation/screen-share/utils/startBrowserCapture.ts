import { createLogger } from '~/utils/logger'
import { postScreenShareFrame } from '../service/screenShareApi'

const logger = createLogger('app:screen-share:browser')

const FRAME_INTERVAL_MS = 1000 / 10
const MAX_WIDTH = 1920
const MAX_HEIGHT = 1080
const JPEG_QUALITY = 0.8

/**
 * The browser's own share (no desktop app): getDisplayMedia, each frame drawn
 * on a canvas, JPEG-encoded and posted to the same ingest the desktop app
 * uses. `onEnd` runs when the user stops sharing from the browser or the
 * server stops taking frames. Returns the function that stops it.
 */
export async function startBrowserCapture(
  token: string,
  onEnd: () => void,
): Promise<() => void> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: 10 } },
    audio: false,
  })
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = stream
  await video.play()

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const stop = () => {
    if (stopped) return
    stopped = true
    clearTimeout(timer)
    for (const track of stream.getTracks()) track.stop()
    video.srcObject = null
  }
  const end = () => {
    stop()
    onEnd()
  }
  stream.getVideoTracks()[0]?.addEventListener('ended', end)

  const sendFrame = async () => {
    if (stopped || !context) return
    const scale = Math.min(
      1,
      MAX_WIDTH / video.videoWidth,
      MAX_HEIGHT / video.videoHeight,
    )
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const jpeg = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    )
    try {
      if (jpeg && !(await postScreenShareFrame(token, jpeg))) {
        logger.info('The server ended the share')
        end()
        return
      }
    } catch (error) {
      logger.warn('Frame not sent', error)
    }
    if (!stopped) timer = setTimeout(sendFrame, FRAME_INTERVAL_MS)
  }
  void sendFrame()
  return stop
}
