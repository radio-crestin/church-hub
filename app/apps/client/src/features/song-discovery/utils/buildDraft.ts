import { defaultSongMetadata } from '~/features/songs/components/SongDetailsSection'
import type { CandidateDraft, DiscoveryCandidate } from '../types'

/** Seeds an editable draft from a parsed external candidate. */
export function buildDraft(
  candidate: DiscoveryCandidate,
  defaultCategoryId: number | null,
): CandidateDraft {
  const m = candidate.parsed.metadata
  return {
    title: candidate.parsed.title,
    categoryId: defaultCategoryId,
    slides: candidate.parsed.slides.map((slide, idx) => ({
      id: `${candidate.tempId}-slide-${idx}`,
      content: slide.htmlContent,
      sortOrder: idx,
      label: slide.label ?? null,
    })),
    metadata: {
      ...defaultSongMetadata,
      sourceFilename: candidate.sourceFilename,
      author: m?.author ?? null,
      copyright: m?.copyright ?? null,
      ccli: m?.ccli ?? null,
      tempo: m?.tempo ?? null,
      timeSignature: m?.timeSignature ?? null,
      theme: m?.theme ?? null,
      altTheme: m?.altTheme ?? null,
      hymnNumber: m?.hymnNumber ?? null,
      keyLine: m?.keyLine ?? null,
      presentationOrder: m?.presentationOrder ?? null,
    },
  }
}
