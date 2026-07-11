// --probe-midi: short-circuit handler used by the MIDI safety check.
//
// The parent server invokes `process.execPath --probe-midi` in a subprocess
// to verify that touching CoreMIDI on macOS won't crash the main process.
// On success the probe exits 0, on a native crash it dies with a signal,
// and we MUST do this without binding to port 3000 (which would SIGKILL
// the parent via killProcessOnPort) — that was the v0.1.60 regression
// where the macOS release exited silently a few seconds after launch.
//
// `-e <code>` was the old approach but Bun's compiled standalone ignores
// `-e` and runs the full server, hence this dedicated flag.
if (process.argv.includes('--probe-midi')) {
  try {
    // biome-ignore lint/correctness/noNodejsModules: probe must be self-contained
    const probeFs = require('node:fs') as typeof import('node:fs')
    // biome-ignore lint/correctness/noNodejsModules: probe must be self-contained
    const probePath = require('node:path') as typeof import('node:path')

    let probeMidiPath: string | null = null
    if (process.platform === 'darwin') {
      // <App>/Contents/MacOS/<sidecar>  →  <App>/Contents/Resources/midi-native/midi.node
      probeMidiPath = probePath.join(
        process.execPath,
        '..',
        '..',
        'Resources',
        'midi-native',
        'midi.node',
      )
    } else {
      // Windows / Linux: resources sit next to the executable
      probeMidiPath = probePath.join(
        process.execPath,
        '..',
        'midi-native',
        'midi.node',
      )
    }

    if (probeMidiPath && probeFs.existsSync(probeMidiPath)) {
      const probeNative = require(probeMidiPath)
      // Constructing an Input is what actually touches CoreMIDI on darwin.
      const probeInput = new probeNative.Input(() => {})
      try {
        probeInput.closePort?.()
        probeInput.destroy?.()
      } catch {
        // ignore — we only care whether construction crashed
      }
    } else {
      // Dev / unbundled fallback
      require('easymidi').getInputs()
    }
    process.exit(0)
  } catch {
    process.exit(1)
  }
}

import { authLogger, logToFile } from './utils/fileLogger'
// PostHog client (errors + events) — initialised on import.
import {
  captureAppStarted,
  captureException as captureExceptionPostHog,
  captureFeedbackReport,
  captureMessage as captureMessageServer,
  flushPostHog,
  shutdownPostHog,
} from './utils/posthog'

// Fire the boot heartbeat right after PostHog import. Filtering for
// `app_started` + `component:"server"` in the PostHog dashboard confirms
// the sidecar's outbound path is healthy after every release.
captureAppStarted()

import { execFileSync, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import process from 'node:process'

import { closeDatabase, getRawDatabase, initializeDatabase } from './db'
import type { RequestContext } from './middleware'
import {
  appOnlyAuthMiddleware,
  buildUserAuthCookie,
  combinedAuthMiddleware,
  isLocalhost,
  requireAnyPermission,
  requirePermission,
} from './middleware'
import { getOpenApiSpec, getScalarDocs } from './openapi'
import { handleLiveTranslationRoutes } from './routes/live-translation'
import { handleLivestreamRoutes } from './routes/livestream'
import { handleMIDIRoutes } from './routes/midi'
import { handleMusicRoutes } from './routes/music'
import {
  ALL_PERMISSIONS,
  type CreateUserInput,
  createUser,
  deleteSetting,
  deleteUser,
  getAllRoles,
  getAllSettings,
  getAllUsers,
  getLocalUsers,
  getSetting,
  getUserById,
  getUserByToken,
  type Permission,
  regenerateUserToken,
  type SettingsTable,
  setUserPassword,
  setUserRole,
  type UpdateUserInput,
  updateUser,
  updateUserPermissions,
  upsertSetting,
  verifyLogin,
} from './service'
import { aiBibleSearch } from './service/ai-bible-search'
import { aiSearchSongs } from './service/ai-search'
import {
  getOrCreateSystemToken,
  getSystemToken,
  regenerateSystemToken,
} from './service/app-sessions'
import {
  clearDriveAuth,
  completeDriveAuth,
  createDriveAuthUrl,
  deleteBackup,
  getBackupConfig,
  getBackupStatus,
  listBackups,
  restoreBackup,
  startBackupScheduler,
  uploadBackup,
  upsertBackupConfig,
} from './service/backup'
import {
  type CreateTranslationInput,
  deleteTranslation,
  ensureRCCVExists,
  getAllTranslations,
  getBooksByTranslation,
  getChaptersForBook,
  getNextVerse,
  getTranslationById,
  getVerse,
  getVerseById,
  getVersesByChapter,
  importBibleTranslation,
  rebuildSearchIndex as rebuildBibleSearchIndex,
  type SearchVersesInput,
  searchBible,
  warmupSearchIndex as warmupBibleSearchIndex,
} from './service/bible'
import {
  type AddToHistoryInput,
  addToHistory,
  clearHistory,
  getHistory,
} from './service/bible-history'
import { parsePptFile } from './service/conversion'
import {
  checkpointAndExport,
  getDatabaseInfo,
  type ImportOptions,
  importDatabase,
  performFactoryReset,
  selectiveImportDatabase,
} from './service/database'
import {
  detectContentType,
  handleContentTypeChange,
  initializeOBSAutoConnect,
  initializeOBSCallbacks,
} from './service/livestream/obs'
import { clearLogs, openLogsFolder, readRecentLogs } from './service/logs'
import {
  initializeMIDI,
  setAllLEDs,
  setConnectionStatusCallback,
  setDevicesChangedCallback,
  setLED,
  setMessageCallback,
  shutdownMIDI,
} from './service/midi'
import { handleMIDIShortcut, loadMIDIShortcuts } from './service/midi/shortcuts'
import { getFileById } from './service/music/getFiles'
import {
  addMultipleToNowPlaying,
  clearNowPlayingQueue,
  executeCommand,
  getPlayerState,
  initializeMusicPlayer,
  refreshQueueState,
  removeFromNowPlaying,
  reorderNowPlaying,
  setNowPlayingQueue,
  setStateCallback,
  shutdownMusicPlayer,
} from './service/music-player'
import { getExternalInterfaces } from './service/network'
import {
  addSlideHighlight,
  batchUpdateScreenConfigs,
  type ContentType,
  clearSlide,
  clearSlideHighlights,
  clearTemporaryContent,
  deleteAllSceneOverrides,
  deleteSceneOverride,
  deleteScreen,
  getAllScreens,
  getContentConfig,
  getNextSlideConfig,
  getPresentationState,
  getScreenById,
  getScreenWithConfigs,
  getSlideHighlights,
  type NavigateTemporaryInput,
  type NextSlideSectionConfig,
  navigateTemporary,
  type PresentTemporaryAnnouncementInput,
  type PresentTemporaryBibleInput,
  type PresentTemporaryBiblePassageInput,
  type PresentTemporarySceneInput,
  type PresentTemporarySongInput,
  type PresentTemporaryVerseteTineriInput,
  presentTemporaryAnnouncement,
  presentTemporaryBible,
  presentTemporaryBiblePassage,
  presentTemporaryScene,
  presentTemporarySong,
  presentTemporaryVerseteTineri,
  refreshPresentedSongSlides,
  removeSlideHighlight,
  type ScreenGlobalSettings,
  showSlide,
  stopPresentation,
  type TextStyleRange,
  type UpdatePresentationStateInput,
  type UpsertScreenInput,
  updateContentConfig,
  updateGlobalSettings,
  updateNextSlideConfig,
  updatePresentationState,
  upsertSceneOverride,
  upsertScreen,
} from './service/presentation'
import {
  type AddToScheduleInput,
  addItemToSchedule,
  deleteSchedule,
  getScheduleById,
  getSchedules,
  type ReorderScheduleItemsInput,
  type ReplaceScheduleItemsInput,
  rebuildScheduleSearchIndex,
  removeItemFromSchedule,
  reorderScheduleItems,
  replaceScheduleItems,
  searchSchedules,
  type UpdateScheduleSlideInput,
  type UpsertScheduleInput,
  updateScheduleSlide,
  upsertSchedule,
} from './service/schedules'
import {
  deleteSearch,
  getSearchById,
  getSearchByUrlPath,
  type SaveSearchInput,
  saveSearch,
} from './service/search-history'
import {
  addBookmark,
  addBookmarkNote,
  type BookmarkItemRef,
  clearBookmarks,
  exportBookmarksAsText,
  getBookmarkNotes,
  getBookmarks,
  removeBookmark,
  removeBookmarkNote,
  reorderBookmarkItems,
  reorderBookmarks,
  updateBookmarkNote,
} from './service/song-bookmarks'
import {
  type BatchImportSongInput,
  batchImportSongs,
  batchUpdateSearchIndex,
  clearSearchCache,
  cloneSongSlide,
  completeSongReplacement,
  countNewCandidates,
  type DiscoveryCandidateInput,
  deleteCategory,
  deleteSong,
  deleteSongSlide,
  deleteSongsByIds,
  deleteTag,
  deleteUncategorizedSongs,
  getAllCategories,
  getAllSongs,
  getAllSongsWithSlides,
  getAllTags,
  getCategoryById,
  getGroupForSong,
  getSimilarSongs,
  getSongGroupWithMembers,
  getSongSlideById,
  getSongsPaginated,
  getSongWithSlides,
  linkSongs,
  matchCandidatesAgainstLibrary,
  type ReorderCategoriesInput,
  type ReorderSongSlidesInput,
  type ReorderTagsInput,
  rebuildSearchIndex,
  removeFromSearchIndex,
  reorderCategories,
  reorderSongSlides,
  reorderTags,
  resetSongPresentationCount,
  type SongFilters,
  searchSongs,
  setPrimarySong,
  type UpsertCategoryInput,
  type UpsertSongInput,
  type UpsertSongSlideInput,
  type UpsertTagInput,
  unlinkSong,
  updateSearchIndex,
  updateSearchIndexByCategory,
  upsertCategory,
  upsertSong,
  upsertSongSlide,
  upsertTag,
  warmupSearchIndex as warmupSongsSearchIndex,
} from './service/songs'
import {
  type BootPhase,
  getBootHealth,
  setBootFailed,
  setBootPhase,
  setBootReady,
} from './utils/bootState'
import { createLogger } from './utils/logger'
import { getLogsDir } from './utils/paths'
import { reportError } from './utils/reportError'
import { logRequest, logResponse } from './utils/request-logger'
import { proxyToVite, serveStaticFile } from './utils/static-server'
import {
  broadcastMIDIConnectionStatus,
  broadcastMIDIDevices,
  broadcastMIDIMessage,
  broadcastMusicState,
  broadcastPresentationState,
  broadcastScreenConfigUpdated,
  broadcastSettingsUpdated,
  broadcastSlideHighlights,
  broadcastSongUpdated,
  handleWebSocketClose,
  handleWebSocketMessage,
  handleWebSocketOpen,
  setMIDIMessageHandler,
  setMusicCommandHandler,
  setMusicStateProvider,
  stopActiveScreenShare,
  type WebSocketData,
} from './websocket'

/**
 * Short-lived, single-use login tickets. After a password is verified via
 * POST /api/auth/login the client receives a ticket and performs a TOP-LEVEL
 * navigation to /api/auth/login-redirect/:ticket. Setting the session cookie
 * on a navigation response (302) reliably overwrites the existing cookie in
 * every webview — unlike a cross-origin `fetch` Set-Cookie, which the Tauri
 * desktop webview may not apply. This is what makes "switch user" work on
 * desktop. Tickets expire after 60s and are consumed on use.
 */
const LOGIN_TICKET_TTL_MS = 60_000
const loginTickets = new Map<string, { token: string; expiresAt: number }>()

function createLoginTicket(token: string): string {
  const ticket = crypto.randomUUID()
  loginTickets.set(ticket, {
    token,
    expiresAt: Date.now() + LOGIN_TICKET_TTL_MS,
  })
  return ticket
}

function consumeLoginTicket(ticket: string): string | null {
  const entry = loginTickets.get(ticket)
  loginTickets.delete(ticket)
  if (!entry || entry.expiresAt < Date.now()) return null
  return entry.token
}

/**
 * Validates a post-login return URL. Only same-machine origins are allowed so
 * the redirect can never be turned into an open redirect.
 */
function resolveReturnUrl(
  returnParam: string | null,
  fallbackHost: string,
): string {
  const fallback = `http://${fallbackHost}/`
  if (!returnParam) return fallback
  try {
    const u = new URL(returnParam)
    const host = u.hostname.toLowerCase()
    const allowed =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === 'tauri.localhost' ||
      host.endsWith('.localhost')
    return allowed ? u.toString() : fallback
  } catch {
    return fallback
  }
}

// Startup timing helper
const startupStart = performance.now()
const logTiming = (label: string, start: number) => {
  // biome-ignore lint/suspicious/noConsole: Startup timing logs
  console.log(`[startup] ${label}: ${(performance.now() - start).toFixed(1)}ms`)
}

/**
 * Starts Bun.serve with retry logic for EADDRINUSE errors.
 * Handles ghost PIDs on Windows where the OS needs time to release the port.
 */
async function serveWithRetry<T>(
  options: Parameters<typeof Bun.serve<T>>[0],
  maxRetries = 10,
  delayMs = 1000,
): Promise<ReturnType<typeof Bun.serve<T>>> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return Bun.serve<T>(options)
    } catch (error) {
      const isPortConflict =
        error instanceof Error &&
        (('code' in error &&
          (error as NodeJS.ErrnoException).code === 'EADDRINUSE') ||
          error.message?.includes('Is port'))

      if (isPortConflict && attempt < maxRetries) {
        // biome-ignore lint/suspicious/noConsole: Startup retry logging
        console.log(
          `[startup] Port in use, retrying in ${delayMs}ms... (${attempt}/${maxRetries})`,
        )
        await new Promise((r) => setTimeout(r, delayMs))
        continue
      }
      throw error
    }
  }
  // Unreachable, but TypeScript needs it
  throw new Error('serveWithRetry: exhausted retries')
}

/**
 * A minimal HTTP server that binds the real port BEFORE the heavy boot work
 * (migrations, FTS rebuild, seeding) runs. It exists so two things are true
 * from the very first moment the sidecar process is alive:
 *
 *  1. The desktop shell's `/ping` health check answers immediately, so the
 *     Tauri window paints instead of waiting on a 30s timeout.
 *  2. The client can poll `/health` to render real boot progress — and, if a
 *     migration throws, read the actual failure instead of spinning forever.
 *
 * Every non-health request gets a 503 with the current phase so any code that
 * races ahead of readiness fails loudly rather than hitting a half-built DB.
 * The handle is handed back so `main()` can stop it before the real server
 * binds the same port.
 */
function startBootServer(port: number | string): ReturnType<typeof Bun.serve> {
  const healthResponse = () =>
    new Response(JSON.stringify(getBootHealth()), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })

  return Bun.serve({
    port,
    hostname: '0.0.0.0',
    reusePort: true,
    fetch(req) {
      const url = new URL(req.url)
      if (req.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': '*',
          },
        })
      }
      if (url.pathname === '/health' || url.pathname === '/api/health') {
        return healthResponse()
      }
      if (url.pathname === '/ping' || url.pathname === '/api/ping') {
        return new Response(JSON.stringify({ data: 'pong' }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        })
      }
      // Everything else: the server isn't ready to do real work yet.
      const health = getBootHealth()
      return new Response(
        JSON.stringify({ error: 'Server starting', ...health }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '1',
            'Access-Control-Allow-Origin': '*',
          },
        },
      )
    },
  })
}

/**
 * Waits for a port to become available, retrying up to maxRetries times.
 * Handles ghost PIDs on Windows where the process is gone but the binding lingers.
 */
async function waitForPortAvailable(
  port: number,
  maxRetries = 6,
  delayMs = 500,
): Promise<void> {
  const net = await import('node:net')
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const inUse = await new Promise<boolean>((resolve) => {
      const srv = net.createServer()
      srv.once('error', () => resolve(true))
      srv.once('listening', () => {
        srv.close()
        resolve(false)
      })
      srv.listen(port, '127.0.0.1')
    })
    if (!inUse) return
    // biome-ignore lint/suspicious/noConsole: Startup info
    console.log(
      `[startup] Port ${port} still in use, waiting... (${attempt}/${maxRetries})`,
    )
    await new Promise((r) => setTimeout(r, delayMs))
  }
}

/**
 * Kills any process listening on the specified port
 * Uses execFileSync for safety (no shell interpolation)
 */
function killProcessOnPort(port: number): void {
  const platform = process.platform
  const portStr = String(port)

  try {
    if (platform === 'darwin' || platform === 'linux') {
      // macOS/Linux: Find PID using lsof and kill it
      // Using execFileSync with args array prevents shell injection
      const result = execFileSync('lsof', ['-ti', `:${portStr}`], {
        encoding: 'utf-8',
      }).trim()
      if (result) {
        const pids = result.split('\n').filter(Boolean)
        for (const pid of pids) {
          if (/^\d+$/.test(pid)) {
            try {
              execFileSync('kill', ['-9', pid])
              // biome-ignore lint/suspicious/noConsole: Startup info
              console.log(`[startup] Killed process ${pid} on port ${portStr}`)
            } catch {
              // Process might have already exited
            }
          }
        }
      }
    } else if (platform === 'win32') {
      // Windows: Find PID using netstat and kill with taskkill
      // Note: netstat requires shell piping, but we sanitize the port number
      const result = execSync(
        `netstat -ano | findstr :${portStr} | findstr LISTENING`,
        { encoding: 'utf-8' },
      ).trim()
      if (result) {
        const lines = result.split('\n').filter(Boolean)
        const pids = new Set<string>()
        for (const line of lines) {
          const parts = line.trim().split(/\s+/)
          const pid = parts[parts.length - 1]
          if (pid && /^\d+$/.test(pid)) {
            pids.add(pid)
          }
        }
        for (const pid of pids) {
          try {
            execFileSync('taskkill', ['/F', '/PID', pid])
            // biome-ignore lint/suspicious/noConsole: Startup info
            console.log(`[startup] Killed process ${pid} on port ${portStr}`)
          } catch {
            // Process might have already exited
          }
        }
      }
    }
  } catch {
    // No process found on port or command failed - that's fine
  }
}

