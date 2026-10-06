/**
 * Rebuilds the Resurse Creștine song archive from resursecrestine.ro's
 * OpenSong ZIP: one OpenSong file per song, named after the song, with the
 * title an untitled song gets from its first lyric line and the file it came
 * from (source_filename). Run daily by .github/workflows/resurse-crestine-archive.yml.
 *
 * Usage: bun scripts/build-resurse-crestine-archive.ts <out-dir> [previous-checksum]
 * Writes resurse-crestine.chsongs, .zip (same bytes) and .chsongs.sha256 to
 * <out-dir>, and `changed=true|false` to $GITHUB_OUTPUT when set. Nothing is
 * written when the checksum equals the previous one.
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  decodeHtmlEntities,
  isOpenSongXml,
  mightBeOpenSongFile,
  sanitizeFilename,
  sanitizeSongTitle,
} from '@church-hub/song-formats'
import JSZip from 'jszip'

import source from '../src/service/song-sources/built-in/resurse-crestine.json'
import {
  assembleBundle,
  type BundleSongInput,
  shortHash,
} from '../src/service/song-sources/bundle/assembleBundle'
import { zipBundleFiles } from '../src/service/song-sources/bundle/zipBundleFiles'

const UPSTREAM_URL =
  'https://download.resursecrestine.ro/programe-crestine/cantece-resurse-crestine-opensong-standard.zip'
const ARCHIVE_NAME = 'resurse-crestine'

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** A title is junk when the file had none ("[unnamed] - 0012" → "unnamed"). */
function isJunkTitle(title: string): boolean {
  const t = title.trim().toLowerCase()
  return t === '' || t === 'unnamed' || t === 'untitled song'
}

/** The first line of the lyrics, skipping labels, chords and comments. */
function firstLyricLine(xml: string): string {
  const lyrics = xml.match(/<lyrics>([\s\S]*?)<\/lyrics>/)?.[1] ?? ''
  return (
    decodeHtmlEntities(lyrics)
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line && !/^[[.;]/.test(line)) ?? ''
  )
}

/** The song's title: its own, cleaned up, or its first lyric line. */
function songTitle(xml: string, fileName: string): string {
  const own = decodeHtmlEntities(
    xml.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '',
  )
  const title = sanitizeSongTitle(own || fileName)
  if (!isJunkTitle(title)) return title
  const fromLyrics = sanitizeSongTitle(firstLyricLine(xml))
  return isJunkTitle(fromLyrics) ? title : fromLyrics
}

/** The upstream file with our title and the name of the file it came from. */
function rewrite(xml: string, title: string, fileName: string): string {
  const ours = `<title>${escapeXml(title)}</title>\n  <source_filename>${escapeXml(fileName)}</source_filename>`
  return /<title>[\s\S]*?<\/title>/.test(xml)
    ? xml.replace(/<title>[\s\S]*?<\/title>/, ours)
    : xml.replace(/<song([^>]*)>/, `<song$1>\n  ${ours}`)
}

async function main() {
  const [outDir, previousChecksum] = process.argv.slice(2)
  if (!outDir) throw new Error('usage: <out-dir> [previous-checksum]')

  const response = await fetch(UPSTREAM_URL)
  if (!response.ok) throw new Error(`Download failed: ${response.status}`)
  const zip = await JSZip.loadAsync(await response.arrayBuffer())

  const songs: BundleSongInput[] = []
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !mightBeOpenSongFile(entry.name)) continue
    const xml = await entry.async('string')
    if (!isOpenSongXml(xml)) continue
    const fileName = entry.name.split('/').pop() ?? entry.name
    const title = songTitle(xml, fileName)
    songs.push({
      id: shortHash(fileName),
      title,
      baseName: sanitizeFilename(title) || fileName,
      xml: rewrite(xml, title, fileName),
    })
  }
  songs.sort(
    (a, b) => a.baseName.localeCompare(b.baseName) || a.id.localeCompare(b.id),
  )

  const bundle = assembleBundle(
    { name: source.name, categoryName: source.categoryName },
    songs,
  )
  const { checksum } = bundle.manifest
  const changed = checksum !== previousChecksum?.trim()
  // biome-ignore lint/suspicious/noConsole: CI log of what was built
  console.log(
    `${songs.length} songs, checksum ${checksum}, changed: ${changed}`,
  )
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`)
  }
  if (!changed) return

  const archive = await zipBundleFiles(bundle)
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, `${ARCHIVE_NAME}.chsongs`), archive)
  writeFileSync(join(outDir, `${ARCHIVE_NAME}.zip`), archive)
  writeFileSync(join(outDir, `${ARCHIVE_NAME}.chsongs.sha256`), `${checksum}\n`)
}

await main()
