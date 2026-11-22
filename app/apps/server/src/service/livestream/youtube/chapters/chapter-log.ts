import {
  addPresentedItem,
  type ChapterEntry,
  MIN_CHAPTER_MS,
} from './add-presented-item'
import { buildDescription } from './build-description'
import { toPresentedItem } from './presented-item'
import { createLogger } from '../../../../utils/logger'
import { onPresentationStateBroadcast } from '../../../../websocket'
import { getPresentationState } from '../../../presentation/presentation-state'
import type { PresentationState } from '../../../presentation/types'
import { youtubeApiFetch } from '../client'

const logger = createLogger('youtube-chapters')

/**
 * The fewest ms between two description updates: each videos.update costs 50
 * of the channel's 10 000 daily quota units.
 */
const UPDATE_GAP_MS = 60_000

/** The video snippet fields videos.update would otherwise clear. */
interface VideoSnippet {
  title: string
  description: string
  categoryId?: string
  tags?: string[]
  defaultLanguage?: string
  defaultAudioLanguage?: string
}

interface Session {
  broadcastId: string
  startedAt: number
  snippet: VideoSnippet
  log: ChapterEntry[]
  published: string
  lastUpdateAt: number
  timer: ReturnType<typeof setTimeout> | null
  unsubscribe: () => void
}

let session: Session | null = null

function record(state: PresentationState) {
  const item = toPresentedItem(state)
  if (!session || !item) return
  addPresentedItem(session.log, item, Date.now())
  scheduleUpdate()
}

async function publish(current: Session) {
  const description = buildDescription(
    current.snippet.description,
    current.snippet.title,
    current.log,
    current.startedAt,
    Date.now(),
  )
  if (description === current.published) return
  current.lastUpdateAt = Date.now()
  await youtubeApiFetch(
    'videos',
    { part: 'snippet' },
    {
      method: 'PUT',
      body: JSON.stringify({
        id: current.broadcastId,
        snippet: { ...current.snippet, description },
      }),
    },
  )
  current.published = description
  logger.info(
    `Description of ${current.broadcastId}: ${current.log.length} chapter(s)`,
  )
}

function publishLogged(current: Session) {
  return publish(current).catch((error) =>
    logger.error(
      `Updating the description failed: ${error instanceof Error ? error.message : error}`,
    ),
  )
}

/** Updates the description once the item on screen has lasted a chapter's length, at most once per UPDATE_GAP_MS. */
function scheduleUpdate() {
  const current = session
  if (!current || current.timer) return
  const wait = Math.max(
    current.lastUpdateAt + UPDATE_GAP_MS - Date.now(),
    MIN_CHAPTER_MS,
  )
  current.timer = setTimeout(() => {
    current.timer = null
    void publishLogged(current)
  }, wait)
}

/**
 * Starts logging the songs and verses shown during the broadcast, from
 * `startedAt` (the stream's 0:00): its description gets a chapter for each
 * and their full text.
 */
export async function startChapterLog(
  broadcastId: string,
  startedAt: number,
): Promise<void> {
  await stopChapterLog()
  const video = await youtubeApiFetch<{ items?: { snippet?: VideoSnippet }[] }>(
    'videos',
    { part: 'snippet', id: broadcastId },
  )
  const found = video.items?.[0]?.snippet
  if (!found) throw new Error(`Video ${broadcastId} not found`)
  const { title, description, categoryId, tags } = found
  const snippet: VideoSnippet = {
    title,
    description: description ?? '',
    categoryId,
    tags,
    defaultLanguage: found.defaultLanguage,
    defaultAudioLanguage: found.defaultAudioLanguage,
  }
  session = {
    broadcastId,
    startedAt,
    snippet,
    log: [],
    published: snippet.description,
    lastUpdateAt: 0,
    timer: null,
    unsubscribe: onPresentationStateBroadcast(record),
  }
  logger.info(`Logging chapters for ${broadcastId}`)
  // What is on screen as the stream starts is its first chapter.
  const item = toPresentedItem(getPresentationState())
  if (item) addPresentedItem(session.log, item, startedAt)
}

/** Stops the log and writes the final description. */
export async function stopChapterLog(): Promise<void> {
  const current = session
  if (!current) return
  session = null
  current.unsubscribe()
  if (current.timer) clearTimeout(current.timer)
  await publishLogged(current)
}
