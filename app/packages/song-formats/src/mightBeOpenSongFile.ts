/**
 * A file extension: up to 4 letters and digits, one a letter, after the last
 * dot. A dot inside a song's name is not one ("Când suferi... - 168654",
 * "Isaia 38.9-20) Partea XII", "Psalmul 23.1").
 */
const EXTENSION = /\.(?=\d*[a-z])[a-z\d]{1,4}$/i

/**
 * Whether a file could be an OpenSong song, by its path: a `.opensong` or
 * `.xml` file, or one with no extension (how OpenSong itself saves songs,
 * named after the song). macOS metadata and hidden files are not.
 */
export function mightBeOpenSongFile(filePath: string): boolean {
  const filename = filePath.split(/[/\\]/).pop() || ''
  const lowerPath = filePath.toLowerCase()
  if (lowerPath.includes('__macosx') || filename.startsWith('.')) return false
  return (
    lowerPath.endsWith('.opensong') ||
    lowerPath.endsWith('.xml') ||
    !EXTENSION.test(filename)
  )
}
