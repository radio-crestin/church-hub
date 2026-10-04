const MAX_SCREENSHOT_WIDTH = 1920

export function canCaptureDisplay(): boolean {
  return typeof navigator.mediaDevices?.getDisplayMedia === 'function'
}

/**
 * Lets the user pick any screen, window or tab through the system's own
 * picker and returns one frame of it. Null when they cancel the picker.
 */
export async function captureDisplay(): Promise<HTMLCanvasElement | null> {
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      return null
    }
    throw error
  }

  try {
    const video = document.createElement('video')
    video.muted = true
    video.srcObject = stream
    await video.play()
    const scale = Math.min(1, MAX_SCREENSHOT_WIDTH / video.videoWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D context is not available')
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    for (const track of stream.getTracks()) track.stop()
  }
}
