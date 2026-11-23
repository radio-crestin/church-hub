/**
 * Re-syncs the bundled Bible topics from OpenBible.info's topical data
 * (https://www.openbible.info/topics/, CC BY 4.0).
 *
 * topics.json (next to this script) is the curated list: each topic's key,
 * English and Romanian title and the OpenBible topic(s) it draws from. This
 * script downloads OpenBible's vote counts, ranks each topic's passages by
 * votes and writes the best ones, as references only (no verse text), to
 * src/db/fixtures/default-bible-topics.json.
 *
 * Usage: bun scripts/bible-topics/import-openbible-topics.ts [topic-votes.txt]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { BOOK_ORDER } from '../../src/service/bible/types'

const VOTES_URL = 'https://a.openbible.info/data/topic-votes.txt'
const OUT_PATH = join(
  import.meta.dir,
  '../../src/db/fixtures/default-bible-topics.json',
)
/** The best passages kept per topic. */
const MAX_REFERENCES = 15
/** Longer passages are left out: a topic lists verses, not chapters. */
const MAX_PASSAGE_VERSES = 6
/** A passage needs this many votes, and this share of the topic's best. */
const MIN_VOTES = 20
const MIN_SHARE_OF_BEST = 0.05

interface CuratedTopic {
  key: string
  en: string
  ro: string
  sources: string[]
  /** Passages voted into a topic they don't belong to, by start: `LEV.20.13` */
  exclude?: string[]
}

export interface BibleTopicReferenceFixture {
  /** The app's book code (`GEN`…`REV`), as in bible_books.book_code */
  book: string
  chapter: number
  startVerse: number
  endVerse: number
}

export interface BibleTopicFixture {
  key: string
  titleEn: string
  titleRo: string
  references: BibleTopicReferenceFixture[]
}

/** `bbcccvvv` → book, chapter, verse */
function parseVerseId(id: string) {
  return {
    book: Number(id.slice(0, 2)),
    chapter: Number(id.slice(2, 5)),
    verse: Number(id.slice(5, 8)),
  }
}

/** Canonical book number (1 = Genesis … 66 = Revelation) → book code */
const BOOK_CODES = Object.fromEntries(
  Object.entries(BOOK_ORDER).map(([code, order]) => [order, code]),
) as Record<number, string>

function startOf(ref: BibleTopicReferenceFixture): string {
  return `${ref.book}.${ref.chapter}.${ref.startVerse}`
}

async function readVotes(path: string | undefined): Promise<string> {
  if (path) return readFileSync(path, 'utf8')
  const response = await fetch(VOTES_URL)
  if (!response.ok) {
    throw new Error(`Downloading ${VOTES_URL} failed: ${response.status}`)
  }
  return response.text()
}

/** topic → passage (`start-end`) → votes */
function parseVotes(text: string): Map<string, Map<string, number>> {
  const byTopic = new Map<string, Map<string, number>>()
  for (const line of text.split('\n').slice(1)) {
    const [topic, start, end, votes] = line.trimEnd().split('\t')
    if (!topic || !start || !votes) continue
    const passages = byTopic.get(topic) ?? new Map<string, number>()
    const passage = `${start}-${end || start}`
    passages.set(passage, (passages.get(passage) ?? 0) + Number(votes))
    byTopic.set(topic, passages)
  }
  return byTopic
}

function toReference(passage: string): BibleTopicReferenceFixture | null {
  const [startId, endId] = passage.split('-')
  const start = parseVerseId(startId)
  const end = parseVerseId(endId)
  const sameChapter = start.book === end.book && start.chapter === end.chapter
  if (!sameChapter || end.verse < start.verse) return null
  if (end.verse - start.verse + 1 > MAX_PASSAGE_VERSES) return null
  return {
    book: BOOK_CODES[start.book],
    chapter: start.chapter,
    startVerse: start.verse,
    endVerse: end.verse,
  }
}

/** Eph 2:8 and Eph 2:8-9 both rank high: keep only the better voted one. */
function overlaps(
  a: BibleTopicReferenceFixture,
  b: BibleTopicReferenceFixture,
): boolean {
  return (
    a.book === b.book &&
    a.chapter === b.chapter &&
    a.startVerse <= b.endVerse &&
    b.startVerse <= a.endVerse
  )
}

function buildTopic(
  topic: CuratedTopic,
  votes: Map<string, Map<string, number>>,
): BibleTopicFixture {
  const merged = new Map<string, number>()
  for (const source of topic.sources) {
    const passages = votes.get(source)
    if (!passages) throw new Error(`OpenBible has no topic "${source}"`)
    for (const [passage, count] of passages) {
      merged.set(passage, (merged.get(passage) ?? 0) + count)
    }
  }
  const ranked = [...merged].sort((a, b) => b[1] - a[1])
  const best = ranked[0]?.[1] ?? 0
  const minVotes = Math.max(MIN_VOTES, best * MIN_SHARE_OF_BEST)
  const excluded = new Set(topic.exclude ?? [])

  const references: BibleTopicReferenceFixture[] = []
  for (const [passage, count] of ranked) {
    if (count < minVotes || references.length >= MAX_REFERENCES) break
    const reference = toReference(passage)
    if (!reference || excluded.has(startOf(reference))) continue
    if (references.some((kept) => overlaps(kept, reference))) continue
    references.push(reference)
  }
  return { key: topic.key, titleEn: topic.en, titleRo: topic.ro, references }
}

const curated = JSON.parse(
  readFileSync(join(import.meta.dir, 'topics.json'), 'utf8'),
) as CuratedTopic[]
const votes = parseVotes(await readVotes(process.argv[2]))
const topics = curated.map((topic) => buildTopic(topic, votes))

for (const topic of topics) {
  if (topic.references.length < 5) {
    // biome-ignore lint/suspicious/noConsole: script output
    console.warn(`${topic.key}: only ${topic.references.length} references`)
  }
}
// One reference per line keeps the fixture readable and its diffs small
const json = JSON.stringify(topics, null, 2).replace(
  /\{\s+("book": "\w+"),\s+("chapter": \d+),\s+("startVerse": \d+),\s+("endVerse": \d+)\s+\}/g,
  '{ $1, $2, $3, $4 }',
)
writeFileSync(OUT_PATH, `${json}\n`)
// biome-ignore lint/suspicious/noConsole: script output
console.log(
  `Wrote ${topics.length} topics, ${topics.reduce((n, t) => n + t.references.length, 0)} references to ${OUT_PATH}`,
)
