import { removeHtmlTags } from '~/utils/removeHtmlTags'
import type { SongBundleSong } from './types'
import type { DiscoveryCandidate } from '../types'

/** Slide HTML as plain lines: one line per paragraph or line break. */
function slideText(html: string): string {
  return removeHtmlTags(html.replace(/<\/p>|<br\s*\/?>/gi, '\n')).trim()
}

/** A song bundle's songs as discovery candidates. */
export function bundleSongsToCandidates(
  sourceId: string,
  songs: SongBundleSong[],
): DiscoveryCandidate[] {
  return songs.map((song) => ({
    tempId: `${sourceId}-${song.id}`,
    sourceFilename: song.sourceFilename,
    parsed: {
      title: song.title,
      slides: song.slides.map((slide, index) => ({
        slideNumber: index + 1,
        text: slideText(slide.content),
        htmlContent: slide.content,
        label: slide.label,
      })),
      metadata: {
        author: song.author,
        copyright: song.copyright,
        ccli: song.ccli,
        tempo: song.tempo,
        timeSignature: song.timeSignature,
        theme: song.theme,
        altTheme: song.altTheme,
        hymnNumber: song.hymnNumber,
        keyLine: song.keyLine,
        presentationOrder: song.presentationOrder,
        churchHubId: null,
      },
    },
  }))
}