async function main() {
  // biome-ignore lint/suspicious/noConsole: Startup timing logs
  console.log('[startup] === Server Starting ===')

  // Kill any existing process on the server port and wait for it to be free
  const serverPort = Number(process.env['PORT']) || 3000
  killProcessOnPort(serverPort)
  await waitForPortAvailable(serverPort)

  // Bind the port immediately with a minimal boot server so the shell's
  // /ping check answers right away (no blank-screen wait) and the client can
  // poll /health for real boot progress while the heavy init below runs. If
  // any init step throws, the boot server stays up reporting the failure via
  // /health instead of the process dying silently into an endless spinner.
  const bootServer = startBootServer(serverPort)
  // biome-ignore lint/suspicious/noConsole: Startup logging
  console.log(
    `[startup] Boot server listening on ${serverPort} — serving /health while initializing`,
  )

  let t = performance.now()
  let bootPhase: BootPhase = 'starting'
  try {
    // Initialize database (Drizzle ORM wrapper) and run migrations
    bootPhase = 'migrating'
    setBootPhase('migrating')
    t = performance.now()
    await initializeDatabase()
    logTiming('database_init', t)

    bootPhase = 'indexing'
    setBootPhase('indexing')
    await runFtsRebuild()

    bootPhase = 'finalizing'
    setBootPhase('finalizing')
    await runFinalizeBoot()
  } catch (bootErr) {
    // Surface the failure to PostHog + log file and keep the boot server up so
    // the client reads the real reason from /health (with a report action)
    // rather than spinning forever. Do NOT exit: a hard exit would leave the
    // shell with a connection-refused loop and no diagnostics.
    setBootFailed(bootPhase, bootErr)
    return
  }

  // Heavy init done — hand the port off from the boot server to the real one.
  // Await the stop so the socket is fully released before we rebind (serveWithRetry
  // also retries EADDRINUSE as a belt-and-braces guard against a lingering bind).
  await bootServer.stop(true)

  await startRealServer()

  // Start the automatic Google Drive backup scheduler (no-op unless enabled).
  startBackupScheduler()
}

/**
 * Rebuilds the full-text search indexes when they're out of sync with their
 * source tables. Extracted from {@link main} so boot failures can be attributed
 * to the `indexing` phase. Individual rebuild errors are non-fatal (logged) so a
 * single corrupt index doesn't block the whole server from coming up.
 */
async function runFtsRebuild(): Promise<void> {
  // Rebuild FTS indexes BEFORE the HTTP server accepts requests so
  // search never returns empty results during a partial-rebuild window
  // and a previous-launch crash mid-rebuild can't leave the indexes
  // permanently broken (the createFtsTables 'already exist' fast path
  // made that a one-way trap before).
  //
  // To stay fast on subsequent boots we skip the full rebuild when the
  // source-table row count already matches the FTS row count — a sub-
  // millisecond check that's correct for our content schemas (songs,
  // schedules: one FTS row per source row; bible_verses: external-
  // content FTS5 reports source count after a successful rebuild). A
  // mismatch (fresh install, partial seed, schema drift) still
  // triggers the full rebuild.
  let t = performance.now()
  try {
    const rawDb = getRawDatabase()
    const count = (sql: string): number => {
      try {
        return Number(
          (rawDb.query<{ c: number }, []>(sql).get()?.c ?? 0) as number,
        )
      } catch {
        return -1
      }
    }
    const songsCount = count('SELECT COUNT(*) AS c FROM songs')
    const songsFtsCount = count('SELECT COUNT(*) AS c FROM songs_fts')
    if (songsFtsCount !== songsCount) {
      // biome-ignore lint/suspicious/noConsole: Startup timing logs
      console.log(
        `[startup] songs FTS out of sync (${songsFtsCount}/${songsCount}) — rebuilding`,
      )
      rebuildSearchIndex()
    }
    const schedulesCount = count('SELECT COUNT(*) AS c FROM schedules')
    const schedulesFtsCount = count('SELECT COUNT(*) AS c FROM schedules_fts')
    if (schedulesFtsCount !== schedulesCount) {
      // biome-ignore lint/suspicious/noConsole: Startup timing logs
      console.log(
        `[startup] schedules FTS out of sync (${schedulesFtsCount}/${schedulesCount}) — rebuilding`,
      )
      rebuildScheduleSearchIndex()
    }
    const versesCount = count('SELECT COUNT(*) AS c FROM bible_verses')
    const versesFtsCount = count('SELECT COUNT(*) AS c FROM bible_verses_fts')
    if (versesFtsCount !== versesCount) {
      // biome-ignore lint/suspicious/noConsole: Startup timing logs
      console.log(
        `[startup] bible FTS out of sync (${versesFtsCount}/${versesCount}) — rebuilding`,
      )
      rebuildBibleSearchIndex()
    }
  } catch (rebuildError) {
    // biome-ignore lint/suspicious/noConsole: startup error logging
    console.error('[startup] FTS rebuild failed:', rebuildError)
  }
  logTiming('fts_rebuild', t)
}

/**
 * Final pre-serve work: warm the FTS caches, reset presentation state, ensure a
 * fallback Bible exists, mint the system token and wire OBS callbacks. Extracted
 * from {@link main} so a throw here is attributed to the `finalizing` phase.
 */
async function runFinalizeBoot(): Promise<void> {
  // Warm up FTS indexes so first user search is fast (loads index pages from disk into OS cache)
  let t = performance.now()
  warmupBibleSearchIndex()
  warmupSongsSearchIndex()
  logTiming('fts_warmup', t)

  // Clear the displayed slide on startup to ensure a clean state
  t = performance.now()
  stopPresentation()
  logTiming('clear_presentation', t)

  // Seed RCCV Bible translation if no translations exist (fallback if fixtures weren't loaded)
  t = performance.now()
  await ensureRCCVExists()
  logTiming('ensure_rccv_exists', t)

  // Initialize system API token
  t = performance.now()
  const { token: systemToken, isNew: isNewToken } =
    await getOrCreateSystemToken()
  logTiming('init_system_token', t)
  if (isNewToken && systemToken) {
    // biome-ignore lint/suspicious/noConsole: Important system message that must be displayed
    console.log('========================================')
    // biome-ignore lint/suspicious/noConsole: Important system message that must be displayed
    console.log('SYSTEM API TOKEN GENERATED')
    // biome-ignore lint/suspicious/noConsole: Important system message that must be displayed
    console.log('Save this token - it will only be shown once:')
    // biome-ignore lint/suspicious/noConsole: Important system message that must be displayed
    console.log(systemToken)
    // biome-ignore lint/suspicious/noConsole: Important system message that must be displayed
    console.log('========================================')
  }

  // Wire up OBS callbacks to WebSocket broadcasts
  t = performance.now()
  initializeOBSCallbacks()
  logTiming('init_obs_callbacks', t)
}

/**
 * Binds the full application server (all API routes, WebSocket, MIDI/OBS/music
 * wiring) on the real port and flips boot state to `ready`. Runs only after the
 * boot server has been stopped, so there's no double-bind on the port.
 */
