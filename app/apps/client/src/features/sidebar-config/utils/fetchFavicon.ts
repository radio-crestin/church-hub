import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

import { getApiUrl } from '~/config'
import { createLogger } from '~/utils/logger'

const logger = createLogger('app:favicon')

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/**
 * Common favicon paths to try when fetching
 */
const FAVICON_PATHS = [
  '/favicon.ico',
  '/favicon.png',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
]

/**
 * Extracts the base URL from a given URL
 */
function getBaseUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return `${urlObj.protocol}//${urlObj.host}`
  } catch {
    return url
  }
}

/**
 * Converts an ArrayBuffer to a base64 data URL
 */
function arrayBufferToDataUrl(buffer: ArrayBuffer, mimeType: string): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return `data:${mimeType};base64,${btoa(binary)}`
}

/**
 * Resizes an image to a target size while maintaining aspect ratio
 * @param dataUrl - Source image as data URL
 * @param targetSize - Target size in pixels (square)
 * @returns Resized image as data URL
 */
async function resizeImage(
  dataUrl: string,
  targetSize: number = 64,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = targetSize
      canvas.height = targetSize
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }

      // Draw image centered and scaled to fit
      ctx.drawImage(img, 0, 0, targetSize, targetSize)

      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = dataUrl
  })
}

/**
 * Extracts the dominant color from an image and returns a darker version
 * @param dataUrl - Image as data URL
 * @returns Hex color string (e.g., #4f46e5)
 */
async function extractDominantColor(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const size = 32 // Sample at smaller size for performance
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve('#6366f1') // Default indigo
        return
      }

      ctx.drawImage(img, 0, 0, size, size)
      const imageData = ctx.getImageData(0, 0, size, size)
      const data = imageData.data

      // Count color frequencies (simplified - group similar colors)
      const colorCounts: Record<
        string,
        { r: number; g: number; b: number; count: number }
      > = {}

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const a = data[i + 3]

        // Skip transparent or near-white/near-black pixels
        if (a < 128) continue
        if (r > 240 && g > 240 && b > 240) continue
        if (r < 15 && g < 15 && b < 15) continue

        // Quantize to reduce color space
        const qr = Math.round(r / 32) * 32
        const qg = Math.round(g / 32) * 32
        const qb = Math.round(b / 32) * 32
        const key = `${qr},${qg},${qb}`

        if (!colorCounts[key]) {
          colorCounts[key] = { r: qr, g: qg, b: qb, count: 0 }
        }
        colorCounts[key].count++
      }

      // Find the most frequent color
      let maxCount = 0
      let dominantColor = { r: 99, g: 102, b: 241 } // Default indigo

      for (const color of Object.values(colorCounts)) {
        if (color.count > maxCount) {
          maxCount = color.count
          dominantColor = color
        }
      }

      // Darken the color for background use (multiply by 0.7)
      const darkenFactor = 0.7
      const darkR = Math.round(dominantColor.r * darkenFactor)
      const darkG = Math.round(dominantColor.g * darkenFactor)
      const darkB = Math.round(dominantColor.b * darkenFactor)

      // Convert to hex
      const hex = `#${darkR.toString(16).padStart(2, '0')}${darkG.toString(16).padStart(2, '0')}${darkB.toString(16).padStart(2, '0')}`
      resolve(hex)
    }
    img.onerror = () => resolve('#6366f1') // Default indigo on error
    img.src = dataUrl
  })
}

/**
 * Result of fetching a favicon
 */
export interface FaviconResult {
  /** Base64 data URL of the favicon */
  dataUrl: string
  /** Dominant color from the favicon (darkened hex) */
  dominantColor: string
}

/**
 * Fetches a URL using Tauri HTTP client or browser proxy
 */
async function fetchWithCorsHandling(url: string): Promise<Response> {
  if (isTauri) {
    // Tauri mode: direct fetch (no CORS issues)
    return tauriFetch(url, {
      method: 'GET',
      redirect: 'follow',
    })
  } else {
    // Browser mode: use server proxy to bypass CORS
    const proxyUrl = `${getApiUrl()}/api/proxy/download?url=${encodeURIComponent(url)}`
    return fetch(proxyUrl, {
      method: 'GET',
    })
  }
}

