// Must stay the first import: when started as the CoreMIDI warm-up helper
// (macOS, see service/midi/warmUpCoreMidi.ts) it exits before the server
// loads. A dedicated flag, because Bun's compiled binary ignores Node flags
// like `-e` and would re-run the whole server (the v0.1.60 regression).
import './service/midi/coreMidiWarmUpEntry'

import { exitWithParent } from './utils/exitWithParent'
// PostHog client (errors + events) — initialised on import.
import {
  captureAppStarted,
  captureException as captureExceptionPostHog,
  shutdownPostHog,
} from './utils/posthog'

// Fire the boot heartbeat right after PostHog import. Filtering for
// `app_started` + `component:"server"` in the PostHog dashboard confirms
// the sidecar's outbound path is healthy after every release.
captureAppStarted()

import { execFileSync, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import process from 'node:process'

import { closeDatabase, initializeDatabase } from './db'
import { runAsRequest } from './db/actingUser'
import { rebuildStaleSearchIndexes } from './db/rebuildStaleSearchIndexes'
import { createFetchHandler } from './http/createFetchHandler'
import { upsertSetting } from './service'
import { getOrCreateSystemToken } from './service/app-sessions'
import {
  BACKGROUND_MEDIA_MAX_REQUEST_BODY_BYTES,
  seedDefaultBackgroundMedia,
} from './service/background-media'
import { startBackupScheduler } from './service/backup'
import {
  ensureRCCVExists,
  warmupSearchIndex as warmupBibleSearchIndex,
} from './service/bible'
import { clearHistory } from './service/bible-history'
import { publishCloudMedia } from './service/cloud-media/publishCloudMedia'
import {
  initializeOBSAutoConnect,
  initializeOBSCallbacks,
} from './service/livestream/obs'
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
  applyQueueOrder,
  clearNowPlayingQueue,
  executeCommand,
  getPlayerState,
  initializeMusicPlayer,
  QUEUE_ORDERS,
  type QueueOrder,
  refreshQueueState,
  removeFromNowPlaying,
  setQueueOrder,
  setStateCallback,
  shutdownMusicPlayer,
} from './service/music-player'
import { startNotificationCleanup } from './service/notifications'
import {
  setOnScheduleStepPresentedCallback,
  setScheduleBackgroundResolver,
  stopPresentation,
} from './service/presentation'
import { startVerseLoop } from './service/presentation/verse-loop'
import {
  applyRemoteAccess,
  registerRemoteAccessListener,
} from './service/remote-access'
import {
  cueMusicForStep,
  startAppStartSchedule,
  stepBackground,
} from './service/schedule-automation'
import {
  startFeaturedSourcesRefresh,
  startPublicationSync,
  startSongUpdates,
} from './service/song-sources'
import { warmupSearchIndex as warmupSongsSearchIndex } from './service/songs'
import { startSyncScheduler } from './service/sync'
import { setCloudSyncFollowUp } from './service/sync/cloud/runCloudSyncCycle'
import { startBootServer } from './utils/bootServer'
import {
  type BootPhase,
  setBootFailed,
  setBootFirstRun,
  setBootPhase,
  setBootProgress,
  setBootReady,
  setBootStep,
} from './utils/bootState'
import { isPortFree } from './utils/isPortFree'
import { getListenHost } from './utils/listenHost'
import { getDatabasePath } from './utils/paths'
import { registerStandInListener } from './utils/peerAddress'
import { reportError } from './utils/reportError'
import { getServerPort } from './utils/serverPort'
import { getTestLanPort, TEST_LAN_PEER } from './utils/testLanListener'
import {
  broadcastMIDIConnectionStatus,
  broadcastMIDIDevices,
  broadcastMIDIMessage,
  broadcastMusicState,
  handleWebSocketClose,
  handleWebSocketMessage,
  handleWebSocketOpen,
  setMIDIMessageHandler,
  setMusicCommandHandler,
  setMusicStateProvider,
  type WebSocketData,
} from './websocket'

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
 * Waits for a port to become available, retrying up to maxRetries times.
 * Handles ghost PIDs on Windows where the process is gone but the binding lingers.
 */
