import { fetchLink } from './links/fetchLink'

/**
 * The checksum published next to a song file, in `<url>.sha256`: the song
 * bundle's checksum (its manifest's `checksum`), first word of the file.
 */
export async function readPublishedChecksum(url: string): Promise<string> {
  const text = new TextDecoder().decode(await fetchLink(`${url}.sha256`))
  return text.trim().split(/\s/)[0] ?? ''
}