/**
 * Tries to fetch favicon from a specific URL
 */
async function tryFetchFaviconUrl(faviconUrl: string): Promise<string | null> {
  try {
    const response = await fetchWithCorsHandling(faviconUrl)

    if (!response.ok) {
      return null
    }

    const contentType = response.headers.get('content-type') || 'image/png'
    if (!contentType.startsWith('image/')) {
      return null
    }

    const buffer = await response.arrayBuffer()
    if (buffer.byteLength === 0) {
      return null
    }

    const dataUrl = arrayBufferToDataUrl(buffer, contentType)

    // Resize to 64x64 for consistency
    const resizedDataUrl = await resizeImage(dataUrl, 64)

    return resizedDataUrl
  } catch (error) {
    logger.debug(`Failed to fetch favicon from ${faviconUrl}:`, error)
    return null
  }
}

/**
 * Parses HTML to find favicon URL from link tags
 */
function extractFaviconFromHtml(html: string, baseUrl: string): string | null {
  // Match all link tags with rel containing "icon"
  const linkRegex =
    /<link[^>]*rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/gi
  const hrefFirstRegex =
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["'][^"']*icon[^"']*["'][^>]*>/gi

  const matches = [
    ...html.matchAll(linkRegex),
    ...html.matchAll(hrefFirstRegex),
  ]

  for (const match of matches) {
    const href = match[1]
    if (href) {
      // Handle relative URLs
      if (href.startsWith('//')) {
        return `https:${href}`
      }
      if (href.startsWith('/')) {
        return `${baseUrl}${href}`
      }
      if (href.startsWith('http')) {
        return href
      }
      return `${baseUrl}/${href}`
    }
  }

  return null
}

/**
 * Fetches favicon from a website URL
 * Tries multiple methods: HTML parsing, common paths, and Google favicon service
 *
 * @param url - The website URL to fetch favicon from
 * @returns FaviconResult with dataUrl and dominantColor, or null if not found
 */
export async function fetchFavicon(url: string): Promise<FaviconResult | null> {
  const baseUrl = getBaseUrl(url)
  logger.debug(`Fetching favicon for ${baseUrl}`)

  let faviconDataUrl: string | null = null

  // Method 1: Try to fetch and parse the HTML to find favicon link
  try {
    const response = await fetchWithCorsHandling(url)

    if (response.ok) {
      const html = await response.text()
      const faviconUrl = extractFaviconFromHtml(html, baseUrl)
      if (faviconUrl) {
        faviconDataUrl = await tryFetchFaviconUrl(faviconUrl)
        if (faviconDataUrl) {
          logger.debug(`Found favicon via HTML parsing: ${faviconUrl}`)
        }
      }
    }
  } catch (error) {
    logger.debug('Failed to fetch HTML for favicon extraction:', error)
  }

  // Method 2: Try common favicon paths
  if (!faviconDataUrl) {
    for (const path of FAVICON_PATHS) {
      const faviconUrl = `${baseUrl}${path}`
      faviconDataUrl = await tryFetchFaviconUrl(faviconUrl)
      if (faviconDataUrl) {
        logger.debug(`Found favicon at common path: ${faviconUrl}`)
        break
      }
    }
  }

  // Method 3: Try Google's favicon service as fallback
  if (!faviconDataUrl) {
    try {
      const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(baseUrl)}&sz=64`
      faviconDataUrl = await tryFetchFaviconUrl(googleFaviconUrl)
      if (faviconDataUrl) {
        logger.debug('Found favicon via Google service')
      }
    } catch (error) {
      logger.debug('Failed to fetch from Google favicon service:', error)
    }
  }

  // If we found a favicon, extract dominant color
  if (faviconDataUrl) {
    const dominantColor = await extractDominantColor(faviconDataUrl)
    return {
      dataUrl: faviconDataUrl,
      dominantColor,
    }
  }

  logger.warn(`Could not find favicon for ${baseUrl}`)
  return null
}
