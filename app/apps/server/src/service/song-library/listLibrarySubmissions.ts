import { parseOpenSongXml } from '@church-hub/song-formats'

import { fetchSubmissions } from './fetchSubmissions'
import { findLibraryMatches } from './findLibraryMatches'
import { readCuratedLibrary } from './readCuratedLibrary'
import { requireCuratorTicket } from './requireCuratorTicket'
import type { LibrarySubmission } from './types'

/** The curator's queue: each submission's slides and likely duplicates. */
export async function listLibrarySubmissions(): Promise<LibrarySubmission[]> {
  const ticket = requireCuratorTicket()
  const [submissions, { manifest }] = await Promise.all([
    fetchSubmissions(ticket),
    readCuratedLibrary(),
  ])
  const listed: LibrarySubmission[] = []
  for (const submission of submissions) {
    const parsed = parseOpenSongXml(submission.xml, undefined, {
      exactTitle: true,
    })
    const slides = parsed.slides.map((slide) => ({
      label: slide.label ?? null,
      text: slide.text,
    }))
    listed.push({
      id: submission.id,
      submittedAt: submission.submittedAt,
      title: submission.title,
      churchName: submission.churchName,
      note: submission.note,
      slides,
      matches: await findLibraryMatches(
        manifest,
        submission.title,
        slides.map((slide) => slide.text),
      ),
    })
  }
  return listed
}
