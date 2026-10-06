/** A song title made safe as a file name on every OS. */
export function sanitizeFilename(filename: string): string {
  // Remove or replace characters that are invalid in filenames
  return filename
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid chars
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim()
    .slice(0, 200) // Limit length
}
