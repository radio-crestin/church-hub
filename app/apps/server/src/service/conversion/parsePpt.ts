import './cfbShim'
import PPT from 'ppt-to-text'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  const prefix = `[ppt-parser] [${level.toUpperCase()}]`
  // biome-ignore lint/suspicious/noConsole: Debug logging utility controlled by env variables
  console.log(`${prefix} ${message}`)
}

export interface ParsedPptSlide {
  slideNumber: number
  text: string
  htmlContent: string
}

export interface ParsedPptResult {
  success: boolean
  title: string
  slides: ParsedPptSlide[]
  error?: string
}

/**
 * Sanitizes a song title extracted from PPT content
 */
function sanitizeTitle(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s\-'",!?.()]/gu, '')
    .trim()
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Parses a PPT file and extracts text from each slide using pure JavaScript.
 * No LibreOffice or other native dependencies required.
 *
 * @param pptData - Binary PPT file data as Buffer
 * @param filename - Optional filename to extract title from
 * @returns ParsedPptResult with slide text or error
 */
export function parsePptFile(
  pptData: Buffer,
  filename?: string,
): ParsedPptResult {
  log('debug', `Parsing PPT file (${pptData.length} bytes)`)

  try {
    const pres = PPT.readBuffer(pptData, {})
    const slideTexts: string[] = PPT.utils.to_text(pres)

    const slides: ParsedPptSlide[] = []

    for (let i = 0; i < slideTexts.length; i++) {
      const text = slideTexts[i].trim()
      if (!text) continue

      const lines = text.split('\n').filter((l: string) => l.trim())
      const htmlContent = lines
        .map((line: string) => `<p>${escapeHtml(line.trim())}</p>`)
        .join('')

      slides.push({
        slideNumber: i + 1,
        text,
        htmlContent,
      })
    }

    // Determine title: first slide's first line, or filename
    let title = 'Imported Song'

    if (slides.length > 0) {
      const firstLine = slides[0].text.split('\n')[0].trim()
      if (firstLine) {
        const sanitized = sanitizeTitle(firstLine)
        if (sanitized && sanitized !== 'Untitled Song') {
          title = sanitized
        }
      }
    }

    if (title === 'Imported Song' && filename) {
      const nameOnly = filename.split(/[/\\]/).pop() || filename
      title = sanitizeTitle(nameOnly.replace(/\.[^.]+$/, ''))
    }

    log('info', `Parsed ${slides.length} slides, title: "${title}"`)

    return { success: true, title, slides }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown parsing error'
    log('error', `PPT parsing failed: ${message}`)
    return { success: false, title: '', slides: [], error: message }
  }
}
