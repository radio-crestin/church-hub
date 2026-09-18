/** Widest still kept: thumbnails are far smaller, and a frame costs w×h×4 bytes. */
const STILL_MAX_WIDTH = 640

/**
 * Loads a video once, draws its first frame into a canvas and lets the player
 * go (the element's source is dropped, which ends its download and frees its
 * decoder).
 *
 * `canplay` rather than `loadeddata` or `seeked`: WebKit reports both of those
 * for a VP9 WebM before a frame can be drawn, and the canvas stays black.
 *
 * The canvas is tainted for a cross-origin video (the packaged desktop app):
 * it can still be drawn onto other canvases, just never read back.
 */
export function captureVideoStill(src: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const release = () => {
      video.removeAttribute('src')
      video.load()
    }

    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.addEventListener(
      'canplay',
      () => {
        const scale = Math.min(1, STILL_MAX_WIDTH / (video.videoWidth || 1))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(video.videoWidth * scale)
        canvas.height = Math.round(video.videoHeight * scale)
        canvas
          .getContext('2d')
          ?.drawImage(video, 0, 0, canvas.width, canvas.height)
        release()
        resolve(canvas)
      },
      { once: true },
    )
    video.addEventListener(
      'error',
      () => {
        const code = video.error?.code
        release()
        reject(new Error(`Could not load ${src} (media error ${code})`))
      },
      { once: true },
    )
    video.src = src
  })
}
