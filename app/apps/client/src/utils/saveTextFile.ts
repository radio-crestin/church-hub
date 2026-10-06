import { saveFile } from './saveFile'

interface SaveTextFileOptions {
  content: string
  defaultFilename: string
  /** Label shown for the file type in the desktop save dialog. */
  filterName?: string
  /** Extensions offered by the desktop save dialog. */
  extensions?: string[]
}

/**
 * Hands a text file to the user (see saveFile).
 *
 * Returns false when the desktop dialog was dismissed without picking a path.
 */
export function saveTextFile({
  content,
  defaultFilename,
  filterName = 'Text File',
  extensions = ['txt'],
}: SaveTextFileOptions): Promise<boolean> {
  return saveFile({
    content,
    defaultFilename,
    filterName,
    extensions,
    mimeType: 'text/plain;charset=utf-8',
  })
}
