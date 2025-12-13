import JSZip from 'jszip'

/**
 * Sanitizes a filename by removing/replacing invalid characters
 */
export function sanitizeFilename(filename: string): string {
  // Remove or replace characters that are invalid in filenames
  return filename
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid chars
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim()
    .slice(0, 200) // Limit length
}

/**
 * Song file for export
 */
interface ExportFile {
  filename: string
  xmlContent: string
}

/**
 * Progress callback type
 */
type ProgressCallback = (current: number, total: number) => void

/**
 * Creates a ZIP archive containing OpenSong XML files
 */
export async function createExportZip(
  songs: ExportFile[],
  onProgress?: ProgressCallback,
): Promise<Blob> {
  const zip = new JSZip()

  for (let i = 0; i < songs.length; i++) {
    const { filename, xmlContent } = songs[i]
    const safeFilename = sanitizeFilename(filename)

    // OpenSong files typically don't have extensions, but we add .xml for clarity
    zip.file(`${safeFilename}`, xmlContent)

    onProgress?.(i + 1, songs.length)
  }

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

/**
 * Triggers a file download in the browser
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
