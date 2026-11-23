import type { APIRequestContext, Locator, Page } from '@playwright/test'

/** A 640x360 JPEG of one colour, encoded by the page's own canvas. */
export async function makeJpeg(page: Page, color: string): Promise<Buffer> {
  const base64 = await page.evaluate(async (fill) => {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 360
    const context = canvas.getContext('2d')
    if (!context) throw new Error('no 2d context')
    context.fillStyle = fill
    context.fillRect(0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    )
    if (!blob) throw new Error('JPEG encode failed')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
  }, color)
  return Buffer.from(base64, 'base64')
}

/** Starts a share as an operator does; returns its ingest token. */
export async function startShare(request: APIRequestContext): Promise<string> {
  const response = await request.post('/api/screen-share/start', { data: {} })
  if (!response.ok()) {
    throw new Error(`start failed: ${response.status()}`)
  }
  return (await response.json()).data.token as string
}

export async function stopShare(request: APIRequestContext) {
  await request.post('/api/screen-share/stop')
}

export function postFrame(
  request: APIRequestContext,
  token: string,
  jpeg: Buffer,
) {
  return request.post('/api/screen-share/frame', {
    headers: { 'Content-Type': 'image/jpeg', 'X-Screen-Share-Token': token },
    data: jpeg,
  })
}

/** Sends `jpeg` five times a second, as the desktop app's capture does. */
export function startFrameFeed(
  request: APIRequestContext,
  token: string,
  jpeg: Buffer,
) {
  let stopped = false
  const loop = async () => {
    while (!stopped) {
      await postFrame(request, token, jpeg).catch(() => undefined)
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }
  void loop()
  return {
    stop: () => {
      stopped = true
    },
  }
}

/** The shown stream's centre pixel, read back through a canvas. */
export function readCenterPixel(image: Locator) {
  return image.evaluate((element) => {
    const img = element as HTMLImageElement
    if (!img.complete || img.naturalWidth === 0) return null
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(img, 0, 0)
    const [r, g, b] = context.getImageData(
      Math.floor(canvas.width / 2),
      Math.floor(canvas.height / 2),
      1,
      1,
    ).data
    return {
      r,
      g,
      b,
      isRed: r > 180 && g < 80 && b < 80,
      isGreen: g > 150 && r < 80 && b < 80,
    }
  })
}
