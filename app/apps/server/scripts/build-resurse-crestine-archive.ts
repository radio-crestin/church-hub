/**
 * Rebuilds the Resurse Creștine song archive from resursecrestine.ro's
 * OpenSong ZIP (see UPSTREAM_URLS): one OpenSong file per song, named after
 * the song, with the title an untitled song gets from its first lyric line
 * and the file it came from (source_filename). Run daily by
 * .github/workflows/resurse-crestine-archive.yml, which publishes it to the
 * `song-sources` release when the checksum changed
 * (docs/managed-song-sources.md).
 *
 * Usage: bun scripts/build-resurse-crestine-archive.ts <out-dir>
 * Writes resurse-crestine.chsongs, resurse-crestine-opensong.zip (the same
 * bytes, for other programs) and resurse-crestine.chsongs.sha256 to
 * <out-dir>, and `checksum=<the bundle's checksum>` to $GITHUB_OUTPUT when set.
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

/**
 * resursecrestine.ro's own download pages, which redirect to wherever the
 * ZIP lives now (its download host has changed and refused direct links
 * before): the OpenSong "standard" archive, then the "proiecție" one.
 */
const UPSTREAM_URLS = [
  'https://www.resursecrestine.ro/download/52651',
  'https://www.resursecrestine.ro/download/65147',
]
/** The files are named after the source, as the publisher expects. */
const ARCHIVE_NAME = source.id

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

/**
 * Repairs what makes some upstream files invalid XML, which no OpenSong reader
 * accepts: a bare "&" ("Bill & Gloria Gaither") and control characters such
 * as a stray vertical tab.
 */
const toValidXml = (xml: string) =>
  xml
    .replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')

/** The upstream file with our title and the name of the file it came from. */
function rewrite(xml: string, title: string, fileName: string): string {
  const ours = `<title>${escapeXml(title)}</title>\n  <source_filename>${escapeXml(fileName)}</source_filename>`
  const valid = toValidXml(xml)
  return /<title>[\s\S]*?<\/title>/.test(valid)
    ? valid.replace(/<title>[\s\S]*?<\/title>/, ours)
    : valid.replace(/<song([^>]*)>/, `<song$1>\n  ${ours}`)
}

/** The first upstream archive that downloads, saying why each other failed. */
async function downloadUpstream(): Promise<JSZip> {
  const failures: string[] = []
  for (const url of UPSTREAM_URLS) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`)
      }
      return await JSZip.loadAsync(await response.arrayBuffer())
    } catch (error) {
      failures.push(`${url}: ${error instanceof Error ? error.message : error}`)
      // biome-ignore lint/suspicious/noConsole: CI log of the fallback
      console.warn(`Download failed, ${failures.at(-1)}`)
    }
  }
  throw new Error(`Every download failed:\n${failures.join('\n')}`)
}

async function main() {
  const [outDir] = process.argv.slice(2)
  if (!outDir) throw new Error('usage: <out-dir>')

  const zip = await downloadUpstream()

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
  // biome-ignore lint/suspicious/noConsole: CI log of what was built
  console.log(`${songs.length} songs, checksum ${checksum}`)
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `checksum=${checksum}\n`)
  }

  const archive = await zipBundleFiles(bundle)
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, `${ARCHIVE_NAME}.chsongs`), archive)
  writeFileSync(join(outDir, `${ARCHIVE_NAME}-opensong.zip`), archive)
  writeFileSync(join(outDir, `${ARCHIVE_NAME}.chsongs.sha256`), `${checksum}\n`)
}

await main()