async function waitForPortAvailable(
  port: number,
  maxRetries = 6,
  delayMs = 500,
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (await isPortFree(port)) return
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
      // macOS/Linux: the process LISTENING on the port, as on Windows. A bare
      // `lsof -ti :port` also lists every client connected to it (the desktop
      // shell, a test polling it), which were killed with it.
      // Using execFileSync with args array prevents shell injection
      const result = execFileSync(
        'lsof',
        ['-ti', `tcp:${portStr}`, '-sTCP:LISTEN'],
        { encoding: 'utf-8' },
      ).trim()
      if (result) {
        const pids = result.split('\n').filter(Boolean)
        for (const pid of pids) {
          if (/^\d+$/.test(pid) && Number(pid) !== process.pid) {
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

  // Before anything else: the boot server holds the port from the start, and
  // a first boot (or a failed one, which stays up) can last a long time. A
  // shell that is gone by then must not leave the sidecar holding it.
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  exitWithParent(shutdown)

  // A stale server on the port (a crashed run) is killed first. The kill
  // looks it up with lsof/netstat (slow on Windows), so only when it is held.
  const serverPort = getServerPort()
  let t = performance.now()
  if (!(await isPortFree(serverPort))) {
    killProcessOnPort(serverPort)
    await waitForPortAvailable(serverPort)
  }
  logTiming('port_check', t)

  // Bind the port at once with the boot server (in a worker thread), so the
  // window's loading page reads each step from /health while the heavy init
  // below runs. If any init step throws, the boot server stays up reporting
  // the failure via /health instead of the process dying silently.
  const firstRun = !existsSync(getDatabasePath())
  setBootFirstRun(firstRun)
  t = performance.now()
  const bootServer = await startBootServer(serverPort)
  logTiming('boot_server_start', t)
  // biome-ignore lint/suspicious/noConsole: Startup logging
  console.log(
    `[startup] Boot server listening on ${serverPort} — serving /health while initializing`,
  )

  let bootPhase: BootPhase = 'starting'
  try {
    // Initialize database (Drizzle ORM wrapper) and run migrations
    bootPhase = 'migrating'
    setBootPhase('migrating')
    setBootStep('database')
    t = performance.now()
    await initializeDatabase()
    logTiming('database_init', t)
    // A new database: its first admin is walked through the onboarding.
    // Existing installs never get the key, so they never see it.
    if (firstRun) {
      upsertSetting('app_settings', {
        key: 'onboarding_pending',
        value: 'true',
      })
    }

    bootPhase = 'indexing'
    setBootPhase('indexing')
    setBootStep('search')
    await runFtsRebuild()

    bootPhase = 'finalizing'
    setBootPhase('finalizing')
    setBootStep('finishing')
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
  await bootServer.stop()

  await startRealServer()

  // Start the automatic Google Drive backup scheduler (no-op unless enabled).
  startBackupScheduler()

  // Start the Drive library sync scheduler (no-op unless sync is enabled).
  // Also performs the on-startup "import changes made elsewhere" sync.
  // After each cloud sync, phones find the media the church's data shows
  // in its bucket.
  setCloudSyncFollowUp(publishCloudMedia)
  startSyncScheduler()

  // Keep the categories published to the user's S3 bucket up to date
  // (no-op until a bucket and a published category exist).
  startPublicationSync()

  // Read the song sources Church Hub offers (its featured list) from the
  // cloud; offline, the last list read or the installer's stays in use.
  startFeaturedSourcesRefresh()

  // Check the song sources for new songs (and add them, when updating songs
  // automatically) in a worker thread, a bit after start.
  startSongUpdates()

  // Drop notifications older than 60 days, now and daily.
  startNotificationCleanup()
}

/**
 * Rebuilds the full-text search indexes when they're out of sync with their
 * source tables. Extracted from {@link main} so boot failures can be attributed
 * to the `indexing` phase. Individual rebuild errors are non-fatal (logged) so a
 * single corrupt index doesn't block the whole server from coming up.
 */
async function runFtsRebuild(): Promise<void> {
  const t = performance.now()
  rebuildStaleSearchIndexes(setBootProgress)
  logTiming('fts_rebuild', t)
}

/**
 * Final pre-serve work: reset presentation state, ensure a fallback Bible
 * exists, add the bundled default backgrounds to the gallery, mint the
 * system token and wire OBS callbacks. Extracted from {@link main} so a
 * throw here is attributed to the `finalizing` phase.
 */
async function runFinalizeBoot(): Promise<void> {
  // Clear the displayed slide on startup to ensure a clean state
  let t = performance.now()
  stopPresentation()
  logTiming('clear_presentation', t)

  // Seed RCCV Bible translation if no translations exist (fallback if fixtures weren't loaded)
  t = performance.now()
  await ensureRCCVExists()
  logTiming('ensure_rccv_exists', t)

  // Add the backgrounds shipped with the app to the media gallery (once per
  // install; a default the user deletes is not added back)
  t = performance.now()
  await seedDefaultBackgroundMedia()
  logTiming('seed_default_background_media', t)

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

  let t = performance.now()

  // A looping Bible slideshow moves on by itself, wherever the operator is.
  startVerseLoop()

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

  const serveOptions: Parameters<typeof Bun.serve<WebSocketData>>[0] = {
    port: getServerPort(),
    hostname: getListenHost(),
    reusePort: true,
    // Bun's 128 MiB default would reject background video uploads (up to
    // 1 GiB) with a bare 413 before the route runs. Uploads are streamed to
    // disk and the route enforces the real per-kind limits itself.
    maxRequestBodySize: BACKGROUND_MEDIA_MAX_REQUEST_BODY_BYTES,
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
    fetch: createFetchHandler(),
    websocket: {
      open: handleWebSocketOpen,
      message: handleWebSocketMessage,
      close: handleWebSocketClose,
    },
  }
  // Each request has its own actor: the user its changes are stamped with.
  const handleRequest = serveOptions.fetch
  serveOptions.fetch = function (req, server) {
    return runAsRequest(() => handleRequest.call(this, req, server))
  }
  const server = await serveWithRetry<WebSocketData>(serveOptions)
  const testLanPort = getTestLanPort()
  if (testLanPort) {
    Bun.serve<WebSocketData>({
      ...serveOptions,
      port: testLanPort,
      hostname: '127.0.0.1',
    })
    registerStandInListener(testLanPort, TEST_LAN_PEER)
  }
  // The phones' WebRTC tunnel reaches the server here (service/remote-access).
  const remoteAccessListener = Bun.serve<WebSocketData>({
    ...serveOptions,
    port: 0,
    hostname: '127.0.0.1',
  })
  registerRemoteAccessListener(remoteAccessListener.port as number)
  void applyRemoteAccess()

  logTiming('bun_server_bind', t)

  // biome-ignore lint/suspicious/noConsole: <>
  console.log(`Bun server running at ${server.url}`)

  // Start permanent OBS connection if auto-connect is enabled
  // This must be done AFTER the WebSocket server starts so clients can receive status broadcasts
  t = performance.now()
  initializeOBSAutoConnect()
  logTiming('init_obs_auto_connect', t)

  // Initialize MIDI service (deferred to after server is ready for faster /ping
  // response). Not awaited: on macOS it first warms up CoreMIDI in a helper.
  t = performance.now()
  void initializeMIDI()
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
    broadcastMIDIDevices({
      inputs: devices.inputs.map((device) => ({ ...device, type: 'input' })),
      outputs: devices.outputs.map((device) => ({ ...device, type: 'output' })),
    })
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

  // A presentation's music item starts as the step after it goes up
  setOnScheduleStepPresentedCallback((scheduleId, stepIndex) => {
    cueMusicForStep(scheduleId, stepIndex).catch((error) => {
      // biome-ignore lint/suspicious/noConsole: Server-side logging
      console.error(`[schedule-automation] Music did not start: ${error}`)
    })
  })

  // A presentation's steps show the background video set before them
  setScheduleBackgroundResolver(stepBackground)

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
        if (getFileById(fileId)) {
          await executeCommand({ type: 'play_file', fileId })
          broadcastMusicState(getPlayerState())
        }
        break
      }
      case 'music_add_to_queue': {
        const { fileIds } = payload as { fileIds: number[] }
        addMultipleToNowPlaying(fileIds)
        applyQueueOrder()
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
      case 'music_queue_order': {
        const { order } = payload as { order: QueueOrder }
        if (QUEUE_ORDERS.includes(order)) {
          setQueueOrder(order)
          broadcastMusicState(getPlayerState())
        }
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

  // The presentation marked "start when Church Hub starts", if any.
  startAppStartSchedule()

  // biome-ignore lint/suspicious/noConsole: Startup timing logs
  console.log(
    `[startup] === Server Ready (total: ${(performance.now() - startupStart).toFixed(1)}ms) ===`,
  )

  // Load the search vocabularies (the typo lookup, up to a second or two on
  // a large library) once the app is up, not on the boot screen, so the
  // first search is already fast. The song library's part is built in steps,
  // so a projection opening now is not held behind it.
  setTimeout(async () => {
    const warmupStart = performance.now()
    warmupBibleSearchIndex()
    await warmupSongsSearchIndex()
    logTiming('fts_warmup', warmupStart)
  }, 0)
}

/**
 * Graceful shutdown: on a signal, or when the desktop shell that started this
 * sidecar is gone. A failed cleanup step must not keep the process (and its
 * port) alive: closeDatabase throws "database is locked" while prepared
 * statements are alive, which left the server running (T-149).
 */
async function shutdown() {
  try {
    clearHistory()
    shutdownMusicPlayer()
    shutdownMIDI()
    closeDatabase()
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Shutdown failure for the logs
    console.error('[shutdown] Cleanup failed, exiting anyway:', error)
    captureExceptionPostHog(error, { stage: 'shutdown' })
    process.exitCode = 1
  }
  await shutdownPostHog()
  process.exit()
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: Need to log startup errors
  console.error('Server failed to start:', error)
  process.exit(1)
})
