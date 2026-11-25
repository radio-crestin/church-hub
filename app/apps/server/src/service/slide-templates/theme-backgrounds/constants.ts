/** Where the built-in themes' backgrounds are served (relative to the API host). */
export const THEME_BACKGROUNDS_URL_PREFIX = '/api/media/theme-backgrounds'

/**
 * Folder of the backgrounds the built-in themes ship with, inside the bundled
 * resources (`tauri/resources/theme-backgrounds` in the repo).
 */
export const THEME_BACKGROUNDS_RESOURCE_DIR = 'theme-backgrounds'

/** A plain file name of the folder: no path, so nothing outside it is served. */
export const THEME_BACKGROUND_FILE_REGEX =
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.poster)?\.(jpg|mp4)$/

export const THEME_BACKGROUND_MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  mp4: 'video/mp4',
}