async function startRealServer(): Promise<void> {
  // Note: MIDI initialization is deferred to after server starts

  const isProd = process.env.NODE_ENV === 'production'

  // Client serving configuration
  // In production: serve static files from bundled client dist
  // In development: proxy to Vite dev server
  const clientDistPath = process.env['CLIENT_DIST_PATH']
  const canServeStaticFiles =
    isProd && clientDistPath && existsSync(clientDistPath)
  const shouldProxyToVite = !isProd

  if (canServeStaticFiles) {
    // biome-ignore lint/suspicious/noConsole: Startup logging
    console.log(`[server] Serving client from: ${clientDistPath}`)
  } else if (shouldProxyToVite) {
    // biome-ignore lint/suspicious/noConsole: Startup logging
    console.log(
      `[server] Proxying client requests to Vite dev server (port ${process.env['VITE_DEV_PORT'] ?? '8086'})`,
    )
  }

  // biome-ignore lint/suspicious/noConsole: Startup logging
  console.log('[server] Starting with simple auth (localhost = admin)')

  let t = performance.now()

  const logger = createLogger('BibleAPI')

  function handleCors(req: Request, res: Response) {
    // Allow any origin - this app is designed for LAN use
    // Reflect the origin header if present, otherwise allow all
    const origin = req.headers.get('Origin') || '*'
    res.headers.set('Access-Control-Allow-Origin', origin)
    res.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    )
    // When credentials are allowed, wildcard (*) doesn't work for headers
    // Must explicitly list all allowed headers
    res.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Cookie, X-User-Auth, Accept, Origin, X-Requested-With, Cache-Control, Pragma',
    )
    res.headers.set('Access-Control-Allow-Credentials', 'true')
    res.headers.set('Access-Control-Max-Age', '86400')

    // Persist every failed response (4xx/5xx) to the on-disk log so the Logs
    // viewer and bug reports surface what went wrong (permission denials,
    // validation errors, server crashes) — not just unhandled exceptions.
    if (res.status >= 400) {
      const { pathname } = new URL(req.url)
      logToFile(
        'http',
        res.status >= 500 ? 'error' : 'warn',
        `${req.method} ${pathname} → ${res.status}`,
      )
    }

    return res
  }

  // Global error handlers to catch unhandled errors. reportError writes to
  // BOTH the on-disk log and PostHog so a fatal is never console-only.
  process.on('uncaughtException', (error) => {
    // biome-ignore lint/suspicious/noConsole: error logging
    console.error('[FATAL] Uncaught Exception:', error)
    reportError(error, 'uncaughtException')
  })
  process.on('unhandledRejection', (reason) => {
    // biome-ignore lint/suspicious/noConsole: error logging
    console.error('[FATAL] Unhandled Promise Rejection:', reason)
    reportError(reason, 'unhandledRejection')
  })

  const server = await serveWithRetry<WebSocketData>({
    port: process.env['PORT'] ?? 3000,
    hostname: '0.0.0.0',
    reusePort: true,
    error(error) {
      // biome-ignore lint/suspicious/noConsole: error logging
      console.error('[SERVER ERROR] Fetch handler error:', error)

      reportError(error, 'fetch-error-handler')

      return new Response(
        JSON.stringify({
          error:
            error instanceof Error ? error.message : 'Internal server error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    },
    async fetch(req: Request, server) {
      const requestStartTime = performance.now()
      logRequest(req)

      if (req.method === 'OPTIONS') {
        logResponse(req, 204, requestStartTime)
        return handleCors(req, new Response(null, { status: 204 }))
      }

      const url = new URL(req.url)

      // WebSocket upgrade for /ws endpoint
      if (url.pathname === '/ws') {
        const success = server.upgrade(req, {
          data: { clientId: '' },
        })

        if (success) {
          return undefined as unknown as Response
        }

        return new Response('WebSocket upgrade failed', { status: 400 })
      }
      let _context: RequestContext | null = null

      // User authentication endpoint (public - sets cookie for remote users)
      const userAuthMatch = url.pathname.match(/^\/api\/auth\/user\/([^/]+)$/)
      if (req.method === 'GET' && userAuthMatch?.[1]) {
        const token = decodeURIComponent(userAuthMatch[1])
        const user = await getUserByToken(token)

        if (!user || !user.isActive) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({
                error: 'Invalid or inactive user token',
              }),
              {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }

        // Redirect to frontend using the same host the user accessed from
        // Always use port 3000 - both dev and prod serve client from this port
        const host = req.headers.get('host')?.split(':')[0] ?? 'localhost'
        const frontendPort = process.env['PORT'] ?? 3000
        const frontendUrl = `http://${host}:${frontendPort}/`

        // Redirect to frontend app with cookie set. Cookie attributes are
        // engine-aware — see buildUserAuthCookie.
        const response = new Response(null, {
          status: 302,
          headers: {
            Location: frontendUrl,
            'Set-Cookie': buildUserAuthCookie(req, token, 31536000),
          },
        })

        return handleCors(req, response)
      }

      // OpenAPI documentation endpoints (public)
      if (url.pathname === '/api/docs') {
        return handleCors(req, getScalarDocs())
      }
      if (url.pathname === '/api/openapi.json') {
        const host = req.headers.get('host') ?? undefined
        return handleCors(req, getOpenApiSpec(host))
      }

      // ============================================================
      // Local login endpoints (PUBLIC — reachable before authentication so
      // the login screen can list users and establish a session).
      // ============================================================

      // Builds the user_auth Set-Cookie header value. Attributes are
      // engine-aware (WebKit drops `Secure` over plain http) — see
      // buildUserAuthCookie in middleware/auth.ts.
      const buildAuthCookie = (token: string, maxAgeSeconds: number): string =>
        buildUserAuthCookie(req, token, maxAgeSeconds)

      // GET /api/auth/local-users - minimal user list for the login picker
      if (req.method === 'GET' && url.pathname === '/api/auth/local-users') {
        return handleCors(
          req,
          new Response(JSON.stringify({ data: getLocalUsers() }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/auth/login - verify credentials and set the auth cookie
      if (req.method === 'POST' && url.pathname === '/api/auth/login') {
        try {
          const body = (await req.json()) as {
            userId?: number
            password?: string
          }
          if (typeof body.userId !== 'number') {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing userId' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const result = await verifyLogin(
            body.userId,
            body.password,
            isLocalhost(req),
          )
          if (!result) {
            authLogger.warn('Login failed: invalid credentials', {
              userId: body.userId,
              localhost: isLocalhost(req),
            })
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Invalid credentials' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const user = getUserById(body.userId)
          const currentUser = user
            ? {
                id: user.id,
                name: user.name,
                isApp: user.isSuperAdmin,
                permissions: user.isSuperAdmin
                  ? ALL_PERMISSIONS
                  : user.permissions,
              }
            : null

          authLogger.info('Login success', {
            userId: user?.id ?? body.userId,
            userName: user?.name,
            localhost: isLocalhost(req),
          })

          // Also issue a one-time ticket so the client can finalize the switch
          // via a top-level navigation (reliable cookie overwrite on desktop).
          const ticket = createLoginTicket(result.token)

          // On localhost (the packaged desktop app) the cross-site `Secure`
          // cookie can't be stored by macOS WKWebView, so also return the token
          // in the body; the desktop client persists it and sends it back as an
          // `X-User-Auth` header. Remote/LAN clients (same-origin cookie works)
          // never receive it.
          const token = isLocalhost(req) ? result.token : undefined

          return handleCors(
            req,
            new Response(JSON.stringify({ data: currentUser, ticket, token }), {
              headers: {
                'Content-Type': 'application/json',
                'Set-Cookie': buildAuthCookie(result.token, 31536000),
              },
            }),
          )
        } catch (_error) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // GET /api/auth/login-redirect/:ticket - finalize a login via top-level
      // navigation. Sets the session cookie on a 302 response (overwrites
      // reliably in every webview) and redirects back to the app.
      const loginRedirectMatch = url.pathname.match(
        /^\/api\/auth\/login-redirect\/([^/]+)$/,
      )
      if (req.method === 'GET' && loginRedirectMatch?.[1]) {
        const host = req.headers.get('host')?.split(':')[0] ?? 'localhost'
        const frontendPort = process.env['PORT'] ?? 3000
        const fallbackHost = `${host}:${frontendPort}`
        const token = consumeLoginTicket(
          decodeURIComponent(loginRedirectMatch[1]),
        )
        const location = resolveReturnUrl(
          url.searchParams.get('return'),
          fallbackHost,
        )

        if (!token) {
          // Expired/invalid ticket — just go back to the app (still signed in
          // as whoever the current cookie is).
          authLogger.warn('Account switch failed: expired/invalid ticket')
          return handleCors(
            req,
            new Response(null, {
              status: 302,
              headers: { Location: location },
            }),
          )
        }

        const switchedUser = await getUserByToken(token)
        authLogger.info('Account switch', {
          userId: switchedUser?.id ?? null,
          userName: switchedUser?.name ?? null,
        })

        return handleCors(
          req,
          new Response(null, {
            status: 302,
            headers: {
              Location: location,
              'Set-Cookie': buildAuthCookie(token, 31536000),
            },
          }),
        )
      }

      // POST /api/auth/logout - clear the auth cookie
      if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
        // Resolve who is logging out (from the current cookie) before clearing,
        // so the auth trail records the user.
        const logoutAuth = await combinedAuthMiddleware(req)
        const logoutUser = logoutAuth.context?.userId
          ? getUserById(logoutAuth.context.userId)
          : null
        authLogger.info('Logout', {
          userId: logoutUser?.id ?? null,
          userName: logoutUser?.name ?? null,
        })
        return handleCors(
          req,
          new Response(JSON.stringify({ data: { success: true } }), {
            headers: {
              'Content-Type': 'application/json',
              'Set-Cookie': buildAuthCookie('', 0),
            },
          }),
        )
      }

      // GET /api/auth/logout-redirect - clear the session via top-level
      // navigation. Like login-redirect, clearing the cookie on a 302 response
      // reliably applies in the desktop (Tauri) webview where a cross-origin
      // `fetch` Set-Cookie may not.
      if (
        req.method === 'GET' &&
        url.pathname === '/api/auth/logout-redirect'
      ) {
        const host = req.headers.get('host')?.split(':')[0] ?? 'localhost'
        const frontendPort = process.env['PORT'] ?? 3000
        const location = resolveReturnUrl(
          url.searchParams.get('return'),
          `${host}:${frontendPort}`,
        )
        return handleCors(
          req,
          new Response(null, {
            status: 302,
            headers: {
              Location: location,
              'Set-Cookie': buildAuthCookie('', 0),
            },
          }),
        )
      }

      // GET /api/auth/me - current session (PUBLIC: returns null when signed out
      // so the client can decide whether to show the login screen)
      if (req.method === 'GET' && url.pathname === '/api/auth/me') {
        const authResult = await combinedAuthMiddleware(req)

        // System token (no userId) → generic app/admin identity
        if (
          authResult.context?.authType === 'app' &&
          !authResult.context.userId
        ) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({
                data: {
                  id: 0,
                  name: 'System',
                  isApp: true,
                  permissions: ALL_PERMISSIONS,
                },
              }),
              { headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }

        if (authResult.context?.userId) {
          const user = getUserById(authResult.context.userId)
          if (user) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({
                  data: {
                    id: user.id,
                    name: user.name,
                    isApp: user.isSuperAdmin,
                    permissions: user.isSuperAdmin
                      ? ALL_PERMISSIONS
                      : user.permissions,
                  },
                }),
                { headers: { 'Content-Type': 'application/json' } },
              ),
            )
          }
        }

        // Not authenticated — report null rather than 401 so the client knows
        // the server is reachable but a login is required.
        return handleCors(
          req,
          new Response(JSON.stringify({ data: null }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/client-errors (PUBLIC) — ingest browser/client errors so they
      // land in the SAME on-disk log as the server + Tauri (the client can't
      // write to disk itself). Public + pre-auth on purpose: client errors can
      // happen before login or when auth itself is broken. The browser already
      // sends $exception to PostHog directly; here we also emit a lightweight
      // `client_error` event as redundancy (PostHog may be blocked/offline in
      // the webview, and it's disabled on /screen/* routes).
      if (req.method === 'POST' && url.pathname === '/api/client-errors') {
        try {
          const body = (await req.json()) as {
            errors?: Array<{
              message?: string
              stack?: string
              level?: string
              source?: string
              context?: Record<string, unknown>
            }>
          }
          const errors = Array.isArray(body?.errors)
            ? body.errors.slice(0, 50)
            : []
          const trunc = (s: unknown, max: number): string =>
            typeof s === 'string' ? s.slice(0, max) : ''
          for (const e of errors) {
            const message = trunc(e?.message, 2000) || 'unknown client error'
            const level = e?.level === 'warning' ? 'warn' : 'error'
            const data = {
              stack: trunc(e?.stack, 8000) || undefined,
              client_source: trunc(e?.source, 200) || undefined,
              ...(e?.context ?? {}),
            }
            logToFile('client', level, message, data)
            captureMessageServer(
              message,
              level === 'warn' ? 'warning' : 'error',
              { source: 'client', ...data },
            )
          }
          return handleCors(
            req,
            new Response(
              JSON.stringify({ data: { received: errors.length } }),
              {
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        } catch {
          return handleCors(
            req,
            new Response(
              JSON.stringify({ error: 'Invalid client error body' }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // POST /api/client-activity (PUBLIC) — ingest client-side user activity
      // (navigation, login/logout clicks, key actions) into the SAME on-disk
      // log under the `activity` category, so the Logs viewer shows what the
      // operator did leading up to an error. Public + pre-auth on purpose:
      // activity (e.g. the login screen) happens before a session exists.
      if (req.method === 'POST' && url.pathname === '/api/client-activity') {
        try {
          const body = (await req.json()) as {
            events?: Array<{
              action?: string
              message?: string
              source?: string
              context?: Record<string, unknown>
            }>
          }
          const events = Array.isArray(body?.events)
            ? body.events.slice(0, 100)
            : []
          const trunc = (s: unknown, max: number): string =>
            typeof s === 'string' ? s.slice(0, max) : ''
          for (const e of events) {
            const action = trunc(e?.action, 200) || 'action'
            const message = trunc(e?.message, 2000) || action
            const data = {
              action,
              client_source: trunc(e?.source, 200) || undefined,
              ...(e?.context ?? {}),
            }
            logToFile('activity', 'info', message, data)
          }
          return handleCors(
            req,
            new Response(
              JSON.stringify({ data: { received: events.length } }),
              { headers: { 'Content-Type': 'application/json' } },
            ),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid activity body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // All other /api/* routes require authentication
      if (url.pathname.startsWith('/api/')) {
        const authResult = await combinedAuthMiddleware(req)
        if (authResult.response) return handleCors(req, authResult.response)
        _context = authResult.context
      }
      if (url.pathname === '/ping' || url.pathname === '/api/ping') {
        return handleCors(req, new Response(JSON.stringify({ data: 'pong' })))
      }

      // Boot health — mirrors the boot server's /health so the client polls one
      // stable endpoint across the boot→ready handoff. On the real server this
      // always reports `ready:true`.
      if (url.pathname === '/health' || url.pathname === '/api/health') {
        return handleCors(
          req,
          new Response(JSON.stringify(getBootHealth()), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // Settings API endpoints
      // GET /api/settings/:table/:key - Get a setting by key
      const getSettingMatch = url.pathname.match(
        /^\/api\/settings\/([^/]+)\/([^/]+)$/,
      )
      if (req.method === 'GET' && getSettingMatch?.[1] && getSettingMatch[2]) {
        const table = getSettingMatch[1] as SettingsTable
        const key = getSettingMatch[2]

        // Per-key permission: some app settings belong to a feature (or to the
        // shared navigation shell) rather than to general Settings, so gating
        // them by `settings.view` would wrongly lock out feature-only users.
        //  - sidebar_configuration: drives the nav shell for EVERY user (e.g.
        //    whether Feedback is hidden) → readable by any authenticated user.
        //  - selected/default bible translation: needed to render the Bible
        //    page → gated by `bible.view`, not `settings.view`.
        const isSidebarConfig =
          table === 'app_settings' && key === 'sidebar_configuration'
        const isBibleSelection =
          table === 'app_settings' &&
          (key === 'selected_bible_translations' ||
            key === 'default_bible_translation')
        // Resizable-divider positions (`divider.*`) are personal layout prefs,
        // not general Settings — every authenticated user reads their own page
        // layout, so gating them by `settings.view` would wrongly lock out
        // feature-only users.
        const isLayoutDivider =
          table === 'app_settings' && key.startsWith('divider.')
        if (isSidebarConfig || isLayoutDivider) {
          // Readable by any authenticated user.
        } else if (isBibleSelection) {
          const permError = checkPermission('bible.view')
          if (permError) return permError
        } else {
          const permError = checkPermission('settings.view')
          if (permError) return permError
        }

        const setting = getSetting(table, key)

        return handleCors(
          req,
          new Response(JSON.stringify({ data: setting ?? null }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/settings/:table - Get all settings from a table
      const getAllSettingsMatch = url.pathname.match(
        /^\/api\/settings\/([^/]+)$/,
      )
      if (req.method === 'GET' && getAllSettingsMatch) {
        const permError = checkPermission('settings.view')
        if (permError) return permError

        const table = getAllSettingsMatch[1] as SettingsTable
        const settings = getAllSettings(table)

        return handleCors(
          req,
          new Response(JSON.stringify({ data: settings }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/settings/:table - Upsert a setting
      if (
        req.method === 'POST' &&
        url.pathname.match(/^\/api\/settings\/([^/]+)$/)
      ) {
        const tableMatch = url.pathname.match(/^\/api\/settings\/([^/]+)$/)
        const table = tableMatch![1] as SettingsTable

        try {
          const body = (await req.json()) as { key: string; value: string }

          if (!body.key || !body.value) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing key or value' }), {
                status: 400,
              }),
            )
          }

          // Choosing which Bible translation to read is part of viewing the
          // Bible, so it's gated by `bible.view` rather than `settings.edit`.
          const isBibleSelection =
            table === 'app_settings' &&
            (body.key === 'selected_bible_translations' ||
              body.key === 'default_bible_translation')
          // Theme/language (Appearance) can be edited with full edit OR the
          // granular appearance-edit permission, so an operator can be allowed
          // to change just their look & feel.
          const isAppearance =
            table === 'app_settings' &&
            (body.key === 'theme' || body.key === 'language')
          // Resizable-divider positions (`divider.*`) are personal layout prefs
          // any authenticated user may persist — no extra permission required.
          const isLayoutDivider =
            table === 'app_settings' && body.key.startsWith('divider.')

          let permError: Response | null
          if (isBibleSelection) {
            permError = checkPermission('bible.view')
          } else if (isLayoutDivider) {
            permError = null
          } else if (isAppearance) {
            const denied = _context
              ? requireAnyPermission([
                  'settings.edit',
                  'settings.edit_appearance',
                ])(_context)
              : new Response(JSON.stringify({ error: 'Unauthorized' }), {
                  status: 401,
                  headers: { 'Content-Type': 'application/json' },
                })
            permError = denied ? handleCors(req, denied) : null
          } else {
            permError = checkPermission('settings.edit')
          }
          if (permError) return permError

          const result = upsertSetting(table, {
            key: body.key,
            value: body.value,
          })

          if (!result.success) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: result.error }), {
                status: 500,
              }),
            )
          }

          // Broadcast settings update via WebSocket
          broadcastSettingsUpdated(table, body.key)

          // Reload MIDI shortcuts if keyboard shortcuts or sidebar config were updated
          if (
            table === 'app_settings' &&
            (body.key === 'global_keyboard_shortcuts' ||
              body.key === 'sidebar_configuration')
          ) {
            loadMIDIShortcuts()
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: result }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch (_error) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
            }),
          )
        }
      }

      // DELETE /api/settings/:table/:key - Delete a setting
      const deleteSettingMatch = url.pathname.match(
        /^\/api\/settings\/([^/]+)\/([^/]+)$/,
      )
      if (
        req.method === 'DELETE' &&
        deleteSettingMatch?.[1] &&
        deleteSettingMatch[2]
      ) {
        const permError = checkPermission('settings.edit')
        if (permError) return permError

        const table = deleteSettingMatch[1] as SettingsTable
        const key = deleteSettingMatch[2]

        const result = deleteSetting(table, key)

        if (!result.success) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: result.error }), {
              status: 404,
            }),
          )
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ data: result }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // ============================================================
      // Device Management API Endpoints (Admin only - app auth required)
      // ============================================================

      // Helper function to check app-only auth. Enforced in every environment:
      // identity comes from the session cookie (super admin) or a system token,
      // so dev and prod behave the same now that localhost is not auto-admin.
      async function requireAppAuth(): Promise<Response | null> {
        const authResult = await appOnlyAuthMiddleware(req)
        if (authResult.response) return handleCors(req, authResult.response)
        return null
      }

      // Helper function to check user permissions
      function checkPermission(permission: Permission): Response | null {
        if (!_context) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Unauthorized' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
        const result = requirePermission(permission)(_context)
        if (result) return handleCors(req, result)
        return null
      }

      // GET /api/roles - List all roles
      if (req.method === 'GET' && url.pathname === '/api/roles') {
        const authError = await requireAppAuth()
        if (authError) return authError

        const roles = getAllRoles()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: roles }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // Strict localhost check (no system token allowed)
      function isStrictLocalhost(): boolean {
        const host = req.headers.get('Host')
        if (!host) return true
        const hostname = host.split(':')[0].toLowerCase()
        return (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname === '::1' ||
          hostname.startsWith('127.')
        )
      }

      // GET /api/system-token - Get system token (localhost only)
      if (req.method === 'GET' && url.pathname === '/api/system-token') {
        if (!isStrictLocalhost()) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({ error: 'Only accessible from localhost' }),
              { status: 403, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }

        const tokenInfo = getSystemToken()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: tokenInfo }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/system-token/regenerate - Regenerate system token (localhost only)
      if (
        req.method === 'POST' &&
        url.pathname === '/api/system-token/regenerate'
      ) {
        if (!isStrictLocalhost()) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({ error: 'Only accessible from localhost' }),
              { status: 403, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }

        const newToken = await regenerateSystemToken()
        return handleCors(
          req,
          new Response(
            JSON.stringify({
              data: { token: newToken },
              message: 'System token regenerated successfully',
            }),
            { headers: { 'Content-Type': 'application/json' } },
          ),
        )
      }

      // GET /api/database/info - Get database info (localhost only)
      if (req.method === 'GET' && url.pathname === '/api/database/info') {
        if (!isStrictLocalhost()) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({ error: 'Only accessible from localhost' }),
              { status: 403, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }

        const info = await getDatabaseInfo()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: info }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/database/export - Export database (localhost only)
      if (req.method === 'POST' && url.pathname === '/api/database/export') {
        if (!isStrictLocalhost()) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({ error: 'Only accessible from localhost' }),
              { status: 403, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }

        const body = (await req.json()) as { destinationPath: string }
        if (!body.destinationPath) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({ error: 'destinationPath is required' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }

        const result = await checkpointAndExport(body.destinationPath)
        if (!result.success) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: result.error }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ data: result }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/database/import - Import database (localhost only)
      if (req.method === 'POST' && url.pathname === '/api/database/import') {
        if (!isStrictLocalhost()) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({ error: 'Only accessible from localhost' }),
              { status: 403, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }

        const body = (await req.json()) as {
          sourcePath: string
          options?: ImportOptions
        }
        if (!body.sourcePath) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'sourcePath is required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        // If options provided, use selective import; otherwise full import
        const result = body.options
          ? await selectiveImportDatabase(body.sourcePath, body.options)
          : await importDatabase(body.sourcePath)

        if (!result.success) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: result.error }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ data: result }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/database/factory-reset - Factory reset (localhost only)
      if (
        req.method === 'POST' &&
        url.pathname === '/api/database/factory-reset'
      ) {
        if (!isStrictLocalhost()) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({ error: 'Only accessible from localhost' }),
              { status: 403, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }

        // Parse optional options from request body
        let options: { includeBibles?: boolean; includeSongs?: boolean } = {}
        try {
          const body = await req.json()
          if (typeof body.includeBibles === 'boolean') {
            options.includeBibles = body.includeBibles
          }
          if (typeof body.includeSongs === 'boolean') {
            options.includeSongs = body.includeSongs
          }
        } catch {
          // No body or invalid JSON - use defaults
        }

        const result = performFactoryReset(options)
        if (!result.success) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: result.error }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ data: result }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/database/rebuild-search-indexes - Rebuild FTS search indexes (localhost only)
      if (
        req.method === 'POST' &&
        url.pathname === '/api/database/rebuild-search-indexes'
      ) {
        if (!isStrictLocalhost()) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({ error: 'Only accessible from localhost' }),
              { status: 403, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }

        // Parse optional options from request body
        let options: {
          songs?: boolean
          schedules?: boolean
          bible?: boolean
        } = {}
        try {
          const body = await req.json()
          if (typeof body.songs === 'boolean') options.songs = body.songs
          if (typeof body.schedules === 'boolean')
            options.schedules = body.schedules
          if (typeof body.bible === 'boolean') options.bible = body.bible
        } catch {
          // No body or invalid JSON - rebuild all by default
        }

        // If no specific options provided, rebuild all
        const rebuildAll =
          options.songs === undefined &&
          options.schedules === undefined &&
          options.bible === undefined
        const rebuildSongs = rebuildAll || options.songs === true
        const rebuildSchedules = rebuildAll || options.schedules === true
        const rebuildBible = rebuildAll || options.bible === true

        try {
          const startTime = performance.now()
          const rebuiltIndexes: string[] = []

          if (rebuildSongs) {
            rebuildSearchIndex()
            rebuiltIndexes.push('songs')
          }
          if (rebuildSchedules) {
            rebuildScheduleSearchIndex()
            rebuiltIndexes.push('schedules')
          }
          if (rebuildBible) {
            rebuildBibleSearchIndex()
            rebuiltIndexes.push('bible')
          }

          const duration = performance.now() - startTime

          // biome-ignore lint/suspicious/noConsole: performance logging
          console.log(
            `[INFO] [search-rebuild] FTS indexes rebuilt (${rebuiltIndexes.join(', ')}) in ${duration.toFixed(2)}ms`,
          )

          return handleCors(
            req,
            new Response(
              JSON.stringify({
                data: {
                  success: true,
                  duration: Math.round(duration),
                  indexes: rebuiltIndexes,
                },
              }),
              {
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          return handleCors(
            req,
            new Response(
              JSON.stringify({ error: `Search index rebuild failed: ${msg}` }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // ---- Google Drive backup routes (localhost only) ----
      // Reuses isStrictLocalhost() so, like /api/database/*, backups are only
      // driven from the physically-trusted machine running the desktop app.
      const backupLocalhostGuard = (): Response | null =>
        isStrictLocalhost()
          ? null
          : handleCors(
              req,
              new Response(
                JSON.stringify({ error: 'Only accessible from localhost' }),
                {
                  status: 403,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )

      // GET /api/backup/status - Drive connection + auto-backup settings
      if (req.method === 'GET' && url.pathname === '/api/backup/status') {
        const guard = backupLocalhostGuard()
        if (guard) return guard

        const status = await getBackupStatus()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: status }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/backup/list - List backups stored in Google Drive
      if (req.method === 'GET' && url.pathname === '/api/backup/list') {
        const guard = backupLocalhostGuard()
        if (guard) return guard

        const result = await listBackups()
        if (!result.success) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({
                error: result.error,
                requiresReconnect: result.requiresReconnect ?? false,
              }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
        return handleCors(
          req,
          new Response(JSON.stringify({ data: { backups: result.backups } }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/backup/now - Upload a fresh backup to Google Drive
      if (req.method === 'POST' && url.pathname === '/api/backup/now') {
        const guard = backupLocalhostGuard()
        if (guard) return guard

        const result = await uploadBackup()
        if (!result.success) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({
                error: result.error,
                requiresReconnect: result.requiresReconnect ?? false,
              }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
        await upsertBackupConfig({ lastBackupAt: Date.now() })
        return handleCors(
          req,
          new Response(
            JSON.stringify({
              data: {
                fileId: result.fileId,
                fileName: result.fileName,
                backup: result.backup,
              },
            }),
            { headers: { 'Content-Type': 'application/json' } },
          ),
        )
      }

      // POST /api/backup/restore - Restore a backup from Google Drive
      if (req.method === 'POST' && url.pathname === '/api/backup/restore') {
        const guard = backupLocalhostGuard()
        if (guard) return guard

        let fileId: string | undefined
        try {
          const body = await req.json()
          fileId = body.fileId
        } catch {
          // handled below
        }
        if (!fileId) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Missing fileId' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        const result = await restoreBackup(fileId)
        if (!result.success) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({
                error: result.error || result.message,
                requiresReconnect: result.requiresReconnect ?? false,
              }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
        return handleCors(
          req,
          new Response(
            JSON.stringify({
              data: {
                success: true,
                message: result.message,
                requiresRestart: result.requiresRestart,
              },
            }),
            { headers: { 'Content-Type': 'application/json' } },
          ),
        )
      }

      // POST /api/backup/delete - Delete a single backup from Google Drive
      if (req.method === 'POST' && url.pathname === '/api/backup/delete') {
        const guard = backupLocalhostGuard()
        if (guard) return guard

        let fileId: string | undefined
        try {
          const body = await req.json()
          fileId = body.fileId
        } catch {
          // handled below
        }
        if (!fileId) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Missing fileId' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        const result = await deleteBackup(fileId)
        if (!result.success) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({
                error: result.error,
                requiresReconnect: result.requiresReconnect ?? false,
              }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
        return handleCors(
          req,
          new Response(JSON.stringify({ data: { success: true } }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/backup/config - Read auto-backup settings
      if (req.method === 'GET' && url.pathname === '/api/backup/config') {
        const guard = backupLocalhostGuard()
        if (guard) return guard

        const config = await getBackupConfig()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: config }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // PUT /api/backup/config - Update auto-backup settings
      if (req.method === 'PUT' && url.pathname === '/api/backup/config') {
        const guard = backupLocalhostGuard()
        if (guard) return guard

        let patch: {
          autoBackupEnabled?: boolean
          intervalHours?: number
        } = {}
        try {
          const body = await req.json()
          if (typeof body.autoBackupEnabled === 'boolean') {
            patch.autoBackupEnabled = body.autoBackupEnabled
          }
          if (
            typeof body.intervalHours === 'number' &&
            body.intervalHours > 0
          ) {
            patch.intervalHours = Math.round(body.intervalHours)
          }
        } catch {
          // No/invalid body - nothing to update
        }

        const config = await upsertBackupConfig(patch)
        return handleCors(
          req,
          new Response(JSON.stringify({ data: config }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/backup/google/connect - Start the Drive connect flow
      if (
        req.method === 'GET' &&
        url.pathname === '/api/backup/google/connect'
      ) {
        const guard = backupLocalhostGuard()
        if (guard) return guard

        const result = await createDriveAuthUrl()
        if ('error' in result) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: result.error }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
        return handleCors(
          req,
          new Response(JSON.stringify({ data: { authUrl: result.authUrl } }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/backup/google/callback - Loopback OAuth callback (browser lands here)
      if (
        req.method === 'GET' &&
        url.pathname === '/api/backup/google/callback'
      ) {
        const oauthError = url.searchParams.get('error')
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')

        const renderPage = (title: string, message: string) =>
          handleCors(
            req,
            new Response(
              `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:system-ui;padding:2rem;text-align:center"><p>${message}</p><script>setTimeout(()=>window.close(),1500)</script></body></html>`,
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
            ),
          )

        if (oauthError) {
          return renderPage('Backup', `Authorization failed: ${oauthError}`)
        }
        if (!code || !state) {
          return renderPage('Backup', 'Missing authorization code or state.')
        }

        const result = await completeDriveAuth(code, state)
        if (!result.success) {
          return renderPage('Backup', `Authorization failed: ${result.error}`)
        }
        return renderPage(
          'Backup',
          'Google Drive connected. You can close this window and return to Church Hub.',
        )
      }

      // POST /api/backup/google/disconnect - Disconnect Google Drive
      if (
        req.method === 'POST' &&
        url.pathname === '/api/backup/google/disconnect'
      ) {
        const guard = backupLocalhostGuard()
        if (guard) return guard

        await clearDriveAuth()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: { success: true } }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/users - List all users
      if (req.method === 'GET' && url.pathname === '/api/users') {
        const authError = await requireAppAuth()
        if (authError) return authError

        const users = getAllUsers()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: users }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/users/:id - Get user by ID
      const getUserMatch = url.pathname.match(/^\/api\/users\/(\d+)$/)
      if (req.method === 'GET' && getUserMatch?.[1]) {
        const authError = await requireAppAuth()
        if (authError) return authError

        const id = parseInt(getUserMatch[1], 10)
        const user = getUserById(id)

        if (!user) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'User not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ data: user }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/users - Create new user
      if (req.method === 'POST' && url.pathname === '/api/users') {
        const authError = await requireAppAuth()
        if (authError) return authError

        try {
          const body = (await req.json()) as CreateUserInput

          if (!body.name) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing name' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const result = await createUser(body)

          if (!result) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Failed to create user' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: result }), {
              status: 201,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch (error) {
          // biome-ignore lint/suspicious/noConsole: debugging
          console.error('Create user error:', error)
          return handleCors(
            req,
            new Response(JSON.stringify({ error: String(error) }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // PUT /api/users/:id - Update user
      const updateUserMatch = url.pathname.match(/^\/api\/users\/(\d+)$/)
      if (req.method === 'PUT' && updateUserMatch?.[1]) {
        const authError = await requireAppAuth()
        if (authError) return authError

        const id = parseInt(updateUserMatch[1], 10)

        try {
          const body = (await req.json()) as UpdateUserInput
          const result = updateUser(id, body)

          if (!result.success) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: result.error }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const updatedUser = getUserById(id)
          return handleCors(
            req,
            new Response(JSON.stringify({ data: updatedUser }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // DELETE /api/users/:id - Delete user
      const deleteUserMatch = url.pathname.match(/^\/api\/users\/(\d+)$/)
      if (req.method === 'DELETE' && deleteUserMatch?.[1]) {
        const authError = await requireAppAuth()
        if (authError) return authError

        const id = parseInt(deleteUserMatch[1], 10)
        const result = deleteUser(id)

        if (!result.success) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: result.error }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ data: { success: true } }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // PUT /api/users/:id/permissions - Update user permissions
      const updatePermissionsMatch = url.pathname.match(
        /^\/api\/users\/(\d+)\/permissions$/,
      )
      if (req.method === 'PUT' && updatePermissionsMatch?.[1]) {
        const authError = await requireAppAuth()
        if (authError) return authError

        const id = parseInt(updatePermissionsMatch[1], 10)

        try {
          const body = (await req.json()) as { permissions: Permission[] }

          if (!body.permissions) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing permissions' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const result = updateUserPermissions(id, body.permissions)

          if (!result.success) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: result.error }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const updatedUser = getUserById(id)
          return handleCors(
            req,
            new Response(JSON.stringify({ data: updatedUser }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // PUT /api/users/:id/password - Set or clear a user's login password
      // (super-admin / system token only). Send { password: null } to clear.
      const setPasswordMatch = url.pathname.match(
        /^\/api\/users\/(\d+)\/password$/,
      )
      if (req.method === 'PUT' && setPasswordMatch?.[1]) {
        const authError = await requireAppAuth()
        if (authError) return authError

        const id = parseInt(setPasswordMatch[1], 10)

        try {
          const body = (await req.json()) as { password: string | null }
          const result = await setUserPassword(id, body.password ?? null)

          if (!result.success) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: result.error }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const updatedUser = getUserById(id)
          return handleCors(
            req,
            new Response(JSON.stringify({ data: updatedUser }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // PUT /api/users/:id/role - Set user role
      const setRoleMatch = url.pathname.match(/^\/api\/users\/(\d+)\/role$/)
      if (req.method === 'PUT' && setRoleMatch?.[1]) {
        const authError = await requireAppAuth()
        if (authError) return authError

        const id = parseInt(setRoleMatch[1], 10)

        try {
          const body = (await req.json()) as {
            roleId: number | null
            clearCustomPermissions?: boolean
          }

          const result = setUserRole(
            id,
            body.roleId,
            body.clearCustomPermissions ?? false,
          )

          if (!result.success) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: result.error }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const updatedUser = getUserById(id)
          return handleCors(
            req,
            new Response(JSON.stringify({ data: updatedUser }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // POST /api/users/:id/regenerate-token - Regenerate user token
      const regenerateTokenMatch = url.pathname.match(
        /^\/api\/users\/(\d+)\/regenerate-token$/,
      )
      if (req.method === 'POST' && regenerateTokenMatch?.[1]) {
        const authError = await requireAppAuth()
        if (authError) return authError

        const id = parseInt(regenerateTokenMatch[1], 10)
        const result = await regenerateUserToken(id)

        if (!result) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({ error: 'Failed to regenerate token' }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }

        const user = getUserById(id)
        return handleCors(
          req,
          new Response(
            JSON.stringify({
              data: { user, token: result.token },
            }),
            {
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        )
      }

      // POST /api/users/:id/grant-all-permissions - Grant all permissions to a user
      const grantAllPermissionsMatch = url.pathname.match(
        /^\/api\/users\/(\d+)\/grant-all-permissions$/,
      )
      if (req.method === 'POST' && grantAllPermissionsMatch?.[1]) {
        const authError = await requireAppAuth()
        if (authError) return authError

        const id = parseInt(grantAllPermissionsMatch[1], 10)
        const result = updateUserPermissions(id, ALL_PERMISSIONS)

        if (!result.success) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: result.error }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        const updatedUser = getUserById(id)
        return handleCors(
          req,
          new Response(
            JSON.stringify({
              data: updatedUser,
              message: `Granted ${ALL_PERMISSIONS.length} permissions to user`,
            }),
            {
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        )
      }

      // GET /api/network/interfaces - Get external network interfaces
      if (req.method === 'GET' && url.pathname === '/api/network/interfaces') {
        const authError = await requireAppAuth()
        if (authError) return authError

        const interfaces = getExternalInterfaces()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: interfaces }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/logs/open - Reveal the logs folder in the OS file manager
      // (localhost only — opening windows on a server box doesn't make sense)
      if (req.method === 'POST' && url.pathname === '/api/logs/open') {
        if (!isStrictLocalhost()) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({ error: 'Only accessible from localhost' }),
              { status: 403, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }
        const result = openLogsFolder()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: result }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/logs/path - Return the absolute path of the logs folder
      if (req.method === 'GET' && url.pathname === '/api/logs/path') {
        const authError = await requireAppAuth()
        if (authError) return authError

        return handleCors(
          req,
          new Response(JSON.stringify({ data: { path: getLogsDir() } }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/logs/content - Read the recent server + Tauri log tails for the
      // in-app Logs viewer. Gated by logs.view (permission-based, so a granted
      // remote operator can view them too).
      if (req.method === 'GET' && url.pathname === '/api/logs/content') {
        const permError = checkPermission('logs.view')
        if (permError) return permError

        // Viewer-friendly caps, clamped so a crafted query can't read the whole
        // disk into memory.
        const daysParam = Number(url.searchParams.get('days'))
        const bytesParam = Number(url.searchParams.get('maxBytes'))
        const daysBack =
          Number.isFinite(daysParam) && daysParam > 0
            ? Math.min(Math.floor(daysParam), 14)
            : 3
        const maxBytes =
          Number.isFinite(bytesParam) && bytesParam > 0
            ? Math.min(Math.floor(bytesParam), 1024 * 1024)
            : 256 * 1024

        const logs = await readRecentLogs(maxBytes, daysBack)
        return handleCors(
          req,
          new Response(JSON.stringify({ data: logs }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/logs/clear - Empty all local log files. Gated by logs.clear.
      if (req.method === 'POST' && url.pathname === '/api/logs/clear') {
        const permError = checkPermission('logs.clear')
        if (permError) return permError

        const result = clearLogs()
        authLogger.info('Logs cleared', {
          cleared: result.cleared,
          by: _context?.userId ?? null,
        })
        return handleCors(
          req,
          new Response(JSON.stringify({ data: result }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // ============================================================
      // Schedules API Endpoints
      // ============================================================

      // GET /api/schedules/search - Search schedules (must be before /api/schedules/:id)
      if (req.method === 'GET' && url.pathname === '/api/schedules/search') {
        const permError = checkPermission('programs.view')
        if (permError) return permError

        const query = url.searchParams.get('q') || ''
        const results = searchSchedules(query)
        return handleCors(
          req,
          new Response(JSON.stringify({ data: results }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/schedules - List all schedules
      if (req.method === 'GET' && url.pathname === '/api/schedules') {
        const permError = checkPermission('programs.view')
        if (permError) return permError

        const schedules = getSchedules()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: schedules }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/schedules/:id - Get schedule with items
      const getScheduleMatch = url.pathname.match(/^\/api\/schedules\/(\d+)$/)
      if (req.method === 'GET' && getScheduleMatch?.[1]) {
        const permError = checkPermission('programs.view')
        if (permError) return permError

        const id = parseInt(getScheduleMatch[1], 10)
        const schedule = getScheduleById(id)

        if (!schedule) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Schedule not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ data: schedule }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/schedules - Create/update schedule
      if (req.method === 'POST' && url.pathname === '/api/schedules') {
        try {
          const body = (await req.json()) as UpsertScheduleInput

          // Check create or edit permission based on whether it's a new schedule
          const permError = checkPermission(
            body.id ? 'programs.edit' : 'programs.create',
          )
          if (permError) return permError

          if (!body.title) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing title' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const schedule = upsertSchedule(body)

          if (!schedule) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({ error: 'Failed to save schedule' }),
                {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: schedule }), {
              status: body.id ? 200 : 201,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // DELETE /api/schedules/:id - Delete schedule
      const deleteScheduleMatch = url.pathname.match(
        /^\/api\/schedules\/(\d+)$/,
      )
      if (req.method === 'DELETE' && deleteScheduleMatch?.[1]) {
        const permError = checkPermission('programs.delete')
        if (permError) return permError

        const id = parseInt(deleteScheduleMatch[1], 10)
        const result = deleteSchedule(id)

        if (!result) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({ error: 'Failed to delete schedule' }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ data: { success: true } }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/schedules/:id/items - Add item to schedule
      const addScheduleItemMatch = url.pathname.match(
        /^\/api\/schedules\/(\d+)\/items$/,
      )
      if (req.method === 'POST' && addScheduleItemMatch?.[1]) {
        const permError = checkPermission('programs.edit')
        if (permError) return permError

        try {
          const scheduleId = parseInt(addScheduleItemMatch[1], 10)
          const body = (await req.json()) as Omit<
            AddToScheduleInput,
            'scheduleId'
          >

          const input: AddToScheduleInput = {
            scheduleId,
            ...body,
          }

          const item = addItemToSchedule(input)

          if (!item) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Failed to add item' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: item }), {
              status: 201,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // PUT /api/schedules/:id/items/:itemId - Update slide in schedule
      const updateScheduleItemMatch = url.pathname.match(
        /^\/api\/schedules\/(\d+)\/items\/(\d+)$/,
      )
      if (
        req.method === 'PUT' &&
        updateScheduleItemMatch?.[1] &&
        updateScheduleItemMatch?.[2]
      ) {
        const permError = checkPermission('programs.edit')
        if (permError) return permError

        try {
          const itemId = parseInt(updateScheduleItemMatch[2], 10)
          const body = (await req.json()) as Omit<
            UpdateScheduleSlideInput,
            'id'
          >

          const input: UpdateScheduleSlideInput = {
            id: itemId,
            slideType: body.slideType,
            slideContent: body.slideContent,
            biblePassage: body.biblePassage,
            verseteTineriEntries: body.verseteTineriEntries,
          }

          const item = updateScheduleSlide(input)

          if (!item) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Failed to update item' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: item }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // DELETE /api/schedules/:id/items/:itemId - Remove item from schedule
      const removeScheduleItemMatch = url.pathname.match(
        /^\/api\/schedules\/(\d+)\/items\/(\d+)$/,
      )
      if (
        req.method === 'DELETE' &&
        removeScheduleItemMatch?.[1] &&
        removeScheduleItemMatch?.[2]
      ) {
        const permError = checkPermission('programs.edit')
        if (permError) return permError

        const scheduleId = parseInt(removeScheduleItemMatch[1], 10)
        const itemId = parseInt(removeScheduleItemMatch[2], 10)
        const result = removeItemFromSchedule(scheduleId, itemId)

        if (!result) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Failed to remove item' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ data: { success: true } }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // PUT /api/schedules/:id/items/reorder - Reorder schedule items
      const reorderScheduleItemsMatch = url.pathname.match(
        /^\/api\/schedules\/(\d+)\/items\/reorder$/,
      )
      if (req.method === 'PUT' && reorderScheduleItemsMatch?.[1]) {
        const permError = checkPermission('programs.edit')
        if (permError) return permError

        try {
          const scheduleId = parseInt(reorderScheduleItemsMatch[1], 10)
          const body = (await req.json()) as ReorderScheduleItemsInput

          if (!body.itemIds || !Array.isArray(body.itemIds)) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing itemIds array' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const result = reorderScheduleItems(scheduleId, body)

          if (!result) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({ error: 'Failed to reorder items' }),
                {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: { success: true } }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // PUT /api/schedules/:id/items/replace - Replace all items in schedule
      const replaceScheduleItemsMatch = url.pathname.match(
        /^\/api\/schedules\/(\d+)\/items\/replace$/,
      )
      if (req.method === 'PUT' && replaceScheduleItemsMatch?.[1]) {
        const permError = checkPermission('programs.edit')
        if (permError) return permError

        try {
          const scheduleId = parseInt(replaceScheduleItemsMatch[1], 10)
          const body = (await req.json()) as ReplaceScheduleItemsInput

          if (!body.items || !Array.isArray(body.items)) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing items array' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const result = replaceScheduleItems({
            scheduleId,
            items: body.items,
          })

          if (!result.success) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({
                  error: result.error || 'Failed to replace items',
                }),
                {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: result }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // ============================================================
      // Screens API Endpoints
      // ============================================================

      // GET /api/screens - List all screens
      if (req.method === 'GET' && url.pathname === '/api/screens') {
        const permError = checkPermission('displays.view')
        if (permError) return permError

        const screenList = getAllScreens()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: screenList }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/screens/:id - Get screen by ID (with configs)
      const getScreenMatch = url.pathname.match(/^\/api\/screens\/(\d+)$/)
      if (req.method === 'GET' && getScreenMatch?.[1]) {
        const permError = checkPermission('displays.view')
        if (permError) return permError

        const id = parseInt(getScreenMatch[1], 10)
        const screen = getScreenWithConfigs(id)

        if (!screen) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Screen not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ data: screen }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/screens - Create/update screen
      if (req.method === 'POST' && url.pathname === '/api/screens') {
        try {
          const body = (await req.json()) as UpsertScreenInput

          const permError = checkPermission(
            body.id ? 'displays.edit' : 'displays.create',
          )
          if (permError) return permError

          if (!body.name) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing name' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          if (!body.type) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing type' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const screen = upsertScreen(body)

          if (!screen) {
            // biome-ignore lint/suspicious/noConsole: Debug logging for save failures
            console.error(
              '[screens] Failed to save screen with body:',
              JSON.stringify(body),
            )
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Failed to save screen' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          // Broadcast screen config update if updating existing screen
          if (body.id) {
            broadcastScreenConfigUpdated(screen.id)
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: screen }), {
              status: body.id ? 200 : 201,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // DELETE /api/screens/:id - Delete screen
      const deleteScreenMatch = url.pathname.match(/^\/api\/screens\/(\d+)$/)
      if (req.method === 'DELETE' && deleteScreenMatch?.[1]) {
        const permError = checkPermission('displays.delete')
        if (permError) return permError

        const id = parseInt(deleteScreenMatch[1], 10)
        const result = deleteScreen(id)

        if (!result.success) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: result.error }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ data: { success: true } }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // PUT /api/screens/:id/config/:contentType - Update content config
      const updateConfigMatch = url.pathname.match(
        /^\/api\/screens\/(\d+)\/config\/(.+)$/,
      )
      if (
        req.method === 'PUT' &&
        updateConfigMatch?.[1] &&
        updateConfigMatch?.[2]
      ) {
        const permError = checkPermission('displays.edit')
        if (permError) return permError

        try {
          const screenId = parseInt(updateConfigMatch[1], 10)
          const contentType = updateConfigMatch[2] as ContentType
          const body = (await req.json()) as { config: Record<string, unknown> }

          if (!body.config) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing config' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const result = updateContentConfig({
            screenId,
            contentType,
            config: body.config,
          })

          if (!result.success) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: result.error }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          // Broadcast screen config update to all connected clients
          broadcastScreenConfigUpdated(screenId)

          const config = getContentConfig(screenId, contentType)
          return handleCors(
            req,
            new Response(JSON.stringify({ data: config }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // PUT /api/screens/:id/next-slide-config - Update next slide config
      const updateNextSlideMatch = url.pathname.match(
        /^\/api\/screens\/(\d+)\/next-slide-config$/,
      )
      if (req.method === 'PUT' && updateNextSlideMatch?.[1]) {
        const permError = checkPermission('displays.edit')
        if (permError) return permError

        try {
          const screenId = parseInt(updateNextSlideMatch[1], 10)
          const body = (await req.json()) as { config: NextSlideSectionConfig }

          if (!body.config) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing config' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const result = updateNextSlideConfig({
            screenId,
            config: body.config,
          })

          if (!result.success) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: result.error }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          // Broadcast screen config update to all connected clients
          broadcastScreenConfigUpdated(screenId)

          const config = getNextSlideConfig(screenId)
          return handleCors(
            req,
            new Response(JSON.stringify({ data: config }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // PUT /api/screens/:id/global-settings - Update global settings
      const updateGlobalSettingsMatch = url.pathname.match(
        /^\/api\/screens\/(\d+)\/global-settings$/,
      )
      if (req.method === 'PUT' && updateGlobalSettingsMatch?.[1]) {
        const permError = checkPermission('displays.edit')
        if (permError) return permError

        try {
          const screenId = parseInt(updateGlobalSettingsMatch[1], 10)
          const body = (await req.json()) as { settings: ScreenGlobalSettings }

          if (!body.settings) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing settings' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const result = updateGlobalSettings(screenId, body.settings)

          if (!result.success) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: result.error }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          // Broadcast screen config update to all connected clients
          broadcastScreenConfigUpdated(screenId)

          const screen = getScreenById(screenId)
          return handleCors(
            req,
            new Response(JSON.stringify({ data: screen }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // PUT /api/screens/:id/batch-config - Batch update all screen configs
      const batchConfigMatch = url.pathname.match(
        /^\/api\/screens\/(\d+)\/batch-config$/,
      )
      if (req.method === 'PUT' && batchConfigMatch?.[1]) {
        const permError = checkPermission('displays.edit')
        if (permError) return permError

        try {
          const screenId = parseInt(batchConfigMatch[1], 10)
          const body = (await req.json()) as {
            globalSettings: ScreenGlobalSettings
            contentConfigs: Record<ContentType, Record<string, unknown>>
            nextSlideConfig?: NextSlideSectionConfig
            width?: number
            height?: number
          }

          if (!body.globalSettings || !body.contentConfigs) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({
                  error: 'Missing globalSettings or contentConfigs',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          const result = batchUpdateScreenConfigs({
            screenId,
            globalSettings: body.globalSettings,
            contentConfigs: body.contentConfigs,
            nextSlideConfig: body.nextSlideConfig,
            width: body.width,
            height: body.height,
          })

          if (!result.success) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: result.error }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          // Broadcast screen config update to all connected clients
          broadcastScreenConfigUpdated(screenId)

          const screen = getScreenWithConfigs(screenId)
          return handleCors(
            req,
            new Response(JSON.stringify({ data: screen }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // ============================================================
      // Screen Scene Override API Endpoints
      // ============================================================

      // PUT /api/screens/:id/scene-overrides/:sceneName/:contentType - Upsert scene override
      const sceneOverrideMatch = url.pathname.match(
        /^\/api\/screens\/(\d+)\/scene-overrides\/([^/]+)\/([^/]+)$/,
      )
      if (req.method === 'PUT' && sceneOverrideMatch?.[1]) {
        const permError = checkPermission('displays.edit')
        if (permError) return permError

        try {
          const screenId = parseInt(sceneOverrideMatch[1], 10)
          const obsSceneName = decodeURIComponent(sceneOverrideMatch[2])
          const contentType = sceneOverrideMatch[3] as ContentType
          const body = (await req.json()) as { config: Record<string, unknown> }

          const result = upsertSceneOverride(
            screenId,
            obsSceneName,
            contentType,
            body.config,
          )

          if (!result.success) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: result.error }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          broadcastScreenConfigUpdated(screenId)

          return handleCors(
            req,
            new Response(JSON.stringify({ success: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // DELETE /api/screens/:id/scene-overrides/:sceneName/:contentType - Delete specific override
      if (req.method === 'DELETE' && sceneOverrideMatch?.[1]) {
        const permError = checkPermission('displays.edit')
        if (permError) return permError

        const screenId = parseInt(sceneOverrideMatch[1], 10)
        const obsSceneName = decodeURIComponent(sceneOverrideMatch[2]!)
        const contentType = sceneOverrideMatch[3] as ContentType

        const result = deleteSceneOverride(screenId, obsSceneName, contentType)

        broadcastScreenConfigUpdated(screenId)

        return handleCors(
          req,
          new Response(JSON.stringify({ success: result.success }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // DELETE /api/screens/:id/scene-overrides - Clear all overrides for a screen
      const clearSceneOverridesMatch = url.pathname.match(
        /^\/api\/screens\/(\d+)\/scene-overrides$/,
      )
      if (req.method === 'DELETE' && clearSceneOverridesMatch?.[1]) {
        const permError = checkPermission('displays.edit')
        if (permError) return permError

        const screenId = parseInt(clearSceneOverridesMatch[1], 10)
        const result = deleteAllSceneOverrides(screenId)

        broadcastScreenConfigUpdated(screenId)

        return handleCors(
          req,
          new Response(JSON.stringify({ success: result.success }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // ============================================================
      // Presentation State API Endpoints
      // ============================================================

      // Helper function to handle scene automation after presentation state changes
      async function triggerSceneAutomation(
        state: ReturnType<typeof getPresentationState>,
      ): Promise<void> {
        try {
          const contentType = await detectContentType(state)
          await handleContentTypeChange(contentType, state.isPresenting)
        } catch (error) {
          // biome-ignore lint/suspicious/noConsole: Error logging
          console.error('[scene-automation] Error:', error)
        }
      }

      // GET /api/presentation/state - Get current presentation state
      if (req.method === 'GET' && url.pathname === '/api/presentation/state') {
        const permError = checkPermission('control_room.view')
        if (permError) return permError

        const state = getPresentationState()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: state }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // PUT /api/presentation/state - Update presentation state
      if (req.method === 'PUT' && url.pathname === '/api/presentation/state') {
        const permError = checkPermission('control_room.control')
        if (permError) return permError

        try {
          const body = (await req.json()) as UpdatePresentationStateInput
          const state = updatePresentationState(body)
          broadcastPresentationState(state)
          triggerSceneAutomation(state)

          return handleCors(
            req,
            new Response(JSON.stringify({ data: state }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // POST /api/presentation/stop - Stop presenting
      if (req.method === 'POST' && url.pathname === '/api/presentation/stop') {
        const permError = checkPermission('control_room.control')
        if (permError) return permError

        const state = stopPresentation()
        broadcastPresentationState(state)
        triggerSceneAutomation(state)

        return handleCors(
          req,
          new Response(JSON.stringify({ data: state }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/presentation/clear - Clear current slide (hide)
      if (req.method === 'POST' && url.pathname === '/api/presentation/clear') {
        const permError = checkPermission('control_room.control')
        if (permError) return permError

        const state = clearSlide()
        broadcastPresentationState(state)
        triggerSceneAutomation(state)

        return handleCors(
          req,
          new Response(JSON.stringify({ data: state }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/presentation/show - Show last displayed slide
      if (req.method === 'POST' && url.pathname === '/api/presentation/show') {
        const permError = checkPermission('control_room.control')
        if (permError) return permError

        const state = showSlide()
        broadcastPresentationState(state)
        triggerSceneAutomation(state)

        return handleCors(
          req,
          new Response(JSON.stringify({ data: state }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/presentation/temporary-bible - Present Bible verse temporarily
      if (
        req.method === 'POST' &&
        url.pathname === '/api/presentation/temporary-bible'
      ) {
        const permError = checkPermission('control_room.control')
        if (permError) return permError

        try {
          const body = (await req.json()) as PresentTemporaryBibleInput
          // Stop any active screen share when presenting other content
          stopActiveScreenShare()
          const state = presentTemporaryBible(body)
          broadcastPresentationState(state)
          triggerSceneAutomation(state)

          return handleCors(
            req,
            new Response(JSON.stringify({ data: state }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // POST /api/presentation/temporary-song - Present song temporarily
      if (
        req.method === 'POST' &&
        url.pathname === '/api/presentation/temporary-song'
      ) {
        const permError = checkPermission('control_room.control')
        if (permError) return permError

        try {
          const body = (await req.json()) as PresentTemporarySongInput
          // Stop any active screen share when presenting other content
          stopActiveScreenShare()
          const state = presentTemporarySong(body)
          broadcastPresentationState(state)
          triggerSceneAutomation(state)

          return handleCors(
            req,
            new Response(JSON.stringify({ data: state }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // POST /api/presentation/navigate-temporary - Navigate within temporary content
      if (
        req.method === 'POST' &&
        url.pathname === '/api/presentation/navigate-temporary'
      ) {
        const permError = checkPermission('control_room.control')
        if (permError) return permError

        try {
          const body = (await req.json()) as NavigateTemporaryInput

          if (!body.direction) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing direction' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          if (!body.requestTimestamp) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({ error: 'Missing requestTimestamp' }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          const state = navigateTemporary(body.direction, body.requestTimestamp)
          broadcastPresentationState(state)
          triggerSceneAutomation(state)

          return handleCors(
            req,
            new Response(JSON.stringify({ data: state }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // POST /api/presentation/clear-temporary - Clear temporary content
      if (
        req.method === 'POST' &&
        url.pathname === '/api/presentation/clear-temporary'
      ) {
        const permError = checkPermission('control_room.control')
        if (permError) return permError

        const state = clearTemporaryContent()

        broadcastPresentationState(state)
        triggerSceneAutomation(state)

        return handleCors(
          req,
          new Response(JSON.stringify({ data: state }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/presentation/highlights - Get current slide highlights
      if (
        req.method === 'GET' &&
        url.pathname === '/api/presentation/highlights'
      ) {
        const permError = checkPermission('control_room.view')
        if (permError) return permError

        const highlights = getSlideHighlights()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: highlights }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/presentation/highlights - Add a slide highlight
      if (
        req.method === 'POST' &&
        url.pathname === '/api/presentation/highlights'
      ) {
        const permError = checkPermission('control_room.control')
        if (permError) return permError

        try {
          const body = (await req.json()) as TextStyleRange
          const highlights = addSlideHighlight(body)
          broadcastSlideHighlights(highlights)

          return handleCors(
            req,
            new Response(JSON.stringify({ data: highlights }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // DELETE /api/presentation/highlights/:id - Remove a specific highlight
      if (
        req.method === 'DELETE' &&
        url.pathname.startsWith('/api/presentation/highlights/')
      ) {
        const permError = checkPermission('control_room.control')
        if (permError) return permError

        const highlightId = url.pathname.replace(
          '/api/presentation/highlights/',
          '',
        )
        if (!highlightId) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Highlight ID required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        const highlights = removeSlideHighlight(highlightId)
        broadcastSlideHighlights(highlights)

        return handleCors(
          req,
          new Response(JSON.stringify({ data: highlights }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // DELETE /api/presentation/highlights - Clear all highlights
      if (
        req.method === 'DELETE' &&
        url.pathname === '/api/presentation/highlights'
      ) {
        const permError = checkPermission('control_room.control')
        if (permError) return permError

        clearSlideHighlights()
        broadcastSlideHighlights([])

        return handleCors(
          req,
          new Response(JSON.stringify({ data: [] }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/presentation/temporary-announcement - Present an announcement
      if (
        req.method === 'POST' &&
        url.pathname === '/api/presentation/temporary-announcement'
      ) {
        const permError = checkPermission('control_room.control')
        if (permError) return permError

        try {
          const body = (await req.json()) as PresentTemporaryAnnouncementInput
          // Stop any active screen share when presenting other content
          stopActiveScreenShare()
          const state = presentTemporaryAnnouncement(body)
          broadcastPresentationState(state)
          triggerSceneAutomation(state)

          return handleCors(
            req,
            new Response(JSON.stringify({ data: state }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // POST /api/presentation/temporary-bible-passage - Present a Bible passage
      if (
        req.method === 'POST' &&
        url.pathname === '/api/presentation/temporary-bible-passage'
      ) {
        const permError = checkPermission('control_room.control')
        if (permError) return permError

        try {
          const body = (await req.json()) as PresentTemporaryBiblePassageInput
          // Stop any active screen share when presenting other content
          stopActiveScreenShare()
          const state = presentTemporaryBiblePassage(body)
          broadcastPresentationState(state)
          triggerSceneAutomation(state)

          return handleCors(
            req,
            new Response(JSON.stringify({ data: state }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // POST /api/presentation/temporary-versete-tineri - Present versete tineri
      if (
        req.method === 'POST' &&
        url.pathname === '/api/presentation/temporary-versete-tineri'
      ) {
        const permError = checkPermission('control_room.control')
        if (permError) return permError

        try {
          const body = (await req.json()) as PresentTemporaryVerseteTineriInput
          // Stop any active screen share when presenting other content
          stopActiveScreenShare()
          const state = presentTemporaryVerseteTineri(body)
          broadcastPresentationState(state)
          triggerSceneAutomation(state)

          return handleCors(
            req,
            new Response(JSON.stringify({ data: state }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // POST /api/presentation/temporary-scene - Present a scene (empty slide)
      if (
        req.method === 'POST' &&
        url.pathname === '/api/presentation/temporary-scene'
      ) {
        const permError = checkPermission('control_room.control')
        if (permError) return permError

        try {
          const body = (await req.json()) as PresentTemporarySceneInput
          // Stop any active screen share when presenting other content
          stopActiveScreenShare()
          const state = presentTemporaryScene(body)
          broadcastPresentationState(state)

          return handleCors(
            req,
            new Response(JSON.stringify({ data: state }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // ============================================================
      // Songs API Endpoints
      // ============================================================

      // GET /api/songs/search - Search songs (must be before /api/songs/:id)
      if (req.method === 'GET' && url.pathname === '/api/songs/search') {
        const permError = checkPermission('songs.view')
        if (permError) return permError

        const query = url.searchParams.get('q') || ''
        const categoryIdsParam = url.searchParams.get('categoryIds')
        const categoryIds = categoryIdsParam
          ? categoryIdsParam
              .split(',')
              .map((id) => parseInt(id, 10))
              .filter((id) => !isNaN(id))
          : undefined
        const presentedOnly =
          url.searchParams.get('presentedOnly') === 'true' || undefined
        const inSchedulesOnly =
          url.searchParams.get('inSchedulesOnly') === 'true' || undefined
        const hasKeyLine =
          url.searchParams.get('hasKeyLine') === 'true' || undefined
        const results = searchSongs(
          query,
          categoryIds && categoryIds.length > 0 ? categoryIds : undefined,
          50,
          { presentedOnly, inSchedulesOnly, hasKeyLine },
        )

        return handleCors(
          req,
          new Response(JSON.stringify({ data: results }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          }),
        )
      }

      // POST /api/songs/ai-search - AI-enhanced semantic search
      if (req.method === 'POST' && url.pathname === '/api/songs/ai-search') {
        const permError = checkPermission('songs.view')
        if (permError) return permError

        try {
          const body = (await req.json()) as {
            query: string
            categoryIds?: number[]
          }

          if (!body.query?.trim()) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Query is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const results = await aiSearchSongs({
            query: body.query,
            categoryIds: body.categoryIds,
          })

          return handleCors(
            req,
            new Response(JSON.stringify({ data: results }), {
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
              },
            }),
          )
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'AI search failed'
          return handleCors(
            req,
            new Response(JSON.stringify({ error: message }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // GET /api/songs/search/benchmark - Benchmark search performance
      if (
        req.method === 'GET' &&
        url.pathname === '/api/songs/search/benchmark'
      ) {
        const permError = checkPermission('songs.view')
        if (permError) return permError

        const testQueries = [
          'În străvechea Carte sfânt',
          'in stravechea carte sfant',
          'Isus',
          'Doamne',
          'har',
          'credinta',
          'slavă Domnului',
        ]
        const iterations = 5
        const results: Array<{
          query: string
          avgMs: number
          minMs: number
          maxMs: number
          resultCount: number
          topResult: string | null
        }> = []

        // Clear search cache before benchmarking
        clearSearchCache()

        for (const q of testQueries) {
          const times: number[] = []
          let resultCount = 0
          let topResult: string | null = null

          for (let i = 0; i < iterations; i++) {
            clearSearchCache()
            const start = performance.now()
            const res = searchSongs(q)
            times.push(performance.now() - start)
            resultCount = res.length
            topResult = res[0]?.title ?? null
          }

          results.push({
            query: q,
            avgMs:
              Math.round(
                (times.reduce((a, b) => a + b, 0) / times.length) * 100,
              ) / 100,
            minMs: Math.round(Math.min(...times) * 100) / 100,
            maxMs: Math.round(Math.max(...times) * 100) / 100,
            resultCount,
            topResult,
          })
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ data: results }, null, 2), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/songs/search/rebuild - Rebuild FTS search index
      if (
        req.method === 'POST' &&
        url.pathname === '/api/songs/search/rebuild'
      ) {
        const permError = checkPermission('songs.create')
        if (permError) return permError

        try {
          const startTime = performance.now()
          rebuildSearchIndex()
          const duration = performance.now() - startTime

          // biome-ignore lint/suspicious/noConsole: performance logging
          console.log(
            `[INFO] [search-rebuild] FTS index rebuilt in ${duration.toFixed(2)}ms`,
          )

          return handleCors(
            req,
            new Response(
              JSON.stringify({
                data: { success: true, duration: Math.round(duration) },
              }),
              {
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          return handleCors(
            req,
            new Response(JSON.stringify({ error: `Rebuild failed: ${msg}` }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // GET /api/songs/export - Get all songs with slides for export
      if (req.method === 'GET' && url.pathname === '/api/songs/export') {
        const permError = checkPermission('songs.view')
        if (permError) return permError

        const categoryIdParam = url.searchParams.get('categoryId')
        const categoryId = categoryIdParam
          ? parseInt(categoryIdParam, 10)
          : null
        const songs = getAllSongsWithSlides(categoryId)
        return handleCors(
          req,
          new Response(JSON.stringify({ data: songs }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/songs/debug/analyze-keylines - Analyze keylines in first slide last line
      if (
        req.method === 'GET' &&
        url.pathname === '/api/songs/debug/analyze-keylines'
      ) {
        const permError = checkPermission('songs.manage')
        if (permError) return permError

        // Musical key patterns - solfège (Romanian/Italian) and letter notation
        // Matches: Mi M, Do M, Sol, Fa(Mi), Re(Mi M), Sol (Fa M sau Mi), La M, Mi m, etc.
        // Pattern: Note + optional sharp/flat + optional Major/Minor + optional alternate in parentheses
        const KEY_REGEX =
          /^(Do|Re|Mi|Fa|Sol|La|Si)(#|b)?\s*(Major|Minor|Maj|Min|M|m)?(\s*\(.*\))?(\s+sau\s+.*)?$/i

        // Extract text from last <p> tag
        const extractLastParagraph = (html: string): string | null => {
          const paragraphs = html.match(/<p>([^<]*)<\/p>/gi)
          if (!paragraphs || paragraphs.length === 0) return null
          const lastP = paragraphs[paragraphs.length - 1]
          return lastP.replace(/<\/?p>/gi, '').trim()
        }

        // Filter by category names if provided
        const categoryNamesParam = url.searchParams.get('categoryNames')
        const categoryNames = categoryNamesParam
          ? categoryNamesParam.split(',').map((n) => n.trim())
          : null

        // Get category IDs from names
        let categoryIds: number[] | null = null
        if (categoryNames) {
          const allCategories = getAllCategories()
          categoryIds = allCategories
            .filter((c) => categoryNames.some((name) => c.name.includes(name)))
            .map((c) => c.id)
        }

        // Get songs - if categoryIds is provided, get songs for each category
        let allSongs: Awaited<ReturnType<typeof getAllSongsWithSlides>> = []
        if (categoryIds && categoryIds.length > 0) {
          for (const catId of categoryIds) {
            const catSongs = getAllSongsWithSlides(catId)
            allSongs = allSongs.concat(catSongs)
          }
        } else {
          allSongs = getAllSongsWithSlides(null)
        }

        const matches: Array<{
          songId: number
          title: string
          lastParagraph: string
          existingKeyLine: string | null
          categoryName: string | null
        }> = []

        for (const song of allSongs) {
          // Get first slide (sort_order = 0 or minimum)
          const firstSlide = song.slides?.sort(
            (a, b) => a.sortOrder - b.sortOrder,
          )[0]

          if (!firstSlide?.content) continue

          const lastParagraph = extractLastParagraph(firstSlide.content)
          if (!lastParagraph) continue

          // Check if last paragraph matches key pattern
          if (KEY_REGEX.test(lastParagraph)) {
            matches.push({
              songId: song.id,
              title: song.title,
              lastParagraph,
              existingKeyLine: song.keyLine,
              categoryName: song.category?.name ?? null,
            })
          }
        }

        // Get unique keylines if requested
        const uniqueOnly = url.searchParams.get('unique') === 'true'
        const uniqueKeylines = [
          ...new Set(matches.map((m) => m.lastParagraph)),
        ].sort()

        return handleCors(
          req,
          new Response(
            JSON.stringify({
              regex: KEY_REGEX.source,
              categoryFilter: categoryNames,
              categoryIds,
              totalSongs: allSongs.length,
              totalMatches: matches.length,
              matchesWithExistingKeyLine: matches.filter(
                (m) => m.existingKeyLine,
              ).length,
              matchesWithoutKeyLine: matches.filter((m) => !m.existingKeyLine)
                .length,
              uniqueKeylines,
              matches: uniqueOnly ? undefined : matches,
            }),
            {
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        )
      }

      // GET /api/songs/debug/sample-last-lines - Sample last lines from first slides
      if (
        req.method === 'GET' &&
        url.pathname === '/api/songs/debug/sample-last-lines'
      ) {
        const permError = checkPermission('songs.manage')
        if (permError) return permError

        const limitParam = url.searchParams.get('limit')
        const limit = limitParam ? parseInt(limitParam, 10) : 100

        // Extract text from last <p> tag
        const extractLastParagraph = (html: string): string | null => {
          const paragraphs = html.match(/<p>([^<]*)<\/p>/gi)
          if (!paragraphs || paragraphs.length === 0) return null
          const lastP = paragraphs[paragraphs.length - 1]
          return lastP.replace(/<\/?p>/gi, '').trim()
        }

        const allSongs = getAllSongsWithSlides(null)
        const samples: Array<{
          songId: number
          title: string
          lastParagraph: string
          existingKeyLine: string | null
        }> = []

        for (const song of allSongs) {
          if (samples.length >= limit) break

          const firstSlide = song.slides?.sort(
            (a, b) => a.sortOrder - b.sortOrder,
          )[0]

          if (!firstSlide?.content) continue

          const lastParagraph = extractLastParagraph(firstSlide.content)

          if (lastParagraph) {
            samples.push({
              songId: song.id,
              title: song.title,
              lastParagraph,
              existingKeyLine: song.keyLine,
            })
          }
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ samples }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/songs - List all songs (with pagination support)
      if (req.method === 'GET' && url.pathname === '/api/songs') {
        const presentedOnlyParam = url.searchParams.get('presentedOnly')

        // Allow song_key.view permission when only fetching presented songs
        if (presentedOnlyParam === 'true') {
          const songKeyPermError = checkPermission('song_key.view')
          const songsPermError = checkPermission('songs.view')
          if (songKeyPermError && songsPermError) return songsPermError
        } else {
          const permError = checkPermission('songs.view')
          if (permError) return permError
        }

        const limitParam = url.searchParams.get('limit')
        const offsetParam = url.searchParams.get('offset')
        const categoryIdsParam = url.searchParams.get('categoryIds')
        const tagIdsParam = url.searchParams.get('tagIds')
        const inSchedulesOnlyParam = url.searchParams.get('inSchedulesOnly')
        const hasKeyLineParam = url.searchParams.get('hasKeyLine')
        const sortByParam = url.searchParams.get('sortBy')

        // If pagination params provided, use paginated query
        if (limitParam) {
          const limit = parseInt(limitParam, 10) || 50
          const offset = offsetParam ? parseInt(offsetParam, 10) || 0 : 0
          const categoryIds = categoryIdsParam
            ? categoryIdsParam
                .split(',')
                .map((id) => parseInt(id, 10))
                .filter((id) => !isNaN(id))
            : undefined
          const tagIds = tagIdsParam
            ? tagIdsParam
                .split(',')
                .map((id) => parseInt(id, 10))
                .filter((id) => !isNaN(id))
            : undefined

          const validSortValues = [
            'lastPlayed',
            'mostPlayed',
            'title',
            'newest',
            'oldest',
          ] as const
          const sortBy =
            sortByParam &&
            validSortValues.includes(
              sortByParam as (typeof validSortValues)[number],
            )
              ? (sortByParam as SongFilters['sortBy'])
              : undefined

          const filters: SongFilters = {
            categoryIds:
              categoryIds && categoryIds.length > 0 ? categoryIds : undefined,
            tagIds: tagIds && tagIds.length > 0 ? tagIds : undefined,
            presentedOnly: presentedOnlyParam === 'true',
            inSchedulesOnly: inSchedulesOnlyParam === 'true',
            hasKeyLine: hasKeyLineParam === 'true',
            sortBy,
          }

          const result = getSongsPaginated(limit, offset, filters)
          return handleCors(
            req,
            new Response(JSON.stringify({ data: result }), {
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
              },
            }),
          )
        }

        // Legacy: return all songs without pagination
        const songs = getAllSongs()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: songs }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          }),
        )
      }

      // GET /api/songs/:id - Get song with slides
      const getSongMatch = url.pathname.match(/^\/api\/songs\/(\d+)$/)
      if (req.method === 'GET' && getSongMatch?.[1]) {
        const permError = checkPermission('songs.view')
        if (permError) return permError

        const id = parseInt(getSongMatch[1], 10)
        const song = getSongWithSlides(id)

        if (!song) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Song not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ data: song }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/songs - Create/update song
      if (req.method === 'POST' && url.pathname === '/api/songs') {
        try {
          const body = (await req.json()) as UpsertSongInput

          // Check create or edit permission based on whether it's a new song
          // Allow song_key.edit for keyLine-only updates (id, title, keyLine only)
          const bodyKeys = Object.keys(body)
          const isKeyLineOnlyUpdate =
            body.id &&
            bodyKeys.every((k) => ['id', 'title', 'keyLine'].includes(k))

          let permError: Response | null = null
          if (isKeyLineOnlyUpdate) {
            permError = checkPermission('song_key.edit')
          } else {
            permError = checkPermission(body.id ? 'songs.edit' : 'songs.create')
          }
          if (permError) return permError

          if (!body.title) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing title' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const song = upsertSong({ ...body, isManualEdit: true })

          if (!song) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Failed to save song' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          // Update search index
          updateSearchIndex(song.id)

          // Broadcast song update to all connected clients
          broadcastSongUpdated(song.id)

          // If this song is currently being presented, refresh its slides
          const refreshedState = refreshPresentedSongSlides(song.id)
          if (refreshedState) {
            broadcastPresentationState(refreshedState)
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: song }), {
              status: body.id ? 200 : 201,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch (error) {
          // Surface the real reason (SQLite/validation/etc.) so the client
          // toast shows something actionable instead of a generic 500.
          if (error instanceof SyntaxError) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }
          const message = error instanceof Error ? error.message : String(error)
          return handleCors(
            req,
            new Response(JSON.stringify({ error: message }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // POST /api/songs/replace-references - Replace song references and delete old song
      if (
        req.method === 'POST' &&
        url.pathname === '/api/songs/replace-references'
      ) {
        const permError = checkPermission('songs.edit')
        if (permError) return permError

        try {
          const body = (await req.json()) as {
            oldSongId: number
            newSongId: number
          }

          if (!body.oldSongId || !body.newSongId) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({ error: 'Missing oldSongId or newSongId' }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          const result = completeSongReplacement(body.oldSongId, body.newSongId)

          if (!result.success) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({ error: result.error || 'Failed to replace' }),
                {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Remove old song from search index
          removeFromSearchIndex(body.oldSongId)

          return handleCors(
            req,
            new Response(JSON.stringify({ data: result }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // POST /api/songs/batch - Batch import songs
      if (req.method === 'POST' && url.pathname === '/api/songs/batch') {
        const permError = checkPermission('songs.create')
        if (permError) return permError

        try {
          const apiStart = performance.now()
          const body = (await req.json()) as {
            songs: BatchImportSongInput[]
            categoryId?: number | null
            overwriteDuplicates?: boolean
            skipManuallyEdited?: boolean
          }

          if (!body.songs || !Array.isArray(body.songs)) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing songs array' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const importStart = performance.now()
          const result = batchImportSongs(
            body.songs,
            body.categoryId,
            body.overwriteDuplicates,
            body.skipManuallyEdited,
          )
          const importTime = performance.now() - importStart

          // Update search index for all imported songs in a single batch operation
          const searchStart = performance.now()
          batchUpdateSearchIndex(result.songIds)
          const searchTime = performance.now() - searchStart

          const totalTime = performance.now() - apiStart
          // biome-ignore lint/suspicious/noConsole: performance logging
          console.log(
            `[INFO] [batch-import] [PERF] API total: ${totalTime.toFixed(2)}ms | Import: ${importTime.toFixed(0)}ms | Search index: ${searchTime.toFixed(0)}ms | Songs: ${body.songs.length}`,
          )

          return handleCors(
            req,
            new Response(JSON.stringify({ data: result }), {
              status: 201,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // POST /api/songs/discovery/match - Classify external (not-yet-imported)
      // songs against the local library so the discovery screen shows only the
      // ones the user lacks. Per candidate: exact-filename → exact-title →
      // fuzzy-similar → new. Batched (client chunks ≤500) to avoid per-song
      // round-trips over a multi-thousand-song catalog.
      if (
        req.method === 'POST' &&
        url.pathname === '/api/songs/discovery/match'
      ) {
        const permError = checkPermission('songs.create')
        if (permError) return permError

        try {
          const body = (await req.json()) as {
            candidates: DiscoveryCandidateInput[]
          }

          if (!body.candidates || !Array.isArray(body.candidates)) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({ error: 'Missing candidates array' }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          if (body.candidates.length > 500) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({
                  error: 'Too many candidates (max 500 per request)',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          const results = matchCandidatesAgainstLibrary(body.candidates)

          return handleCors(
            req,
            new Response(JSON.stringify({ data: results }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // POST /api/songs/discovery/count - Cheap "how many are new?" count for the
      // background discovery check (sidebar badge + toast). Filename + title only,
      // no FTS — so it stays fast even over a multi-thousand-song catalog.
      if (
        req.method === 'POST' &&
        url.pathname === '/api/songs/discovery/count'
      ) {
        const permError = checkPermission('songs.create')
        if (permError) return permError

        try {
          const body = (await req.json()) as {
            candidates: { title: string; sourceFilename: string | null }[]
          }

          if (!body.candidates || !Array.isArray(body.candidates)) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({ error: 'Missing candidates array' }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          if (body.candidates.length > 5000) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({
                  error: 'Too many candidates (max 5000 per request)',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          const newCount = countNewCandidates(body.candidates)

          return handleCors(
            req,
            new Response(JSON.stringify({ data: { newCount } }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // ============================================================
      // Proxy Download Endpoint (for CORS bypass)
      // ============================================================

      // GET /api/proxy/head - Cheap change-check for a whitelisted external file.
      // Issues a HEAD and returns last-modified / etag / content-length so the
      // background discovery sync can skip re-downloading an unchanged catalog.
      if (req.method === 'GET' && url.pathname === '/api/proxy/head') {
        const permError = checkPermission('songs.create')
        if (permError) return permError

        const targetUrl = url.searchParams.get('url')
        if (!targetUrl) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Missing url parameter' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        const allowedDomains = [
          'download.resursecrestine.ro',
          'resursecrestine.ro',
        ]
        let parsedHeadUrl: URL
        try {
          parsedHeadUrl = new URL(targetUrl)
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid URL' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
        if (!allowedDomains.includes(parsedHeadUrl.hostname)) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({ error: 'Domain not allowed for proxy head' }),
              {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }

        try {
          const headResponse = await fetch(targetUrl, {
            method: 'HEAD',
            redirect: 'follow',
          })
          return handleCors(
            req,
            new Response(
              JSON.stringify({
                data: {
                  lastModified: headResponse.headers.get('last-modified'),
                  etag: headResponse.headers.get('etag'),
                  contentLength: headResponse.headers.get('content-length'),
                },
              }),
              { headers: { 'Content-Type': 'application/json' } },
            ),
          )
        } catch (error) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({ error: `Head request failed: ${error}` }),
              {
                status: 502,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // GET /api/proxy/download - Proxy download from external URL
      if (req.method === 'GET' && url.pathname === '/api/proxy/download') {
        const permError = checkPermission('songs.create')
        if (permError) return permError

        const targetUrl = url.searchParams.get('url')
        if (!targetUrl) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Missing url parameter' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        // Only allow specific trusted domains
        const allowedDomains = [
          'download.resursecrestine.ro',
          'resursecrestine.ro',
        ]
        let parsedUrl: URL
        try {
          parsedUrl = new URL(targetUrl)
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid URL' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        if (!allowedDomains.includes(parsedUrl.hostname)) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({
                error: 'Domain not allowed for proxy download',
              }),
              {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }

        try {
          const proxyStart = performance.now()

          // Forward the client's Range header so the client can download in small
          // chunks (bytes=start-end). Chunked download is what makes progress
          // reliable: in-runtime streaming of a single big body proved unreliable
          // (the client sat at 0% while the body buffered), but each ranged chunk
          // is a small, complete request that returns fast — so the bar advances
          // chunk by chunk regardless of streaming support.
          const rangeHeader = req.headers.get('Range')
          // biome-ignore lint/suspicious/noConsole: logging
          console.log(
            `[INFO] [proxy] Downloading from ${targetUrl}${rangeHeader ? ` (${rangeHeader})` : ''}`,
          )

          const response = await fetch(targetUrl, {
            method: 'GET',
            redirect: 'follow',
            // 60s per chunk is plenty (a chunk is a couple of MB); also guards a
            // dead upstream so the request can't hang forever.
            signal: AbortSignal.timeout(60_000),
            headers: rangeHeader ? { Range: rangeHeader } : undefined,
          })

          // 200 (full) and 206 (partial) are both success.
          if (!response.ok) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({
                  error: `Failed to download: ${response.status} ${response.statusText}`,
                }),
                {
                  status: response.status,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Buffer the (small) chunk and return it as a complete response. For a
          // ranged request this is ~a couple of MB and returns near-instantly.
          const data = await response.arrayBuffer()

          const proxyHeaders: Record<string, string> = {
            'Content-Type':
              response.headers.get('Content-Type') ||
              'application/octet-stream',
            'Content-Length': data.byteLength.toString(),
            'Accept-Ranges': 'bytes',
            'Access-Control-Expose-Headers':
              'Content-Length, X-Content-Length, Content-Range, Accept-Ranges',
          }
          // Pass through Content-Range so the client can read the TOTAL size from
          // "bytes start-end/total" even on a partial response.
          const contentRange = response.headers.get('Content-Range')
          if (contentRange) proxyHeaders['Content-Range'] = contentRange
          // Mirror the full size into a custom header the runtime keeps. On a
          // non-ranged 200 this is the total; on a 206 the client prefers
          // Content-Range's total.
          const fullLength = response.headers.get('Content-Length')
          if (!contentRange && fullLength) {
            proxyHeaders['X-Content-Length'] = fullLength
          }

          // biome-ignore lint/suspicious/noConsole: logging
          console.log(
            `[INFO] [proxy] Sent ${(data.byteLength / 1024 / 1024).toFixed(2)}MB (status ${response.status}) in ${(performance.now() - proxyStart).toFixed(0)}ms`,
          )

          return handleCors(
            req,
            new Response(data, {
              status: response.status,
              headers: proxyHeaders,
            }),
          )
        } catch (error) {
          // biome-ignore lint/suspicious/noConsole: logging
          console.error(`[ERROR] [proxy] Download failed: ${error}`)
          return handleCors(
            req,
            new Response(
              JSON.stringify({ error: `Download failed: ${String(error)}` }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // ============================================================
      // File Conversion API Endpoints
      // ============================================================

      // GET /api/convert/check-libreoffice - Check if PPT conversion is available
      // PPT conversion is now built-in (pure JS), no external dependencies needed
      if (
        req.method === 'GET' &&
        url.pathname === '/api/convert/check-libreoffice'
      ) {
        const permError = checkPermission('songs.view')
        if (permError) return permError

        return handleCors(
          req,
          new Response(JSON.stringify({ data: { installed: true } }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/convert/ppt-to-pptx - Parse PPT and return slides
      // Now uses pure JS parsing instead of LibreOffice conversion
      if (
        req.method === 'POST' &&
        url.pathname === '/api/convert/ppt-to-pptx'
      ) {
        const permError = checkPermission('songs.create')
        if (permError) return permError

        try {
          const body = (await req.json()) as {
            data: string
            filename?: string
          }

          if (!body.data) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing PPT data' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          // Decode base64 to Buffer
          const pptBuffer = Buffer.from(body.data, 'base64')

          // Parse PPT directly (no LibreOffice needed)
          const result = await parsePptFile(pptBuffer, body.filename)

          if (!result.success) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: result.error }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          return handleCors(
            req,
            new Response(
              JSON.stringify({
                data: {
                  title: result.title,
                  slides: result.slides,
                },
              }),
              {
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'PPT parsing failed' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // DELETE /api/songs/bulk - Delete multiple songs
      if (req.method === 'DELETE' && url.pathname === '/api/songs/bulk') {
        const permError = checkPermission('songs.delete')
        if (permError) return permError

        try {
          const body = (await req.json()) as { ids: number[] }

          if (!body.ids || !Array.isArray(body.ids)) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing ids array' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const result = deleteSongsByIds(body.ids)

          if (!result.success) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: result.error }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          // Remove from search index
          for (const id of body.ids) {
            removeFromSearchIndex(id)
          }

          return handleCors(
            req,
            new Response(
              JSON.stringify({
                data: { success: true, deletedCount: result.deletedCount },
              }),
              {
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        } catch (_error) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid request body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // POST /api/songs/:id/reset-presentation-count - Reset presentation count to 0
      const resetCountMatch = url.pathname.match(
        /^\/api\/songs\/(\d+)\/reset-presentation-count$/,
      )
      if (req.method === 'POST' && resetCountMatch?.[1]) {
        const permError = checkPermission('songs.edit')
        if (permError) return permError

        const id = parseInt(resetCountMatch[1], 10)
        const result = resetSongPresentationCount(id)

        if (!result) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Song not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ data: result }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // DELETE /api/songs/:id - Delete song
      const deleteSongMatch = url.pathname.match(/^\/api\/songs\/(\d+)$/)
      if (req.method === 'DELETE' && deleteSongMatch?.[1]) {
        const permError = checkPermission('songs.delete')
        if (permError) return permError

        const id = parseInt(deleteSongMatch[1], 10)
        const result = deleteSong(id)

        if (!result.success) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: result.error }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        // Remove from search index
        removeFromSearchIndex(id)

        return handleCors(
          req,
          new Response(JSON.stringify({ data: { success: true } }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // ============================================================
      // Song Groups (Versions) API Endpoints
      // ============================================================

      // GET /api/songs/:id/similar - Surface candidate version matches.
      // Query: ?limit=5 (defaults to 5, capped at 20).
      const similarMatch = url.pathname.match(/^\/api\/songs\/(\d+)\/similar$/)
      if (req.method === 'GET' && similarMatch?.[1]) {
        const permError = checkPermission('song_versions.view')
        if (permError) return permError

        const songId = parseInt(similarMatch[1], 10)
        const rawLimit = parseInt(url.searchParams.get('limit') ?? '5', 10)
        const limit = Math.min(20, Math.max(1, rawLimit || 5))
        const suggestions = getSimilarSongs(songId, limit)

        return handleCors(
          req,
          new Response(JSON.stringify({ data: suggestions }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/songs/:id/group - Get the group for a song, or null if standalone.
      const songGroupMatch = url.pathname.match(/^\/api\/songs\/(\d+)\/group$/)
      if (req.method === 'GET' && songGroupMatch?.[1]) {
        const permError = checkPermission('song_versions.view')
        if (permError) return permError

        const songId = parseInt(songGroupMatch[1], 10)
        const group = getGroupForSong(songId)

        return handleCors(
          req,
          new Response(JSON.stringify({ data: group }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/song-groups/:id - Get a group with its members.
      const getGroupMatch = url.pathname.match(/^\/api\/song-groups\/(\d+)$/)
      if (req.method === 'GET' && getGroupMatch?.[1]) {
        const permError = checkPermission('song_versions.view')
        if (permError) return permError

        const groupId = parseInt(getGroupMatch[1], 10)
        const group = getSongGroupWithMembers(groupId)

        if (!group) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Group not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ data: group }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/song-groups/link - Link two songs as versions of the same piece.
      // Body: { songIdA: number, songIdB: number }
      // Idempotent: if both are already grouped together, returns the existing group.
      if (req.method === 'POST' && url.pathname === '/api/song-groups/link') {
        const permError = checkPermission('song_versions.create')
        if (permError) return permError

        try {
          const body = (await req.json()) as {
            songIdA?: number
            songIdB?: number
          }

          if (
            typeof body.songIdA !== 'number' ||
            typeof body.songIdB !== 'number'
          ) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({
                  error: 'songIdA and songIdB are required numbers',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          const groupId = linkSongs(body.songIdA, body.songIdB)
          const group = getSongGroupWithMembers(groupId)

          return handleCors(
            req,
            new Response(JSON.stringify({ data: group }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch (error) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: String(error) }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // POST /api/song-groups/:id/primary - Set the primary member of a group.
      // Body: { songId: number }
      const setPrimaryMatch = url.pathname.match(
        /^\/api\/song-groups\/(\d+)\/primary$/,
      )
      if (req.method === 'POST' && setPrimaryMatch?.[1]) {
        const permError = checkPermission('song_versions.edit')
        if (permError) return permError

        try {
          const groupId = parseInt(setPrimaryMatch[1], 10)
          const body = (await req.json()) as { songId?: number }

          if (typeof body.songId !== 'number') {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'songId is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const result = setPrimarySong(groupId, body.songId)
          if (!result.success) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: result.error }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const group = getSongGroupWithMembers(groupId)
          return handleCors(
            req,
            new Response(JSON.stringify({ data: group }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch (error) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: String(error) }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // DELETE /api/songs/:id/group - Remove a song from its group ("Not the same song").
      // Collapses the group if only one member would remain.
      const unlinkMatch = url.pathname.match(/^\/api\/songs\/(\d+)\/group$/)
      if (req.method === 'DELETE' && unlinkMatch?.[1]) {
        const permError = checkPermission('song_versions.delete')
        if (permError) return permError

        const songId = parseInt(unlinkMatch[1], 10)
        const result = unlinkSong(songId)

        if (!result.success) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: result.error }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ data: { success: true } }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // ============================================================
      // Song Slides API Endpoints
      // ============================================================

      // POST /api/song-slides - Create/update song slide
      if (req.method === 'POST' && url.pathname === '/api/song-slides') {
        const permError = checkPermission('songs.edit')
        if (permError) return permError

        try {
          const body = (await req.json()) as UpsertSongSlideInput

          if (!body.songId || body.content === undefined) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({ error: 'Missing songId or content' }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          const slide = upsertSongSlide(body)

          if (!slide) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Failed to save slide' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          // Update search index for the song
          updateSearchIndex(body.songId)

          // Broadcast song update so LivePreview syncs in real-time
          broadcastSongUpdated(body.songId)

          // Refresh presented song slides if this song is currently being presented
          const refreshedState = refreshPresentedSongSlides(body.songId)
          if (refreshedState) {
            broadcastPresentationState(refreshedState)
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: slide }), {
              status: body.id ? 200 : 201,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // DELETE /api/song-slides/:id - Delete song slide
      const deleteSongSlideMatch = url.pathname.match(
        /^\/api\/song-slides\/(\d+)$/,
      )
      if (req.method === 'DELETE' && deleteSongSlideMatch?.[1]) {
        const permError = checkPermission('songs.edit')
        if (permError) return permError

        const id = parseInt(deleteSongSlideMatch[1], 10)

        // Get the slide's songId before deleting for broadcast
        const slideToDelete = getSongSlideById(id)
        const result = deleteSongSlide(id)

        if (!result.success) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: result.error }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        // Broadcast song update so LivePreview syncs in real-time
        if (slideToDelete) {
          broadcastSongUpdated(slideToDelete.songId)
          const refreshedState = refreshPresentedSongSlides(
            slideToDelete.songId,
          )
          if (refreshedState) {
            broadcastPresentationState(refreshedState)
          }
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ data: { success: true } }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/song-slides/:id/clone - Clone song slide
      const cloneSongSlideMatch = url.pathname.match(
        /^\/api\/song-slides\/(\d+)\/clone$/,
      )
      if (req.method === 'POST' && cloneSongSlideMatch?.[1]) {
        const permError = checkPermission('songs.edit')
        if (permError) return permError

        const id = parseInt(cloneSongSlideMatch[1], 10)
        const clonedSlide = cloneSongSlide(id)

        if (!clonedSlide) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Failed to clone slide' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        // Update search index
        updateSearchIndex(clonedSlide.songId)

        return handleCors(
          req,
          new Response(JSON.stringify({ data: clonedSlide }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // PUT /api/songs/:id/slides/reorder - Reorder song slides
      const reorderSongSlidesMatch = url.pathname.match(
        /^\/api\/songs\/(\d+)\/slides\/reorder$/,
      )
      if (req.method === 'PUT' && reorderSongSlidesMatch?.[1]) {
        const permError = checkPermission('songs.edit')
        if (permError) return permError

        try {
          const songId = parseInt(reorderSongSlidesMatch[1], 10)
          const body = (await req.json()) as ReorderSongSlidesInput

          if (!body.slideIds || !Array.isArray(body.slideIds)) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({ error: 'Missing slideIds array' }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          const result = reorderSongSlides(songId, body)

          if (!result.success) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: result.error }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          // Broadcast song update so LivePreview syncs in real-time
          broadcastSongUpdated(songId)
          const refreshedState = refreshPresentedSongSlides(songId)
          if (refreshedState) {
            broadcastPresentationState(refreshedState)
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: { success: true } }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // ============================================================
      // Bible API Endpoints
      // ============================================================

      // GET /api/bible/available - Proxy for Holy-Bible-XML-Format bibles.xml (avoids CORS)
      if (req.method === 'GET' && url.pathname === '/api/bible/available') {
        const permError = checkPermission('bible.view')
        if (permError) return permError

        try {
          const biblesXmlUrl =
            'https://github.com/radio-crestin/Holy-Bible-XML-Format/releases/latest/download/bibles.xml'
          const response = await fetch(biblesXmlUrl)

          if (!response.ok) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({ error: 'Failed to fetch available Bibles' }),
                {
                  status: 502,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          const xmlContent = await response.text()
          return handleCors(
            req,
            new Response(xmlContent, {
              headers: { 'Content-Type': 'application/xml' },
            }),
          )
        } catch (_error) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({ error: 'Failed to fetch available Bibles' }),
              {
                status: 502,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // GET /api/bible/download - Proxy for downloading Bible XML files (avoids CORS)
      if (req.method === 'GET' && url.pathname === '/api/bible/download') {
        const permError = checkPermission('bible.import')
        if (permError) return permError

        const downloadUrl = url.searchParams.get('url')
        if (!downloadUrl) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Missing url parameter' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        // Validate URL is from Holy-Bible-XML-Format repository
        const allowedHosts = [
          'github.com/radio-crestin/Holy-Bible-XML-Format',
          'raw.githubusercontent.com/radio-crestin/Holy-Bible-XML-Format',
        ]
        const isAllowedUrl = allowedHosts.some((host) =>
          downloadUrl.includes(host),
        )

        if (!isAllowedUrl) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({
                error:
                  'URL not allowed. Only Holy-Bible-XML-Format repository URLs are permitted.',
              }),
              {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }

        try {
          const response = await fetch(downloadUrl)

          if (!response.ok) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({
                  error: `Failed to download Bible: ${response.statusText}`,
                }),
                {
                  status: 502,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          const xmlContent = await response.text()
          return handleCors(
            req,
            new Response(xmlContent, {
              headers: { 'Content-Type': 'application/xml' },
            }),
          )
        } catch (_error) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({ error: 'Failed to download Bible file' }),
              {
                status: 502,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // GET /api/bible/translations - List all translations
      if (req.method === 'GET' && url.pathname === '/api/bible/translations') {
        const permError = checkPermission('bible.view')
        if (permError) return permError

        try {
          const translations = getAllTranslations()
          return handleCors(
            req,
            new Response(JSON.stringify({ data: translations }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch (error) {
          logger.error('Error fetching translations: ' + JSON.stringify(error))
          return handleCors(
            req,
            new Response(
              JSON.stringify({
                error:
                  error instanceof Error
                    ? error.message
                    : 'Failed to fetch translations',
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // GET /api/bible/translations/:id - Get single translation
      const getTranslationMatch = url.pathname.match(
        /^\/api\/bible\/translations\/(\d+)$/,
      )
      if (req.method === 'GET' && getTranslationMatch?.[1]) {
        const permError = checkPermission('bible.view')
        if (permError) return permError

        try {
          const id = parseInt(getTranslationMatch[1], 10)
          const translation = getTranslationById(id)

          if (!translation) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Translation not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: translation }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch (error) {
          logger.error('Error fetching translation: ' + JSON.stringify(error))
          return handleCors(
            req,
            new Response(
              JSON.stringify({
                error:
                  error instanceof Error
                    ? error.message
                    : 'Failed to fetch translation',
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // POST /api/bible/translations - Import new translation
      if (req.method === 'POST' && url.pathname === '/api/bible/translations') {
        const permError = checkPermission('bible.import')
        if (permError) return permError

        try {
          const body = (await req.json()) as CreateTranslationInput

          if (
            !body.name ||
            !body.abbreviation ||
            !body.language ||
            !body.xmlContent
          ) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({
                  error:
                    'Missing required fields: name, abbreviation, language, xmlContent',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          const result = importBibleTranslation(body)

          if (!result.success) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: result.error }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: result.translation }), {
              status: 201,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // DELETE /api/bible/translations/:id - Delete translation
      const deleteTranslationMatch = url.pathname.match(
        /^\/api\/bible\/translations\/(\d+)$/,
      )
      if (req.method === 'DELETE' && deleteTranslationMatch?.[1]) {
        const permError = checkPermission('bible.delete')
        if (permError) return permError

        const id = parseInt(deleteTranslationMatch[1], 10)
        const result = deleteTranslation(id)

        if (!result.success) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: result.error }), {
              status: result.error === 'Translation not found' ? 404 : 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ data: { success: true } }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/bible/books/:translationId - Get books for translation
      const getBooksMatch = url.pathname.match(/^\/api\/bible\/books\/(\d+)$/)
      if (req.method === 'GET' && getBooksMatch?.[1]) {
        const permError = checkPermission('bible.view')
        if (permError) return permError

        try {
          const translationId = parseInt(getBooksMatch[1], 10)
          const books = getBooksByTranslation(translationId)

          return handleCors(
            req,
            new Response(JSON.stringify({ data: books }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch (error) {
          logger.error('Error fetching books: ' + JSON.stringify(error))
          return handleCors(
            req,
            new Response(
              JSON.stringify({
                error:
                  error instanceof Error
                    ? error.message
                    : 'Failed to fetch books',
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // GET /api/bible/chapters/:bookId - Get chapters for book
      const getChaptersMatch = url.pathname.match(
        /^\/api\/bible\/chapters\/(\d+)$/,
      )
      if (req.method === 'GET' && getChaptersMatch?.[1]) {
        const permError = checkPermission('bible.view')
        if (permError) return permError

        try {
          const bookId = parseInt(getChaptersMatch[1], 10)
          const chapters = getChaptersForBook(bookId)

          return handleCors(
            req,
            new Response(JSON.stringify({ data: chapters }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch (error) {
          logger.error('Error fetching chapters: ' + JSON.stringify(error))
          return handleCors(
            req,
            new Response(
              JSON.stringify({
                error:
                  error instanceof Error
                    ? error.message
                    : 'Failed to fetch chapters',
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // GET /api/bible/verses/:bookId/:chapter - Get verses for chapter
      const getVersesMatch = url.pathname.match(
        /^\/api\/bible\/verses\/(\d+)\/(\d+)$/,
      )
      if (req.method === 'GET' && getVersesMatch?.[1] && getVersesMatch?.[2]) {
        const permError = checkPermission('bible.view')
        if (permError) return permError

        try {
          const bookId = parseInt(getVersesMatch[1], 10)
          const chapter = parseInt(getVersesMatch[2], 10)
          const verses = getVersesByChapter(bookId, chapter)

          return handleCors(
            req,
            new Response(JSON.stringify({ data: verses }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch (error) {
          logger.error('Error fetching verses: ' + JSON.stringify(error))
          return handleCors(
            req,
            new Response(
              JSON.stringify({
                error:
                  error instanceof Error
                    ? error.message
                    : 'Failed to fetch verses',
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // GET /api/bible/verse/:verseId - Get single verse by ID
      const getVerseMatch = url.pathname.match(/^\/api\/bible\/verse\/(\d+)$/)
      if (req.method === 'GET' && getVerseMatch?.[1]) {
        const permError = checkPermission('bible.view')
        if (permError) return permError

        try {
          const verseId = parseInt(getVerseMatch[1], 10)
          const verse = getVerseById(verseId)

          if (!verse) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Verse not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: verse }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch (error) {
          logger.error('Error fetching verse: ' + JSON.stringify(error))
          return handleCors(
            req,
            new Response(
              JSON.stringify({
                error:
                  error instanceof Error
                    ? error.message
                    : 'Failed to fetch verse',
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // GET /api/bible/next-verse/:verseId - Get next sequential verse
      const getNextVerseMatch = url.pathname.match(
        /^\/api\/bible\/next-verse\/(\d+)$/,
      )
      if (req.method === 'GET' && getNextVerseMatch?.[1]) {
        const permError = checkPermission('bible.view')
        if (permError) return permError

        try {
          const verseId = parseInt(getNextVerseMatch[1], 10)
          const nextVerse = getNextVerse(verseId)

          return handleCors(
            req,
            new Response(JSON.stringify({ data: nextVerse }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch (error) {
          logger.error('Error fetching next verse: ' + JSON.stringify(error))
          return handleCors(
            req,
            new Response(
              JSON.stringify({
                error:
                  error instanceof Error
                    ? error.message
                    : 'Failed to fetch next verse',
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // GET /api/bible/verse-by-reference/:translationId/:bookCode/:chapter/:verse - Get verse by reference
      const getVerseByRefMatch = url.pathname.match(
        /^\/api\/bible\/verse-by-reference\/(\d+)\/([A-Za-z0-9]+)\/(\d+)\/(\d+)$/,
      )
      if (
        req.method === 'GET' &&
        getVerseByRefMatch?.[1] &&
        getVerseByRefMatch?.[2] &&
        getVerseByRefMatch?.[3] &&
        getVerseByRefMatch?.[4]
      ) {
        const permError = checkPermission('bible.view')
        if (permError) return permError

        try {
          const translationId = parseInt(getVerseByRefMatch[1], 10)
          const bookCode = getVerseByRefMatch[2]
          const chapter = parseInt(getVerseByRefMatch[3], 10)
          const verseNumber = parseInt(getVerseByRefMatch[4], 10)
          const verse = getVerse(translationId, bookCode, chapter, verseNumber)

          return handleCors(
            req,
            new Response(JSON.stringify({ data: verse }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch (error) {
          logger.error(
            'Error fetching verse by reference: ' + JSON.stringify(error),
          )
          return handleCors(
            req,
            new Response(
              JSON.stringify({
                error:
                  error instanceof Error
                    ? error.message
                    : 'Failed to fetch verse',
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // GET /api/bible/search - Search verses (by reference or text)
      if (req.method === 'GET' && url.pathname === '/api/bible/search') {
        const permError = checkPermission('bible.view')
        if (permError) return permError

        try {
          const query = url.searchParams.get('q') || ''
          const translationIdParam = url.searchParams.get('translationId')
          const limitParam = url.searchParams.get('limit')

          const input: SearchVersesInput = {
            query,
            translationId: translationIdParam
              ? parseInt(translationIdParam, 10)
              : undefined,
            limit: limitParam ? parseInt(limitParam, 10) : 50,
          }

          const result = searchBible(input)

          return handleCors(
            req,
            new Response(
              JSON.stringify({
                data: {
                  type: result.type,
                  results: result.results,
                },
              }),
              {
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        } catch (error) {
          logger.error('Error searching Bible: ' + JSON.stringify(error))
          return handleCors(
            req,
            new Response(
              JSON.stringify({
                error:
                  error instanceof Error
                    ? error.message
                    : 'Failed to search Bible',
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // POST /api/bible/ai-search - AI-enhanced semantic search
      if (req.method === 'POST' && url.pathname === '/api/bible/ai-search') {
        const permError = checkPermission('bible.view')
        if (permError) return permError

        const body = (await req.json()) as {
          query?: string
          translationId?: number
        }

        if (!body.query || typeof body.query !== 'string') {
          return handleCors(
            req,
            new Response(
              JSON.stringify({ error: 'Query parameter is required' }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }

        try {
          const result = await aiBibleSearch({
            query: body.query,
            translationId: body.translationId,
          })

          return handleCors(
            req,
            new Response(JSON.stringify({ data: result }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'AI search failed'
          return handleCors(
            req,
            new Response(JSON.stringify({ error: message }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // ============================================================
      // Song Categories API Endpoints
      // ============================================================

      // GET /api/categories - List all categories
      if (req.method === 'GET' && url.pathname === '/api/categories') {
        const permError = checkPermission('songs.view')
        if (permError) return permError

        const categories = getAllCategories()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: categories }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/categories - Create/update category
      if (req.method === 'POST' && url.pathname === '/api/categories') {
        try {
          const body = (await req.json()) as UpsertCategoryInput

          // Check create or edit permission based on whether it's a new category
          const permError = checkPermission(
            body.id ? 'songs.edit' : 'songs.create',
          )
          if (permError) return permError

          if (!body.name) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing name' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          // Capture the current name BEFORE updating so we only pay for the
          // (expensive) FTS re-index when the name actually changes.
          const previousName = body.id ? getCategoryById(body.id)?.name : null

          const category = upsertCategory(body)

          if (!category) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({ error: 'Failed to save category' }),
                {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Re-index songs ONLY when the category name actually changed (the
          // FTS index stores category_name). A hide/show toggle leaves names
          // and content untouched, so we skip the costly per-song re-index and
          // just drop the search results cache (its key encodes neither the
          // category name nor the hidden state).
          if (body.id) {
            if (previousName != null && category.name !== previousName) {
              updateSearchIndexByCategory(body.id)
            }
            clearSearchCache()
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: category }), {
              status: body.id ? 200 : 201,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // DELETE /api/categories/uncategorized - Delete all uncategorized songs
      if (
        req.method === 'DELETE' &&
        url.pathname === '/api/categories/uncategorized'
      ) {
        const permError = checkPermission('songs.delete')
        if (permError) return permError

        const result = deleteUncategorizedSongs()

        if (!result.success) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: result.error }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        // Remove deleted songs from search index
        for (const id of result.deletedIds) {
          removeFromSearchIndex(id)
        }

        return handleCors(
          req,
          new Response(
            JSON.stringify({
              data: { success: true, deletedCount: result.deletedCount },
            }),
            {
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        )
      }

      // DELETE /api/categories/:id - Delete category
      const deleteCategoryMatch = url.pathname.match(
        /^\/api\/categories\/(\d+)$/,
      )
      if (req.method === 'DELETE' && deleteCategoryMatch?.[1]) {
        const permError = checkPermission('songs.delete')
        if (permError) return permError

        const id = parseInt(deleteCategoryMatch[1], 10)
        const result = deleteCategory(id)

        if (!result.success) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: result.error }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ data: { success: true } }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // PUT /api/categories/reorder - Reorder categories by priority
      if (req.method === 'PUT' && url.pathname === '/api/categories/reorder') {
        const permError = checkPermission('songs.edit')
        if (permError) return permError

        try {
          const body = (await req.json()) as ReorderCategoriesInput

          if (!body.categoryIds || !Array.isArray(body.categoryIds)) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({ error: 'Missing categoryIds array' }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          const result = reorderCategories(body)

          if (!result.success) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: result.error }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: { success: true } }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // ============================================================
      // Song Tags API Endpoints
      // ============================================================

      // GET /api/song-tags - List all tags
      if (req.method === 'GET' && url.pathname === '/api/song-tags') {
        const permError = checkPermission('songs.view')
        if (permError) return permError

        const tags = getAllTags()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: tags }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/song-tags - Create/update tag
      if (req.method === 'POST' && url.pathname === '/api/song-tags') {
        try {
          const body = (await req.json()) as UpsertTagInput

          // Creating and renaming tags is part of editing a song's metadata:
          // the TagPicker lets a song editor add a new tag inline while editing.
          // There is no separate tag permission, so both create and update are
          // gated by songs.edit rather than songs.create — otherwise a user who
          // can edit songs still can't attach a brand-new tag.
          const permError = checkPermission('songs.edit')
          if (permError) return permError

          if (!body.name) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing name' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const tag = upsertTag(body)

          if (!tag) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Failed to save tag' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: tag }), {
              status: body.id ? 200 : 201,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // PUT /api/song-tags/reorder - Reorder tags
      if (req.method === 'PUT' && url.pathname === '/api/song-tags/reorder') {
        const permError = checkPermission('songs.edit')
        if (permError) return permError

        try {
          const body = (await req.json()) as ReorderTagsInput

          if (!body.tagIds || !Array.isArray(body.tagIds)) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing tagIds array' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const result = reorderTags(body)

          if (!result.success) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: result.error }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: { success: true } }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // DELETE /api/song-tags/:id - Delete tag (assignments cascade)
      const deleteTagMatch = url.pathname.match(/^\/api\/song-tags\/(\d+)$/)
      if (req.method === 'DELETE' && deleteTagMatch?.[1]) {
        const permError = checkPermission('songs.delete')
        if (permError) return permError

        const id = parseInt(deleteTagMatch[1], 10)
        const result = deleteTag(id)

        if (!result.success) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: result.error }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ data: { success: true } }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // ============================================================
      // Bible History API Endpoints
      // ============================================================

      // GET /api/bible-history - Get all history items
      if (req.method === 'GET' && url.pathname === '/api/bible-history') {
        const permError = checkPermission('bible.view')
        if (permError) return permError

        const items = getHistory()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: items }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/bible-history - Add verse to history
      if (req.method === 'POST' && url.pathname === '/api/bible-history') {
        const permError = checkPermission('bible.view')
        if (permError) return permError

        try {
          const body = (await req.json()) as AddToHistoryInput
          const result = addToHistory(body)

          if ('error' in result) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: result.error }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: result.data }), {
              status: 201,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // DELETE /api/bible-history - Clear all history
      if (req.method === 'DELETE' && url.pathname === '/api/bible-history') {
        const permError = checkPermission('bible.view')
        if (permError) return permError

        const result = clearHistory()
        return handleCors(
          req,
          new Response(JSON.stringify({ success: result.success }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // ============================================================
      // Song Bookmarks API Endpoints
      // ============================================================

      // GET /api/song-bookmarks - Get all bookmarks
      if (req.method === 'GET' && url.pathname === '/api/song-bookmarks') {
        const permError = checkPermission('songs.view')
        if (permError) return permError

        const items = getBookmarks()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: items }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/song-bookmarks - Add bookmark
      if (req.method === 'POST' && url.pathname === '/api/song-bookmarks') {
        const permError = checkPermission('songs.view')
        if (permError) return permError

        try {
          const body = (await req.json()) as { songId: number }
          const result = addBookmark(body.songId)

          if ('error' in result) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: result.error }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: result.data }), {
              status: 201,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid request body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // PUT /api/song-bookmarks/reorder - Reorder bookmarks
      if (
        req.method === 'PUT' &&
        url.pathname === '/api/song-bookmarks/reorder'
      ) {
        const permError = checkPermission('songs.view')
        if (permError) return permError

        try {
          const body = (await req.json()) as { songIds: number[] }
          const result = reorderBookmarks(body.songIds)
          return handleCors(
            req,
            new Response(JSON.stringify({ success: result.success }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid request body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // DELETE /api/song-bookmarks/:songId - Remove single bookmark
      if (
        req.method === 'DELETE' &&
        url.pathname.startsWith('/api/song-bookmarks/')
      ) {
        const permError = checkPermission('songs.view')
        if (permError) return permError

        const songId = Number(url.pathname.split('/').pop())
        if (Number.isNaN(songId)) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid song ID' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        const result = removeBookmark(songId)
        return handleCors(
          req,
          new Response(JSON.stringify({ success: result.success }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // DELETE /api/song-bookmarks - Clear all bookmarks
      if (req.method === 'DELETE' && url.pathname === '/api/song-bookmarks') {
        const permError = checkPermission('songs.view')
        if (permError) return permError

        const result = clearBookmarks()
        return handleCors(
          req,
          new Response(JSON.stringify({ success: result.success }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // ============================================================
      // Song Bookmark Notes API Endpoints
      // ============================================================

      // GET /api/song-bookmark-notes - Get all bookmark notes
      if (req.method === 'GET' && url.pathname === '/api/song-bookmark-notes') {
        const permError = checkPermission('songs.view')
        if (permError) return permError

        const items = getBookmarkNotes()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: items }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/song-bookmark-notes - Add bookmark note
      if (
        req.method === 'POST' &&
        url.pathname === '/api/song-bookmark-notes'
      ) {
        const permError = checkPermission('songs.view')
        if (permError) return permError

        try {
          const body = (await req.json()) as { content: string }
          const result = addBookmarkNote(body.content)

          if ('error' in result) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: result.error }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: result.data }), {
              status: 201,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid request body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // PUT /api/song-bookmark-notes/:id - Update bookmark note
      if (
        req.method === 'PUT' &&
        url.pathname.startsWith('/api/song-bookmark-notes/') &&
        !url.pathname.endsWith('/reorder')
      ) {
        const permError = checkPermission('songs.view')
        if (permError) return permError

        const id = Number(url.pathname.split('/').pop())
        if (Number.isNaN(id)) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid note ID' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        try {
          const body = (await req.json()) as { content: string }
          const result = updateBookmarkNote(id, body.content)
          return handleCors(
            req,
            new Response(JSON.stringify({ success: result.success }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid request body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // DELETE /api/song-bookmark-notes/:id - Remove bookmark note
      if (
        req.method === 'DELETE' &&
        url.pathname.startsWith('/api/song-bookmark-notes/')
      ) {
        const permError = checkPermission('songs.view')
        if (permError) return permError

        const id = Number(url.pathname.split('/').pop())
        if (Number.isNaN(id)) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid note ID' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        const result = removeBookmarkNote(id)
        return handleCors(
          req,
          new Response(JSON.stringify({ success: result.success }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // PUT /api/song-bookmarks/reorder-items - Reorder both bookmarks and notes
      if (
        req.method === 'PUT' &&
        url.pathname === '/api/song-bookmarks/reorder-items'
      ) {
        const permError = checkPermission('songs.view')
        if (permError) return permError

        try {
          const body = (await req.json()) as { items: BookmarkItemRef[] }
          const result = reorderBookmarkItems(body.items)
          return handleCors(
            req,
            new Response(JSON.stringify({ success: result.success }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid request body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // GET /api/song-bookmarks/export - Export bookmarks as text
      if (
        req.method === 'GET' &&
        url.pathname === '/api/song-bookmarks/export'
      ) {
        const permError = checkPermission('songs.view')
        if (permError) return permError

        const text = exportBookmarksAsText()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: text }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // ============================================================
      // Search History API Endpoints
      // ============================================================

      // GET /api/search-history?id=... or ?urlPath=... - Get search history by ID or URL path
      if (req.method === 'GET' && url.pathname === '/api/search-history') {
        const permError = checkPermission('songs.view')
        if (permError) return permError

        const id = url.searchParams.get('id')
        const urlPath = url.searchParams.get('urlPath')

        if (!id && !urlPath) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({ error: 'id or urlPath is required' }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }

        // Prefer ID if provided
        const result = id
          ? getSearchById(parseInt(id, 10))
          : getSearchByUrlPath(urlPath as string)

        if ('error' in result) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: result.error }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ data: result.data }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/search-history - Save a search to history
      if (req.method === 'POST' && url.pathname === '/api/search-history') {
        const permError = checkPermission('songs.view')
        if (permError) return permError

        try {
          const body = (await req.json()) as SaveSearchInput
          const result = saveSearch(body)

          if ('error' in result) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: result.error }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: result.data }), {
              status: 201,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // DELETE /api/search-history?urlPath=... - Delete search history entry
      if (req.method === 'DELETE' && url.pathname === '/api/search-history') {
        const permError = checkPermission('songs.view')
        if (permError) return permError

        const urlPath = url.searchParams.get('urlPath')
        if (!urlPath) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'urlPath is required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        const result = deleteSearch(urlPath)
        return handleCors(
          req,
          new Response(JSON.stringify({ success: result.success }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // ============================================================
      // Feedback API Endpoint (proxies to Cloudflare worker)
      // ============================================================

      // POST /api/feedback/attach-logs - Upload server + Tauri log tails to
      // PostHog under a ticket_id created by `posthog.conversations.sendMessage`
      // on the client. The maintainer opens the ticket in PostHog and finds
      // the logs attached as a separate `$feedback_logs` event keyed by the
      // same distinct_id (the ticket_id).
      if (
        req.method === 'POST' &&
        url.pathname === '/api/feedback/attach-logs'
      ) {
        try {
          const body = (await req.json()) as {
            ticketId?: string
            osVersion?: string
            appVersion?: string
          }
          if (!body.ticketId || typeof body.ticketId !== 'string') {
            return handleCors(
              req,
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'ticketId is required',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          try {
            const logs = await readRecentLogs()
            captureFeedbackReport(body.ticketId, {
              ticket_id: body.ticketId,
              os_version: body.osVersion ?? 'unknown',
              app_version: body.appVersion ?? 'unknown',
              server_log_tail: logs.serverTail,
              tauri_log_tail: logs.tauriTail,
              logs_dir: logs.logsDir,
            })
            // Force flush so the logs are durable before we return — the
            // client may close the modal immediately, and Bun's process can
            // be terminated by a Tauri restart.
            await flushPostHog()
          } catch (logErr) {
            captureExceptionPostHog(logErr, { source: 'feedback_log_capture' })
          }

          return handleCors(
            req,
            new Response(
              JSON.stringify({ success: true, ticketId: body.ticketId }),
              { headers: { 'Content-Type': 'application/json' } },
            ),
          )
        } catch {
          return handleCors(
            req,
            new Response(
              JSON.stringify({
                success: false,
                error: 'Failed to attach logs',
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // Livestream routes (YouTube, OBS integration)
      const livestreamResponse = await handleLivestreamRoutes(
        req,
        url,
        handleCors,
      )
      if (livestreamResponse) return livestreamResponse

      // MIDI routes
      const midiResponse = await handleMIDIRoutes(req, url, handleCors)
      if (midiResponse) return midiResponse

      // Live translation routes
      if (url.pathname.startsWith('/api/live-translation/')) {
        const translationResponse = await handleLiveTranslationRoutes(
          req,
          url,
          _context!,
        )
        if (translationResponse) return handleCors(req, translationResponse)
      }

      // Music routes (folders, files, playlists)
      const musicResponse = await handleMusicRoutes(req, url, handleCors)
      if (musicResponse) return musicResponse

      // Serve client app (static files in production, proxy to Vite in development)
      if (canServeStaticFiles && clientDistPath) {
        // Production: serve from bundled static files
        const staticResponse = await serveStaticFile(
          url.pathname,
          clientDistPath,
        )
        if (staticResponse) {
          return handleCors(req, staticResponse)
        }
      } else if (shouldProxyToVite) {
        // Development: proxy to Vite dev server
        return proxyToVite(req)
      }

      return handleCors(req, new Response('Not Found', { status: 404 }))
    },
    websocket: {
      open: handleWebSocketOpen,
      message: handleWebSocketMessage,
      close: handleWebSocketClose,
    },
  })

  logTiming('bun_server_bind', t)

  // biome-ignore lint/suspicious/noConsole: <>
  console.log(`Bun server running at ${server.url}`)

  // Start permanent OBS connection if auto-connect is enabled
  // This must be done AFTER the WebSocket server starts so clients can receive status broadcasts
  t = performance.now()
  initializeOBSAutoConnect()
  logTiming('init_obs_auto_connect', t)

  // Initialize MIDI service (deferred to after server is ready for faster /ping response)
  t = performance.now()
  initializeMIDI()
  logTiming('init_midi', t)

  // Load MIDI shortcuts configuration from database
  t = performance.now()
  loadMIDIShortcuts()
  logTiming('load_midi_shortcuts', t)

  // Wire up MIDI message callback - execute actions directly on server, then broadcast for LED feedback
  setMessageCallback(async (message) => {
    // Execute any mapped shortcut action directly on the server
    await handleMIDIShortcut(message)
    // Still broadcast for client LED feedback
    broadcastMIDIMessage(message)
  })

  // Wire up MIDI connection status callback to WebSocket broadcast
  setConnectionStatusCallback((status) => {
    broadcastMIDIConnectionStatus(status)
  })

  // Wire up MIDI devices changed callback to WebSocket broadcast
  // This is called when devices reconnect so clients can update their device lists
  setDevicesChangedCallback((devices) => {
    broadcastMIDIDevices(devices)
  })

  // Wire up MIDI WebSocket message handler for LED control
  setMIDIMessageHandler((type, payload) => {
    if (type === 'midi_set_led') {
      const { note, on } = payload as { note: number; on: boolean }
      setLED(note, on)
    } else if (type === 'midi_set_all_leds') {
      const { ledStates } = payload as {
        ledStates: Array<{ note: number; on: boolean }>
      }
      setAllLEDs(ledStates)
    }
  })

  // Wire up music player state callback to WebSocket broadcast
  setStateCallback((state) => {
    broadcastMusicState(state)
  })

  // Register music state provider for new WebSocket clients
  setMusicStateProvider(() => getPlayerState())

  // Wire up music player WebSocket command handler (register before init so commands work immediately with default state)
  setMusicCommandHandler(async (type, payload) => {
    switch (type) {
      case 'music_play':
        await executeCommand({ type: 'play' })
        break
      case 'music_pause':
        await executeCommand({ type: 'pause' })
        break
      case 'music_stop':
        await executeCommand({ type: 'stop' })
        break
      case 'music_seek': {
        const { time } = payload as { time: number }
        await executeCommand({ type: 'seek', time })
        break
      }
      case 'music_volume': {
        const { level } = payload as { level: number }
        await executeCommand({ type: 'volume', level })
        break
      }
      case 'music_mute': {
        const { muted } = payload as { muted: boolean }
        await executeCommand({ type: 'mute', muted })
        break
      }
      case 'music_next':
        await executeCommand({ type: 'next' })
        break
      case 'music_previous':
        await executeCommand({ type: 'previous' })
        break
      case 'music_play_index': {
        const { index } = payload as { index: number }
        await executeCommand({ type: 'play_index', index })
        break
      }
      case 'music_play_file': {
        const { fileId } = payload as { fileId: number }
        const file = getFileById(fileId)
        if (file) {
          setNowPlayingQueue([fileId])
          refreshQueueState()
          await executeCommand({ type: 'play_index', index: 0 })
          broadcastMusicState(getPlayerState())
        }
        break
      }
      case 'music_add_to_queue': {
        const { fileIds } = payload as { fileIds: number[] }
        addMultipleToNowPlaying(fileIds)
        refreshQueueState()
        broadcastMusicState(getPlayerState())
        break
      }
      case 'music_remove_from_queue': {
        const { itemId } = payload as { itemId: number }
        removeFromNowPlaying(itemId)
        refreshQueueState()
        broadcastMusicState(getPlayerState())
        break
      }
      case 'music_clear_queue':
        clearNowPlayingQueue()
        await executeCommand({ type: 'stop' })
        refreshQueueState()
        broadcastMusicState(getPlayerState())
        break
      case 'music_set_queue': {
        const { fileIds } = payload as { fileIds: number[] }
        setNowPlayingQueue(fileIds)
        refreshQueueState()
        broadcastMusicState(getPlayerState())
        break
      }
      case 'music_reorder_queue': {
        const { itemIds } = payload as { itemIds: number[] }
        reorderNowPlaying(itemIds)
        refreshQueueState()
        broadcastMusicState(getPlayerState())
        break
      }
      case 'music_shuffle': {
        const { enabled } = payload as { enabled: boolean }
        await executeCommand({ type: 'shuffle', enabled })
        break
      }
      case 'music_get_state':
        refreshQueueState()
        broadcastMusicState(getPlayerState())
        break
    }
  })

  // Initialize Music Player service in background (audio server may take time to become available)
  initializeMusicPlayer().then((available) => {
    if (available) {
      // biome-ignore lint/suspicious/noConsole: Startup timing logs
      console.log('[startup] Music player initialized successfully')
    }
  })

  // Flip boot state to ready — /health now reports `ready:true` and the client
  // transitions from the boot progress screen into the app.
  setBootReady()

  // biome-ignore lint/suspicious/noConsole: Startup timing logs
  console.log(
    `[startup] === Server Ready (total: ${(performance.now() - startupStart).toFixed(1)}ms) ===`,
  )

  // Graceful shutdown
  process.on('SIGINT', async () => {
    clearHistory()
    shutdownMusicPlayer()
    shutdownMIDI()
    closeDatabase()
    await shutdownPostHog()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    clearHistory()
    shutdownMusicPlayer()
    shutdownMIDI()
    closeDatabase()
    await shutdownPostHog()
    process.exit(0)
  })
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: Need to log startup errors
  console.error('Server failed to start:', error)
  process.exit(1)
})
