import { captureVideoStill } from './captureVideoStill'

/** One capture per video for the page's lifetime (ids are content-unique). */
const stills = new Map<string, Promise<HTMLCanvasElement>>()

/**
 * A still frame of a background video, shared by every thumbnail showing it.
 *
 * Every `<video>` is a whole media player — its own download, decoder and
 * buffers, which WebKit keeps in the GPU process all of the app's windows
 * share, the projection's included. A filmstrip that gave each slide its own
 * paused `<video>` ran one player per slide for a single frame: 31 players and
 * ~1.6 GB in WebKit's GPU process for a 30-slide song over a 38 MB video. This
 * loads the video once, whatever the number of thumbnails.
 *
 * A failed capture is forgotten, so a later thumbnail tries again.
 */
export function getVideoStill(src: string): Promise<HTMLCanvasElement> {
  const cached = stills.get(src)
  if (cached) return cached

  const still = captureVideoStill(src)
  stills.set(src, still)
  still.catch(() => stills.delete(src))
  return still
}
