import { createLogger } from '~/utils/logger'

const logger = createLogger('app:windowIcon')

/**
 * SVG path data for available icons (from Lucide)
 * Each icon is defined by its SVG path data
 */
const ICON_PATHS: Record<string, string> = {
  Globe:
    '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  Link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  ExternalLink:
    '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  FileText:
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  Video:
    '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  Image:
    '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  Bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
  Star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  Heart:
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  Home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  Users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  Calendar:
    '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  MessageSquare:
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  Phone:
    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  Mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  Map: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
  Compass:
    '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  Search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  Clock:
    '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  Bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  Layers:
    '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  Grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  List: '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>',
  Folder:
    '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  // Built-in sidebar icons
  SquarePlay:
    '<rect x="2" y="2" width="20" height="20" rx="2"/><polygon points="10 8 16 12 10 16 10 8"/>',
  Music:
    '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  Book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>',
  CalendarDays:
    '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>',
  Radio:
    '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>',
  Headphones:
    '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
  Monitor:
    '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
  Settings:
    '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
}

/**
 * Primary color for icon backgrounds (indigo-600)
 */
const PRIMARY_COLOR = '#4f46e5'

/**
 * Icon size for rendering
 */
const ICON_SIZE = 64

/**
 * Generates a colored window icon from a Lucide icon name
 * Creates a circular icon with primary color background and white icon
 *
 * @param iconName - The name of the Lucide icon
 * @param backgroundColor - Optional background color (defaults to primary indigo)
 * @returns PNG image as Uint8Array, or null if generation fails
 */
export async function generateWindowIcon(
  iconName: string,
  backgroundColor: string = PRIMARY_COLOR,
): Promise<Uint8Array | null> {
  try {
    const iconPath = ICON_PATHS[iconName]
    if (!iconPath) {
      logger.warn(`Unknown icon: ${iconName}`)
      return null
    }

    // Create SVG string with white icon
    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="30" fill="${backgroundColor}"/>
        <g transform="translate(20, 20) scale(1)" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          ${iconPath}
        </g>
      </svg>
    `

    // Create canvas
    const canvas = document.createElement('canvas')
    canvas.width = ICON_SIZE
    canvas.height = ICON_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      logger.error('Could not get canvas context')
      return null
    }

    // Create image from SVG
    const img = new Image()
    const blob = new Blob([svgString], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)

    return new Promise((resolve) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, ICON_SIZE, ICON_SIZE)
        URL.revokeObjectURL(url)

        // Convert to PNG bytes
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              logger.error('Failed to create blob')
              resolve(null)
              return
            }

            blob.arrayBuffer().then((buffer) => {
              resolve(new Uint8Array(buffer))
            })
          },
          'image/png',
          1.0,
        )
      }

      img.onerror = () => {
        logger.error('Failed to load SVG')
        URL.revokeObjectURL(url)
        resolve(null)
      }

      img.src = url
    })
  } catch (error) {
    logger.error('Error generating icon:', error)
    return null
  }
}

/**
 * Gets the available icon names
 */
export function getAvailableIconNames(): string[] {
  return Object.keys(ICON_PATHS)
}

/**
 * Generates a window icon from a custom image URL (base64 data URL)
 * Creates a rounded icon suitable for window title bar
 *
 * @param imageUrl - Base64 data URL of the image
 * @returns PNG image as Uint8Array, or null if generation fails
 */
export async function generateWindowIconFromImage(
  imageUrl: string,
): Promise<Uint8Array | null> {
  try {
    // Create canvas
    const canvas = document.createElement('canvas')
    canvas.width = ICON_SIZE
    canvas.height = ICON_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      logger.error('Could not get canvas context')
      return null
    }

    // Create image from URL
    const img = new Image()

    return new Promise((resolve) => {
      img.onload = () => {
        // Draw image to fill the canvas
        ctx.drawImage(img, 0, 0, ICON_SIZE, ICON_SIZE)

        // Convert to PNG bytes
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              logger.error('Failed to create blob from custom image')
              resolve(null)
              return
            }

            blob.arrayBuffer().then((buffer) => {
              resolve(new Uint8Array(buffer))
            })
          },
          'image/png',
          1.0,
        )
      }

      img.onerror = () => {
        logger.error('Failed to load custom image for icon')
        resolve(null)
      }

      img.src = imageUrl
    })
  } catch (error) {
    logger.error('Error generating icon from custom image:', error)
    return null
  }
}
