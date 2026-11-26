/** The gallery id in a stored media URL (`/api/media/backgrounds/<id>`). */
export function mediaIdOf(url: string): string {
  return decodeURIComponent(url.split('/').pop() ?? '')
}
