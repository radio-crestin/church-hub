import { existsSync } from 'node:fs'
import process from 'node:process'

import type { FetchServer } from './fetchServer'
import { setRequestActor } from '../db/actingUser'
import type { RequestContext } from '../middleware'
import {
  appOnlyAuthMiddleware,
  buildUserAuthCookie,
  combinedAuthMiddleware,
  holdsPermission,
  isLocalhost,
  reissueSessionCookie,
  requireAnyPermission,
  requirePermission,
  SESSION_COOKIE_MAX_AGE_SECONDS,
} from '../middleware'
import { isTrustedOrigin, refuseUntrustedRequest } from '../middleware/origins'
import { checkRoutePermission } from '../middleware/route-permissions'
import { getOpenApiSpec, getScalarDocs } from '../openapi'
import {
  handleAnalyticsConsentRead,
  handleAnalyticsRoutes,
} from '../routes/analytics'
import { handleDeviceLogin } from '../routes/auth-device-login'
import { authenticateLogin, type LoginBody } from '../routes/auth-login'
import { handleUserLinkRoute } from '../routes/auth-user-link/handleUserLinkRoute'
import { handleBackgroundMediaRoutes } from '../routes/background-media'
import { handleBibleTopicRoutes } from '../routes/bible-topics'
import { handleCloudBackupRoutes } from '../routes/cloud-backup'
import { CLOUD_BACKUP_PERMISSIONS } from '../routes/cloud-backup-permissions'
import { handleCloudSyncRoutes } from '../routes/cloud-sync'
import { handleLiveTranslationRoutes } from '../routes/live-translation'
import { handleLivestreamRoutes } from '../routes/livestream'
import { handleMIDIRoutes } from '../routes/midi'
import { handleMusicRoutes } from '../routes/music'
import { handleNotificationRoutes } from '../routes/notifications'
import { handlePresentationGalleryMediaRoutes } from '../routes/presentation-gallery-media'
import { handleRemoteAccessRoutes } from '../routes/remote-access'
import { handleScheduleItemRoutes } from '../routes/schedule-items'
import { handleScheduleMidiRoutes } from '../routes/schedule-midi'
import { handleScheduleTemplateRoutes } from '../routes/schedule-templates'
import { handleScreenLinkSignIn } from '../routes/screen-link-sign-in'
import { handleScreenLinkRoutes } from '../routes/screen-links'
import { handleScreenShareRoutes } from '../routes/screen-share'
import { handleSecretStoreRoutes } from '../routes/secret-store'
import { handleSlideTemplateRoutes } from '../routes/slide-templates'
import { handleSongHistoryRoutes } from '../routes/song-history'
import { handleSongLibraryRoutes } from '../routes/song-library'
import { handleSongLinkRoutes } from '../routes/song-links'
import { handleSongSourceRoutes } from '../routes/song-sources'
import { handleThemeBackgroundRoutes } from '../routes/theme-backgrounds'
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
  getPublicSetting,
  getUserById,
  getUserUuid,
  isServerOwnedSettingKey,
  type Permission,
  regenerateUserToken,
  type SettingsTable,
  setUserPassword,
  setUserRole,
  type UpdateUserInput,
  updateUser,
  updateUserPermissions,
  upsertSetting,
  withoutSettingSecrets,
} from '../service'
import { aiBibleSearch } from '../service/ai-bible-search'
import { aiSearchSongs } from '../service/ai-search'
import { getSystemToken, regenerateSystemToken } from '../service/app-sessions'
import {
  clearDriveAuth,
  completeDriveAuth,
  createDriveAuthUrl,
  deleteBackup,
  deleteLocalBackup,
  getBackupConfig,
  getBackupStatus,
  inspectBackup,
  listBackups,
  listLocalBackups,
  type RestoreLocalBackupInput,
  restoreBackup,
  restoreLocalBackup,
  runLocalBackup,
  uploadBackup,
  upsertBackupConfig,
} from '../service/backup'
import {
  type CreateTranslationInput,
  deleteTranslation,
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
} from '../service/bible'
import {
  addBookmark as addBibleBookmark,
  addBookmarkNote as addBibleBookmarkNote,
  type BibleBookmarkItemRef,
  type BibleBookmarkStyleRange,
  clearBookmarks as clearBibleBookmarks,
  exportBookmarksAsMarkdown as exportBibleBookmarksAsMarkdown,
  getBookmarkNotes as getBibleBookmarkNotes,
  getBookmarks as getBibleBookmarks,
  importBookmarksFromText as importBibleBookmarksFromText,
  removeBookmark as removeBibleBookmark,
  removeBookmarkNote as removeBibleBookmarkNote,
  reorderBookmarkItems as reorderBibleBookmarkItems,
  updateBookmarkNote as updateBibleBookmarkNote,
} from '../service/bible-bookmarks'
import {
  type AddToHistoryInput,
  addToHistory,
  clearHistory,
  getHistory,
} from '../service/bible-history'
import { parsePptFile } from '../service/conversion'
import {
  checkpointAndExport,
  getDatabaseInfo,
  type ImportOptions,
  importDatabase,
  performFactoryReset,
  selectiveImportDatabase,
} from '../service/database'
import {
  detectContentType,
  handleContentTypeChange,
} from '../service/livestream/obs'
import { clearLogs, openLogsFolder, readRecentLogs } from '../service/logs'
import { correctLyrics } from '../service/lyrics-correction'
import { loadMIDIShortcuts } from '../service/midi/shortcuts'
import { getExternalInterfaces } from '../service/network'
import {
  addSlideHighlight,
  batchUpdateScreenConfigs,
  type ContentType,
  clearSlide,
  clearSlideHighlights,
  clearTemporaryContent,
  deleteScreen,
  duplicateScreen,
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
  notifyScreenDesignChanged,
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
  setSlideHighlights,
  showSlide,
  stopPresentation,
  type TextStyleRange,
  type UpdatePresentationStateInput,
  type UpsertScreenInput,
  updateContentConfig,
  updateGlobalSettings,
  updateNextSlideConfig,
  updatePresentationState,
  upsertScreen,
} from '../service/presentation'
import {
  getVerseLoopTimer,
  READING_SPEED_SETTING_KEY,
  rescaleVerseLoop,
} from '../service/presentation/verse-loop'
import {
  getScheduleAutomationState,
  startScheduleAutomation,
  stopScheduleAutomation,
} from '../service/schedule-automation'
import {
  type AddToScheduleInput,
  addItemToSchedule,
  deleteSchedule,
  getQueueSchedule,
  getScheduleById,
  getSchedules,
  markScheduleItemSung,
  type ReorderScheduleItemsInput,
  type ReplaceScheduleItemsInput,
  rebuildScheduleSearchIndex,
  removeItemFromSchedule,
  reorderScheduleItems,
  replaceScheduleItems,
  searchSchedules,
  setScheduleItemAdvance,
  type UpdateScheduleSlideInput,
  type UpsertScheduleInput,
  updateScheduleSlide,
  upsertSchedule,
} from '../service/schedules'
import { endScreenShareSession } from '../service/screen-share'
import {
  deleteSearch,
  getSearchById,
  getSearchByUrlPath,
  type SaveSearchInput,
  saveSearch,
} from '../service/search-history'
import { SecretDestinationChangedError } from '../service/secret-store'
import {
  addBookmark,
  addBookmarkNote,
  type BookmarkItemRef,
  clearBookmarks,
  exportBookmarksAsMarkdown,
  getBookmarkNotes,
  getBookmarks,
  getBookmarksText,
  markBookmarkSung,
  removeBookmark,
  removeBookmarkNote,
  reorderBookmarkItems,
  replaceBookmarksFromText,
  updateBookmarkNote,
} from '../service/song-bookmarks'
import { resolveSongEditor, saveSongWithHistory } from '../service/song-history'
import { isProxyAllowedUrl } from '../service/song-sources'
import {
  type BatchImportSongInput,
  backfillAlternateTitles,
  batchImportSongs,
  batchUpdateSearchIndex,
  clearSearchCache,
  cloneSongSlide,
  completeSongReplacement,
  DEFAULT_SONGS_PAGE_SIZE,
  type DiscoveryCandidateInput,
  deleteCategory,
  deleteSong,
  deleteSongSlide,
  deleteSongsByIds,
  deleteTag,
  deleteUncategorizedSongs,
  findSameThemeSongs,
  getAllCategories,
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
  upsertSongSlide,
  upsertTag,
  validateCategoryInput,
  validateSongBackground,
} from '../service/songs'
import {
  getSyncConfig,
  getSyncStatus,
  listPendingChanges,
  listSyncUpdates,
  markSyncUpdatesSeen,
  runSyncCycle,
  signOutUserDevices,
  upsertSyncConfig,
} from '../service/sync'
import { escapeHtml } from '../service/text-search/text/escapeHtml'
import { getBootHealth } from '../utils/bootState'
import { DATABASE_ID_HEADER, getDatabaseId } from '../utils/databaseId'
import { authLogger, logToFile } from '../utils/fileLogger'
import { createLogger } from '../utils/logger'
import { getLogsDir } from '../utils/paths'
import { peerAddress } from '../utils/peerAddress'
// PostHog client (errors + events) — initialised on import.
import { captureMessage as captureMessageServer } from '../utils/posthog'
import { logRequest, logResponse } from '../utils/request-logger'
import { setRequestPeer } from '../utils/request-peer'
import { proxyToVite, serveStaticFile } from '../utils/static-server'
import { toErrorMessage } from '../utils/toErrorMessage'
import {
  broadcastPresentationState,
  broadcastScreenConfigUpdated,
  broadcastSettingsUpdated,
  broadcastSlideHighlights,
  broadcastSongUpdated,
} from '../websocket'

/**
 * Sent as `ticket` in a successful login answer: phone apps released before
 * 2026-11-27 take a truthy `ticket` as the sign of success, and they keep
 * talking to updated servers.
 */
const LOGIN_SUCCESS_MARKER = 'signed-in'

/**
 * The server's whole HTTP API as one fetch handler. Bun.serve runs it on the
 * PC; in a browser, the client's browser-server worker runs it on sqlite-wasm
 * (`server` is then the worker's stand-in for WebSocket upgrades and the
 * peer's address).
 */
export function createFetchHandler(): (
  req: Request,
  server: FetchServer,
) => Promise<Response> {
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

  const logger = createLogger('BibleAPI')

  /** The settings API never touches a key the server owns (isServerOwnedSettingKey). */
  function serverOwnedRefused(req: Request) {
    return handleCors(
      req,
      new Response(
        JSON.stringify({ error: 'This setting is not available here' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
    )
  }

  function handleCors(req: Request, res: Response) {
    // Cross-origin access only for the app's own origins (the desktop and
    // phone webviews, pages on this machine, the server as reached); any
    // other origin gets no CORS headers (refuseUntrustedRequest refused it).
    const origin = req.headers.get('Origin')
    if (origin && isTrustedOrigin(origin, req)) {
      res.headers.set('Access-Control-Allow-Origin', origin)
      res.headers.append('Vary', 'Origin')
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
      res.headers.set('Access-Control-Expose-Headers', DATABASE_ID_HEADER)
    }
    res.headers.set(DATABASE_ID_HEADER, getDatabaseId())

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

  return async function handleRequest(req: Request, server: FetchServer) {
    const requestStartTime = performance.now()
    setRequestPeer(req, peerAddress(req, server))
    logRequest(req)

    // Before any route (the WebSocket and preflights too): a request
    // another site's page could have sent with the user's credentials.
    const untrusted = refuseUntrustedRequest(req)
    if (untrusted) {
      logResponse(req, untrusted.status, requestStartTime)
      return untrusted
    }

    if (req.method === 'OPTIONS') {
      logResponse(req, 204, requestStartTime)
      return handleCors(req, new Response(null, { status: 204 }))
    }

    const url = new URL(req.url)

    // WebSocket upgrade for /ws endpoint
    if (url.pathname === '/ws') {
      const success = server.upgrade(req, {
        data: { clientId: '', local: isLocalhost(req) },
      })

      if (success) {
        return undefined as unknown as Response
      }

      return new Response('WebSocket upgrade failed', { status: 400 })
    }
    let _context: RequestContext | null = null

    // A user's sign-in link (public: it carries the user's token)
    const userLink = await handleUserLinkRoute(req, url, handleCors)
    if (userLink) return userLink

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

    // POST /api/screen-links/sign-in - a direct screen link's device (T-214)
    if (req.method === 'POST' && url.pathname === '/api/screen-links/sign-in') {
      return handleCors(req, await handleScreenLinkSignIn(req))
    }

    // POST /api/auth/device-login - a joined phone over WebRTC (T-174)
    if (req.method === 'POST' && url.pathname === '/api/auth/device-login') {
      return handleCors(req, await handleDeviceLogin(req))
    }

    // POST /api/auth/login - verify credentials and set the auth cookie
    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      try {
        const body = (await req.json()) as Partial<LoginBody>
        if (typeof body.userId !== 'number') {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Missing userId' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        const outcome = await authenticateLogin(req, body as LoginBody)
        if (outcome.kind === 'pairing_required') {
          authLogger.info('Login needs a pairing code', {
            userId: body.userId,
          })
          return handleCors(
            req,
            new Response(
              JSON.stringify({
                error: 'pairing_required',
                pairingId: outcome.pairingId,
                expiresAt: outcome.expiresAt,
              }),
              {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
        if (outcome.kind === 'refused') {
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

        // On localhost (the packaged desktop app) the cross-site `Secure`
        // cookie can't be stored by macOS WKWebView, so also return the token
        // in the body; the desktop client persists it and sends it back as an
        // `X-User-Auth` header. Remote/LAN clients (same-origin cookie works)
        // never receive it.
        const token = isLocalhost(req) ? outcome.token : undefined

        return handleCors(
          req,
          new Response(
            JSON.stringify({
              data: currentUser,
              ticket: LOGIN_SUCCESS_MARKER,
              token,
            }),
            {
              headers: {
                'Content-Type': 'application/json',
                'Set-Cookie': buildAuthCookie(
                  outcome.token,
                  SESSION_COOKIE_MAX_AGE_SECONDS,
                ),
              },
            },
          ),
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
          const response = new Response(
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
          )
          // A session cookie an older version stored as SameSite=None
          // becomes Lax on the app's next start.
          const reissued = reissueSessionCookie(req)
          if (reissued) response.headers.set('Set-Cookie', reissued)
          return handleCors(req, response)
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
          new Response(JSON.stringify({ data: { received: errors.length } }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      } catch {
        return handleCors(
          req,
          new Response(JSON.stringify({ error: 'Invalid client error body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
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
          new Response(JSON.stringify({ data: { received: events.length } }), {
            headers: { 'Content-Type': 'application/json' },
          }),
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

    // GET /api/analytics (PUBLIC): may usage data be sent, and the install id
    const analyticsConsent = handleAnalyticsConsentRead(req, url, handleCors)
    if (analyticsConsent) return analyticsConsent

    // All other /api/* routes require authentication
    if (url.pathname.startsWith('/api/')) {
      const authResult = await combinedAuthMiddleware(req)
      if (authResult.response) return handleCors(req, authResult.response)
      _context = authResult.context
      if (_context?.userId) setRequestActor(getUserUuid(_context.userId))
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
      if (isServerOwnedSettingKey(key)) return serverOwnedRefused(req)

      // Per-key permission: some app settings belong to a feature (or to the
      // shared navigation shell) rather than to general Settings, so gating
      // them by `settings.view` would wrongly lock out feature-only users.
      //  - sidebar_configuration: drives the nav shell for EVERY user (e.g.
      //    which pages it lists) → readable by any authenticated user.
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

      const setting = getPublicSetting(table, key)
      const shown =
        setting && !holdsPermission(_context, 'settings.edit')
          ? withoutSettingSecrets(setting)
          : setting

      return handleCors(
        req,
        new Response(JSON.stringify({ data: shown ?? null }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }

    // GET /api/settings/:table - Get all settings from a table
    const getAllSettingsMatch = url.pathname.match(/^\/api\/settings\/([^/]+)$/)
    if (req.method === 'GET' && getAllSettingsMatch) {
      const permError = checkPermission('settings.view')
      if (permError) return permError

      const table = getAllSettingsMatch[1] as SettingsTable
      const all = getAllSettings(table)
      const settings = holdsPermission(_context, 'settings.edit')
        ? all
        : all.map(withoutSettingSecrets)

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
        if (isServerOwnedSettingKey(body.key)) return serverOwnedRefused(req)

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
        // The operator running a verse slideshow sets its reading speed.
        const isReadingSpeed =
          table === 'app_settings' && body.key === READING_SPEED_SETTING_KEY
        const anyOfPermissions: Permission[] | null = isAppearance
          ? ['settings.edit', 'settings.edit_appearance']
          : isReadingSpeed
            ? ['settings.edit', 'control_room.control']
            : null

        let permError: Response | null
        if (isBibleSelection) {
          permError = checkPermission('bible.view')
        } else if (isLayoutDivider) {
          permError = null
        } else if (anyOfPermissions) {
          const denied = _context
            ? requireAnyPermission(anyOfPermissions)(_context)
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
        if (isReadingSpeed) rescaleVerseLoop()

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
      } catch (error) {
        const message =
          error instanceof SecretDestinationChangedError
            ? error.message
            : 'Invalid JSON body'
        return handleCors(
          req,
          new Response(JSON.stringify({ error: message }), { status: 400 }),
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
      if (isServerOwnedSettingKey(key)) return serverOwnedRefused(req)

      const result = deleteSetting(table, key)
      if (table === 'app_settings' && key === READING_SPEED_SETTING_KEY) {
        rescaleVerseLoop()
      }

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

    /** A super admin or the system token (null), else 403. */
    function checkAdmin(): Response | null {
      if (_context?.authType === 'app') return null
      return handleCors(
        req,
        new Response(JSON.stringify({ error: 'Admin access required' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
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

    // Strict localhost check (no system token allowed): this machine by its
    // TCP peer, which a LAN client or a phone's tunnel can't fake (the Host
    // header alone let any signed-in LAN account read the system token),
    // and addressed as localhost.
    function isStrictLocalhost(): boolean {
      if (!isLocalhost(req)) return false
      const host = req.headers.get('Host')
      if (!host) return true
      const hostname = (host.split(':')[0] ?? '').toLowerCase()
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
      const denied = await requireAppAuth()
      if (denied) return denied

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
      const denied = await requireAppAuth()
      if (denied) return denied

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
      const denied = checkPermission('settings.view')
      if (denied) return denied

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
      const denied = await requireAppAuth()
      if (denied) return denied

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
      const denied = await requireAppAuth()
      if (denied) return denied

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
      const denied = await requireAppAuth()
      if (denied) return denied

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
      const denied = checkPermission('settings.edit')
      if (denied) return denied

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

    /**
     * A route of this computer's own data (backups, sync): only from this
     * machine, and only for whoever holds `need` ('admin': a super admin
     * or the system token, for what can hand over or replace the whole
     * database).
     */
    const localGuard = async (
      need: Permission | 'admin',
    ): Promise<Response | null> =>
      backupLocalhostGuard() ??
      (need === 'admin' ? await requireAppAuth() : checkPermission(need))

    // Church Hub Cloud backup (free, Google sign-in): this machine, and
    // each route's permission (routes/cloud-backup-permissions.ts)
    if (url.pathname.startsWith('/api/backup/cloud/')) {
      const refused =
        backupLocalhostGuard() ??
        checkRoutePermission(
          req,
          url.pathname,
          CLOUD_BACKUP_PERMISSIONS,
          checkPermission,
          checkAdmin,
        )
      if (refused) return refused
      const cloudBackupResponse = await handleCloudBackupRoutes(req, url)
      if (cloudBackupResponse) return handleCors(req, cloudBackupResponse)
    }

    // GET /api/backup/status - Drive connection + auto-backup settings
    if (req.method === 'GET' && url.pathname === '/api/backup/status') {
      const guard = await localGuard('settings.view')
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
      const guard = await localGuard('settings.view')
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
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        }),
      )
    }

    // POST /api/backup/now - Upload a fresh backup to Google Drive
    if (req.method === 'POST' && url.pathname === '/api/backup/now') {
      const guard = await localGuard('settings.edit')
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
      const guard = await localGuard('admin')
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

    // POST /api/backup/inspect - Read a backup's contents (songs, schedules,
    // playlists, per-table counts) without restoring it
    if (req.method === 'POST' && url.pathname === '/api/backup/inspect') {
      const guard = await localGuard('settings.edit')
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

      const result = await inspectBackup(fileId)
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
        new Response(JSON.stringify({ data: result.contents }), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        }),
      )
    }

    // POST /api/backup/delete - Delete a single backup from Google Drive
    if (req.method === 'POST' && url.pathname === '/api/backup/delete') {
      const guard = await localGuard('settings.edit')
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

    // ---- Local backup routes (same localhost guard) ----
    // Deliberately independent of Drive: these work with no Google account
    // connected, which is the whole point of an on-disk copy.

    // GET /api/backup/local/list - Backups present in the configured folder,
    // or in `?dir=` when the operator is browsing another one to restore from
    if (req.method === 'GET' && url.pathname === '/api/backup/local/list') {
      const guard = await localGuard('settings.view')
      if (guard) return guard

      const dir = url.searchParams.get('dir') || undefined
      const backups = await listLocalBackups(dir)
      return handleCors(
        req,
        new Response(JSON.stringify({ data: { backups } }), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        }),
      )
    }

    // POST /api/backup/local/now - Write a fresh backup to the local folder
    if (req.method === 'POST' && url.pathname === '/api/backup/local/now') {
      const guard = await localGuard('settings.edit')
      if (guard) return guard

      const result = await runLocalBackup()
      return handleCors(
        req,
        new Response(
          JSON.stringify(
            result.success ? { data: result } : { error: result.error },
          ),
          {
            status: result.success ? 200 : 400,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
    }

    // POST /api/backup/local/delete - Delete one local backup by file name
    if (req.method === 'POST' && url.pathname === '/api/backup/local/delete') {
      const guard = await localGuard('settings.edit')
      if (guard) return guard

      let fileName = ''
      try {
        const body = (await req.json()) as { fileName?: string }
        fileName = typeof body.fileName === 'string' ? body.fileName : ''
      } catch {
        // Falls through to the missing-name error below.
      }

      if (!fileName) {
        return handleCors(
          req,
          new Response(JSON.stringify({ error: 'Missing fileName' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      const result = await deleteLocalBackup(fileName)
      return handleCors(
        req,
        new Response(
          JSON.stringify(
            result.success ? { data: result } : { error: result.error },
          ),
          {
            status: result.success ? 200 : 400,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
    }

    // POST /api/backup/local/restore - Replace the database with a local copy
    if (req.method === 'POST' && url.pathname === '/api/backup/local/restore') {
      const guard = await localGuard('admin')
      if (guard) return guard

      let input: RestoreLocalBackupInput = {}
      try {
        const body = (await req.json()) as RestoreLocalBackupInput
        input = {
          fileName:
            typeof body.fileName === 'string' ? body.fileName : undefined,
          path: typeof body.path === 'string' ? body.path : undefined,
        }
      } catch {
        // Falls through to the service's `no_source` error below.
      }

      const result = await restoreLocalBackup(input)
      return handleCors(
        req,
        new Response(
          JSON.stringify(
            result.success ? { data: result } : { error: result.error },
          ),
          {
            status: result.success ? 200 : 400,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
    }

    // GET /api/backup/config - Read auto-backup settings
    if (req.method === 'GET' && url.pathname === '/api/backup/config') {
      const guard = await localGuard('settings.view')
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
      const guard = await localGuard('settings.edit')
      if (guard) return guard

      let patch: {
        autoBackupEnabled?: boolean
        intervalHours?: number
        maxBackups?: number
        localBackupPath?: string | null
      } = {}
      try {
        const body = await req.json()
        if (typeof body.autoBackupEnabled === 'boolean') {
          patch.autoBackupEnabled = body.autoBackupEnabled
        }
        if (typeof body.intervalHours === 'number' && body.intervalHours > 0) {
          patch.intervalHours = Math.round(body.intervalHours)
        }
        if (typeof body.maxBackups === 'number' && body.maxBackups >= 1) {
          patch.maxBackups = Math.min(Math.round(body.maxBackups), 50)
        }
        // An empty string clears the folder, i.e. turns local backups off.
        if (typeof body.localBackupPath === 'string') {
          patch.localBackupPath = body.localBackupPath.trim() || null
        } else if (body.localBackupPath === null) {
          patch.localBackupPath = null
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

    // GET /api/backup/google/connect - Start the Drive connect flow. Returns
    // the ChurchHub OAuth worker's /auth/drive URL (the worker holds the
    // Google client credentials and redirects back here with the tokens).
    if (req.method === 'GET' && url.pathname === '/api/backup/google/connect') {
      const guard = await localGuard('admin')
      if (guard) return guard

      const result = createDriveAuthUrl()
      return handleCors(
        req,
        new Response(JSON.stringify({ data: { authUrl: result.authUrl } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }

    // GET /api/backup/google/callback - The OAuth worker redirects the
    // browser here with the tokens once Google authorization completes.
    if (
      req.method === 'GET' &&
      url.pathname === '/api/backup/google/callback'
    ) {
      const oauthError = url.searchParams.get('error')
      const accessToken = url.searchParams.get('accessToken')
      const refreshToken = url.searchParams.get('refreshToken')
      const expiresAt = Number(url.searchParams.get('expiresAt'))
      const email = url.searchParams.get('email') ?? undefined

      const renderPage = (title: string, message: string) =>
        handleCors(
          req,
          new Response(
            `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:system-ui;padding:2rem;text-align:center"><p>${escapeHtml(message)}</p><script>setTimeout(()=>window.close(),1500)</script></body></html>`,
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
          ),
        )

      if (oauthError) {
        return renderPage('Backup', `Authorization failed: ${oauthError}`)
      }
      if (!accessToken || !refreshToken) {
        return renderPage('Backup', 'Missing tokens in callback.')
      }

      const result = await completeDriveAuth(url.searchParams.get('state'), {
        accessToken,
        refreshToken,
        expiresAt,
        email,
      })
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
      const guard = await localGuard('settings.edit')
      if (guard) return guard

      await clearDriveAuth()
      return handleCors(
        req,
        new Response(JSON.stringify({ data: { success: true } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }

    // ---- Google Drive library sync routes (localhost only) ----
    // Same trust model as backups: sync is driven only from the machine
    // running the desktop app (it holds the Drive tokens).

    // GET /api/sync/status - Sync state for the settings UI and indicator
    if (req.method === 'GET' && url.pathname === '/api/sync/status') {
      const guard = await localGuard('settings.view')
      if (guard) return guard

      const status = await getSyncStatus()
      return handleCors(
        req,
        new Response(JSON.stringify({ data: status }), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        }),
      )
    }

    // GET /api/sync/config - Read sync settings
    if (req.method === 'GET' && url.pathname === '/api/sync/config') {
      const guard = await localGuard('settings.view')
      if (guard) return guard

      const config = await getSyncConfig()
      return handleCors(
        req,
        new Response(JSON.stringify({ data: config }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }

    // PUT /api/sync/config - Update sync settings
    if (req.method === 'PUT' && url.pathname === '/api/sync/config') {
      const guard = await localGuard('settings.edit')
      if (guard) return guard

      const patch: { syncEnabled?: boolean; pollIntervalMinutes?: number } = {}
      try {
        const body = await req.json()
        if (typeof body.syncEnabled === 'boolean') {
          patch.syncEnabled = body.syncEnabled
        }
        if (
          typeof body.pollIntervalMinutes === 'number' &&
          body.pollIntervalMinutes >= 1
        ) {
          patch.pollIntervalMinutes = Math.min(
            Math.round(body.pollIntervalMinutes),
            120,
          )
        }
      } catch {
        // No/invalid body - nothing to update
      }

      const config = await upsertSyncConfig(patch)
      // Enabling sync should feel immediate: kick off a first cycle now.
      if (patch.syncEnabled === true) void runSyncCycle()
      return handleCors(
        req,
        new Response(JSON.stringify({ data: config }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }

    // POST /api/sync/now - Run a sync cycle immediately
    if (req.method === 'POST' && url.pathname === '/api/sync/now') {
      const guard = await localGuard('settings.edit')
      if (guard) return guard

      const result = await runSyncCycle()
      if (!result.success) {
        return handleCors(
          req,
          new Response(
            JSON.stringify({
              error: result.error ?? result.skipped ?? 'sync_failed',
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
        new Response(JSON.stringify({ data: result }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }

    // GET /api/sync/pending - Local changes waiting to upload to Drive
    if (req.method === 'GET' && url.pathname === '/api/sync/pending') {
      const guard = await localGuard('settings.view')
      if (guard) return guard

      const pending = listPendingChanges()
      return handleCors(
        req,
        new Response(JSON.stringify({ data: { pending } }), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        }),
      )
    }

    // GET /api/sync/updates - Changes applied from other devices
    if (req.method === 'GET' && url.pathname === '/api/sync/updates') {
      const guard = await localGuard('settings.view')
      if (guard) return guard

      const unseenOnly = url.searchParams.get('unseenOnly') === 'true'
      const updates = listSyncUpdates({ unseenOnly })
      return handleCors(
        req,
        new Response(JSON.stringify({ data: { updates } }), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        }),
      )
    }

    // POST /api/sync/updates/seen - Mark update entries as reviewed
    if (req.method === 'POST' && url.pathname === '/api/sync/updates/seen') {
      const guard = await localGuard('settings.view')
      if (guard) return guard

      let ids: number[] | undefined
      try {
        const body = await req.json()
        if (Array.isArray(body.ids)) {
          ids = body.ids.filter((id: unknown) => typeof id === 'number')
        }
      } catch {
        // No body - mark everything seen
      }

      const changed = markSyncUpdatesSeen(ids)
      return handleCors(
        req,
        new Response(JSON.stringify({ data: { markedSeen: changed } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }

    // The curated Church Hub Library: submissions and curators (T-177)
    const songLibraryResponse = await handleSongLibraryRoutes(
      req,
      url,
      backupLocalhostGuard,
      checkPermission,
    )
    if (songLibraryResponse) return handleCors(req, songLibraryResponse)

    // Songs shared by a link: their public page (T-177)
    const songLinkResponse = await handleSongLinkRoutes(
      req,
      url,
      checkPermission,
    )
    if (songLinkResponse) return handleCors(req, songLinkResponse)

    // Cloud sync: this server's church on the sync service (T-171)
    if (url.pathname.startsWith('/api/sync/cloud')) {
      const cloudSyncResponse = await handleCloudSyncRoutes(
        req,
        url,
        backupLocalhostGuard,
        checkPermission,
      )
      if (cloudSyncResponse) return handleCors(req, cloudSyncResponse)
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
          new Response(JSON.stringify({ error: toErrorMessage(error) }), {
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
        // In the background: the sync service may take seconds (a first
        // upload in progress), and the change stands either way.
        if (body.isActive === false) void signOutUserDevices(id)

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
      // In the background, like a deactivation
      void signOutUserDevices(id)

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
      const denied = checkPermission('logs.view')
      if (denied) return denied
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

    // A presentation's music, video and verses items
    const scheduleItemsResponse = await handleScheduleItemRoutes(
      req,
      url,
      handleCors,
      _context,
    )
    if (scheduleItemsResponse) return scheduleItemsResponse

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

    // GET /api/schedules/automation - What the presentation runner is doing
    if (req.method === 'GET' && url.pathname === '/api/schedules/automation') {
      const permError = checkPermission('programs.view')
      if (permError) return permError

      return handleCors(
        req,
        new Response(JSON.stringify({ data: getScheduleAutomationState() }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }

    // POST /api/schedules/automation/stop - Stop the running presentation
    if (
      req.method === 'POST' &&
      url.pathname === '/api/schedules/automation/stop'
    ) {
      const permError = checkPermission('control_room.control')
      if (permError) return permError

      const state = stopScheduleAutomation('stopped by an operator', {
        clear: true,
      })
      return handleCors(
        req,
        new Response(JSON.stringify({ data: state }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }

    // POST /api/schedules/:id/run - Start a presentation from its first step
    const runScheduleMatch = url.pathname.match(
      /^\/api\/schedules\/(\d+)\/run$/,
    )
    if (req.method === 'POST' && runScheduleMatch?.[1]) {
      const permError = checkPermission('control_room.control')
      if (permError) return permError

      const id = parseInt(runScheduleMatch[1], 10)
      if (!getScheduleById(id)) {
        return handleCors(
          req,
          new Response(JSON.stringify({ error: 'Schedule not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      try {
        const state = await startScheduleAutomation(id)
        return handleCors(
          req,
          new Response(JSON.stringify({ data: state }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      } catch (error) {
        return handleCors(
          req,
          new Response(JSON.stringify({ error: toErrorMessage(error) }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
    }

    // GET /api/schedules/queue - The control room's queue (made on first use)
    if (req.method === 'GET' && url.pathname === '/api/schedules/queue') {
      const permError = checkPermission('control_room.view')
      if (permError) return permError

      const queue = getQueueSchedule()
      return handleCors(
        req,
        new Response(
          JSON.stringify(
            queue ? { data: queue } : { error: 'Failed to load the queue' },
          ),
          {
            status: queue ? 200 : 500,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
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
            new Response(JSON.stringify({ error: 'Failed to save schedule' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
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
    const deleteScheduleMatch = url.pathname.match(/^\/api\/schedules\/(\d+)$/)
    if (req.method === 'DELETE' && deleteScheduleMatch?.[1]) {
      const permError = checkPermission('programs.delete')
      if (permError) return permError

      const id = parseInt(deleteScheduleMatch[1], 10)
      const result = deleteSchedule(id)

      if (!result) {
        return handleCors(
          req,
          new Response(JSON.stringify({ error: 'Failed to delete schedule' }), {
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
      } catch (error) {
        // A body that is no JSON, or settings (a deck) that don't fit.
        return handleCors(
          req,
          new Response(
            JSON.stringify({
              error:
                error instanceof Error ? error.message : 'Invalid JSON body',
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
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
        const body = (await req.json()) as Omit<UpdateScheduleSlideInput, 'id'>

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

    // PUT /api/schedules/:id/items/:itemId/sung - Toggle the "already sung"
    // marker on a schedule item. Scoped to the schedule so the same song can
    // be pending in one program and sung in another.
    {
      const scheduleItemSungMatch = url.pathname.match(
        /^\/api\/schedules\/(\d+)\/items\/(\d+)\/sung$/,
      )
      if (
        req.method === 'PUT' &&
        scheduleItemSungMatch?.[1] &&
        scheduleItemSungMatch?.[2]
      ) {
        const permError = checkPermission('programs.edit')
        if (permError) return permError

        const scheduleId = parseInt(scheduleItemSungMatch[1], 10)
        const itemId = parseInt(scheduleItemSungMatch[2], 10)
        try {
          const body = (await req.json()) as { isSung: boolean }
          const result = markScheduleItemSung(
            scheduleId,
            itemId,
            Boolean(body.isSung),
          )
          return handleCors(
            req,
            new Response(JSON.stringify({ data: result }), {
              status: result.success ? 200 : 404,
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
    }

    // PUT /api/schedules/:id/items/:itemId/advance - How long each slide of
    // an item stays up while the presentation runs by itself.
    {
      const advanceMatch = url.pathname.match(
        /^\/api\/schedules\/(\d+)\/items\/(\d+)\/advance$/,
      )
      if (req.method === 'PUT' && advanceMatch?.[1] && advanceMatch?.[2]) {
        const permError = checkPermission('programs.edit')
        if (permError) return permError

        const body = (await req.json().catch(() => null)) as {
          advanceSeconds?: unknown
        } | null
        const seconds = body?.advanceSeconds
        if (seconds !== null && typeof seconds !== 'number') {
          return handleCors(
            req,
            new Response(
              JSON.stringify({
                error: 'advanceSeconds must be a number or null',
              }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
        const result = setScheduleItemAdvance(
          parseInt(advanceMatch[1], 10),
          parseInt(advanceMatch[2], 10),
          seconds,
        )
        return handleCors(
          req,
          new Response(JSON.stringify({ data: result }), {
            status: result.success ? 200 : 404,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
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
            new Response(JSON.stringify({ error: 'Failed to reorder items' }), {
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
          notifyScreenDesignChanged(screen.id)
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
    // POST /api/screens/:id/duplicate - Clone a screen with all its settings
    const duplicateScreenMatch = url.pathname.match(
      /^\/api\/screens\/(\d+)\/duplicate$/,
    )
    if (req.method === 'POST' && duplicateScreenMatch?.[1]) {
      const permError = checkPermission('displays.create')
      if (permError) return permError

      const id = parseInt(duplicateScreenMatch[1], 10)
      const body = (await req.json().catch(() => ({}))) as { name?: string }
      const screen = duplicateScreen(id, body.name)

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
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }

    const deleteScreenMatch = url.pathname.match(/^\/api\/screens\/(\d+)$/)
    if (req.method === 'DELETE' && deleteScreenMatch?.[1]) {
      const permError = checkPermission('displays.delete')
      if (permError) return permError

      const id = parseInt(deleteScreenMatch[1], 10)
      const result = deleteScreen(id)

      // Other clients drop it from their lists, and their previews fall back
      // to the main screen when it was the one shown there.
      if (result.success) broadcastScreenConfigUpdated(id)

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
        notifyScreenDesignChanged(screenId)

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
        notifyScreenDesignChanged(screenId)

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
        notifyScreenDesignChanged(screenId)

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
        notifyScreenDesignChanged(screenId)

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

    // GET /api/presentation/verse-loop - The verse slideshow's running timer
    if (
      req.method === 'GET' &&
      url.pathname === '/api/presentation/verse-loop'
    ) {
      const permError = checkPermission('control_room.view')
      if (permError) return permError

      return handleCors(
        req,
        new Response(JSON.stringify({ data: getVerseLoopTimer() }), {
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
        endScreenShareSession()
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
        endScreenShareSession()
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

    // PUT /api/presentation/highlights - Replace every highlight at once
    if (
      req.method === 'PUT' &&
      url.pathname === '/api/presentation/highlights'
    ) {
      const permError = checkPermission('control_room.control')
      if (permError) return permError

      try {
        const body = (await req.json()) as { ranges: TextStyleRange[] }

        if (!Array.isArray(body.ranges)) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Ranges are required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        const highlights = setSlideHighlights(body.ranges)
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
        endScreenShareSession()
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
        endScreenShareSession()
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
        endScreenShareSession()
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
        endScreenShareSession()
        const state = presentTemporaryScene(body)
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

    // POST /api/presentation/temporary-image, /temporary-video - A gallery file
    const galleryMediaResponse = await handlePresentationGalleryMediaRoutes(
      req,
      url,
      handleCors,
      checkPermission,
      (state) => {
        broadcastPresentationState(state)
        triggerSceneAutomation(state)
      },
    )
    if (galleryMediaResponse) return galleryMediaResponse

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
      const tagIds = (url.searchParams.get('tagIds') ?? '')
        .split(',')
        .map((id) => parseInt(id, 10))
        .filter((id) => !isNaN(id))
      const results = searchSongs(
        query,
        categoryIds && categoryIds.length > 0 ? categoryIds : undefined,
        50,
        {
          presentedOnly,
          inSchedulesOnly,
          hasKeyLine,
          tagIds: tagIds.length > 0 ? tagIds : undefined,
        },
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

    // POST /api/songs/alternate-titles - Give songs back the names their
    // source knows them by (see backfillAlternateTitles)
    if (
      req.method === 'POST' &&
      url.pathname === '/api/songs/alternate-titles'
    ) {
      const permError = checkPermission('songs.edit')
      if (permError) return permError

      try {
        const body = (await req.json()) as {
          entries?: Array<{ sourceFilename?: string; titles?: string[] }>
        }

        if (!Array.isArray(body.entries)) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'entries is required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
        // Same ceiling the discovery match endpoint uses: the client chunks
        // a whole catalogue, and one request should stay one transaction.
        if (body.entries.length > 500) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({ error: 'Too many entries (max 500)' }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }

        const entries = body.entries
          .filter(
            (entry): entry is { sourceFilename: string; titles: string[] } =>
              typeof entry?.sourceFilename === 'string' &&
              Array.isArray(entry.titles),
          )
          .map((entry) => ({
            sourceFilename: entry.sourceFilename,
            titles: entry.titles.filter(
              (title): title is string => typeof title === 'string',
            ),
          }))

        const result = backfillAlternateTitles(entries)

        return handleCors(
          req,
          new Response(JSON.stringify({ data: result }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Backfill failed'
        return handleCors(
          req,
          new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
    }

    // POST /api/songs/correct-lyrics - Proof-read a passage of lyrics
    if (req.method === 'POST' && url.pathname === '/api/songs/correct-lyrics') {
      // Rewriting a song's words is an edit, so it takes the edit permission
      // rather than the one that merely reads them.
      const permError = checkPermission('songs.edit')
      if (permError) return permError

      try {
        const body = (await req.json()) as { text?: string }

        if (!body.text?.trim()) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Text is required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        const result = await correctLyrics(body.text)

        return handleCors(
          req,
          new Response(JSON.stringify({ data: result }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          }),
        )
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Correction failed'
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
    if (req.method === 'POST' && url.pathname === '/api/songs/search/rebuild') {
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
      const categoryId = categoryIdParam ? parseInt(categoryIdParam, 10) : null
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
      const permError = checkPermission('songs.edit')
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
        const lastP = paragraphs.at(-1)
        return lastP ? lastP.replace(/<\/?p>/gi, '').trim() : null
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
            matchesWithExistingKeyLine: matches.filter((m) => m.existingKeyLine)
              .length,
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
      const permError = checkPermission('songs.edit')
      if (permError) return permError

      const limitParam = url.searchParams.get('limit')
      const limit = limitParam ? parseInt(limitParam, 10) : 100

      // Extract text from last <p> tag
      const extractLastParagraph = (html: string): string | null => {
        const paragraphs = html.match(/<p>([^<]*)<\/p>/gi)
        if (!paragraphs || paragraphs.length === 0) return null
        const lastP = paragraphs.at(-1)
        return lastP ? lastP.replace(/<\/?p>/gi, '').trim() : null
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

    // GET /api/songs - List songs, one page at a time. Without `limit` the
    // first DEFAULT_SONGS_PAGE_SIZE songs come back, never the whole library.
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
      const uncategorizedOnlyParam = url.searchParams.get('uncategorizedOnly')
      const sortByParam = url.searchParams.get('sortBy')

      const limit =
        (limitParam ? parseInt(limitParam, 10) : NaN) || DEFAULT_SONGS_PAGE_SIZE
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
        uncategorizedOnly: uncategorizedOnlyParam === 'true',
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

        const backgroundError = validateSongBackground(body.background)
        if (backgroundError) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: backgroundError }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        const song = saveSongWithHistory(
          { ...body, isManualEdit: true },
          resolveSongEditor(_context?.userId),
        )

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
        const message = toErrorMessage(error)
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

    // ============================================================
    // Proxy Download Endpoint (for CORS bypass)
    // ============================================================

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

      // Only the hosts of known song sources
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

      if (!isProxyAllowedUrl(parsedUrl)) {
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
            response.headers.get('Content-Type') || 'application/octet-stream',
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

    // POST /api/convert/ppt-to-pptx - Parse PPT and return slides
    if (req.method === 'POST' && url.pathname === '/api/convert/ppt-to-pptx') {
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

        // Parse PPT directly
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

    // GET /api/songs/:id/same-theme - Other songs on the song's theme.
    // Query: ?limit=8 (defaults to 8, capped at 20).
    const sameThemeMatch = url.pathname.match(
      /^\/api\/songs\/(\d+)\/same-theme$/,
    )
    if (req.method === 'GET' && sameThemeMatch?.[1]) {
      const permError = checkPermission('songs.view')
      if (permError) return permError

      const songId = parseInt(sameThemeMatch[1], 10)
      const rawLimit = parseInt(url.searchParams.get('limit') ?? '8', 10)
      const limit = Math.min(20, Math.max(1, rawLimit || 8))

      return handleCors(
        req,
        new Response(
          JSON.stringify({ data: findSameThemeSongs(songId, limit) }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
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
          new Response(JSON.stringify({ error: toErrorMessage(error) }), {
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
          new Response(JSON.stringify({ error: toErrorMessage(error) }), {
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
        const refreshedState = refreshPresentedSongSlides(slideToDelete.songId)
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
            new Response(JSON.stringify({ error: 'Missing slideIds array' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
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

        const inputError = validateCategoryInput(body)
        if (inputError) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: inputError }), {
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
            new Response(JSON.stringify({ error: 'Failed to save category' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
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
    const deleteCategoryMatch = url.pathname.match(/^\/api\/categories\/(\d+)$/)
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

        if (
          !Array.isArray(body.categoryIds) ||
          !body.categoryIds.every(Number.isInteger)
        ) {
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
    // Bible Bookmarks API Endpoints
    // ============================================================

    // GET /api/bible-bookmarks - Get all bookmarked verses
    if (req.method === 'GET' && url.pathname === '/api/bible-bookmarks') {
      const permError = checkPermission('bible.view')
      if (permError) return permError

      const items = getBibleBookmarks()
      return handleCors(
        req,
        new Response(JSON.stringify({ data: items }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }

    // GET /api/bible-bookmarks/export - Render bookmarks as plain text
    if (
      req.method === 'GET' &&
      url.pathname === '/api/bible-bookmarks/export'
    ) {
      const permError = checkPermission('bible.view')
      if (permError) return permError

      const text = exportBibleBookmarksAsMarkdown()
      return handleCors(
        req,
        new Response(JSON.stringify({ data: text }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }

    // POST /api/bible-bookmarks/import - Append bookmarks parsed from text
    if (
      req.method === 'POST' &&
      url.pathname === '/api/bible-bookmarks/import'
    ) {
      const permError = checkPermission('bible.view')
      if (permError) return permError

      try {
        const body = (await req.json()) as {
          text: string
          translationId?: number
        }

        if (typeof body.text !== 'string') {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Text is required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        const result = importBibleBookmarksFromText(
          body.text,
          body.translationId,
        )

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

    // PUT /api/bible-bookmarks/reorder-items - Reorder verses and notes
    if (
      req.method === 'PUT' &&
      url.pathname === '/api/bible-bookmarks/reorder-items'
    ) {
      const permError = checkPermission('bible.view')
      if (permError) return permError

      try {
        const body = (await req.json()) as { items: BibleBookmarkItemRef[] }

        if (!Array.isArray(body.items)) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Items are required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        const result = reorderBibleBookmarkItems(body.items)
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
          new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
    }

    // POST /api/bible-bookmarks - Bookmark a verse
    if (req.method === 'POST' && url.pathname === '/api/bible-bookmarks') {
      const permError = checkPermission('bible.view')
      if (permError) return permError

      try {
        const body = (await req.json()) as {
          verseId: number
          styleRanges?: BibleBookmarkStyleRange[]
        }

        if (typeof body.verseId !== 'number') {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Verse ID is required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        const result = addBibleBookmark(body.verseId, body.styleRanges)

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

    // DELETE /api/bible-bookmarks/:id - Remove one bookmark row
    if (req.method === 'DELETE') {
      const bookmarkMatch = url.pathname.match(
        /^\/api\/bible-bookmarks\/(\d+)$/,
      )
      if (bookmarkMatch) {
        const permError = checkPermission('bible.view')
        if (permError) return permError

        const result = removeBibleBookmark(Number(bookmarkMatch[1]))
        return handleCors(
          req,
          new Response(JSON.stringify({ success: result.success }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
    }

    // DELETE /api/bible-bookmarks - Clear the whole list
    if (req.method === 'DELETE' && url.pathname === '/api/bible-bookmarks') {
      const permError = checkPermission('bible.view')
      if (permError) return permError

      const result = clearBibleBookmarks()
      return handleCors(
        req,
        new Response(JSON.stringify({ success: result.success }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }

    // GET /api/bible-bookmark-notes - Get all notes
    if (req.method === 'GET' && url.pathname === '/api/bible-bookmark-notes') {
      const permError = checkPermission('bible.view')
      if (permError) return permError

      const items = getBibleBookmarkNotes()
      return handleCors(
        req,
        new Response(JSON.stringify({ data: items }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }

    // POST /api/bible-bookmark-notes - Add a note
    if (req.method === 'POST' && url.pathname === '/api/bible-bookmark-notes') {
      const permError = checkPermission('bible.view')
      if (permError) return permError

      try {
        const body = (await req.json()) as { content: string }

        if (typeof body.content !== 'string' || !body.content.trim()) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Content is required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        const result = addBibleBookmarkNote(body.content.trim())

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

    // PUT /api/bible-bookmark-notes/:id - Rewrite a note
    if (req.method === 'PUT') {
      const noteMatch = url.pathname.match(
        /^\/api\/bible-bookmark-notes\/(\d+)$/,
      )
      if (noteMatch) {
        const permError = checkPermission('bible.view')
        if (permError) return permError

        try {
          const body = (await req.json()) as { content: string }

          if (typeof body.content !== 'string' || !body.content.trim()) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Content is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const result = updateBibleBookmarkNote(
            Number(noteMatch[1]),
            body.content.trim(),
          )
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
            new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }
    }

    // DELETE /api/bible-bookmark-notes/:id - Delete a note
    if (req.method === 'DELETE') {
      const noteMatch = url.pathname.match(
        /^\/api\/bible-bookmark-notes\/(\d+)$/,
      )
      if (noteMatch) {
        const permError = checkPermission('bible.view')
        if (permError) return permError

        const result = removeBibleBookmarkNote(Number(noteMatch[1]))
        return handleCors(
          req,
          new Response(JSON.stringify({ success: result.success }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
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

    // PUT /api/song-bookmarks/:id/sung - Toggle the "already sung" marker.
    // Keyed on the bookmark row, not the song: the same song can be
    // bookmarked several times and each copy is ticked off separately.
    {
      const sungMatch = url.pathname.match(
        /^\/api\/song-bookmarks\/(\d+)\/sung$/,
      )
      if (req.method === 'PUT' && sungMatch) {
        const permError = checkPermission('songs.view')
        if (permError) return permError

        const bookmarkId = Number(sungMatch[1])
        try {
          const body = (await req.json()) as { isSung: boolean }
          const result = markBookmarkSung(bookmarkId, Boolean(body.isSung))
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
    }

    // DELETE /api/song-bookmarks/:id - Remove a single bookmark row
    if (
      req.method === 'DELETE' &&
      url.pathname.startsWith('/api/song-bookmarks/')
    ) {
      const permError = checkPermission('songs.view')
      if (permError) return permError

      const bookmarkId = Number(url.pathname.split('/').pop())
      if (Number.isNaN(bookmarkId)) {
        return handleCors(
          req,
          new Response(JSON.stringify({ error: 'Invalid bookmark ID' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      const result = removeBookmark(bookmarkId)
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
    if (req.method === 'POST' && url.pathname === '/api/song-bookmark-notes') {
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
    if (req.method === 'GET' && url.pathname === '/api/song-bookmarks/export') {
      const permError = checkPermission('songs.view')
      if (permError) return permError

      const text = exportBookmarksAsMarkdown()
      return handleCors(
        req,
        new Response(JSON.stringify({ data: text }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }

    // GET /api/song-bookmarks/text - The Marcaje list as editable Markdown
    if (req.method === 'GET' && url.pathname === '/api/song-bookmarks/text') {
      const permError = checkPermission('songs.view')
      if (permError) return permError

      return handleCors(
        req,
        new Response(JSON.stringify({ data: getBookmarksText() }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }

    // PUT /api/song-bookmarks/text - Replace the Marcaje list from text
    if (req.method === 'PUT' && url.pathname === '/api/song-bookmarks/text') {
      const permError = checkPermission('songs.view')
      if (permError) return permError

      let body: { text?: unknown }
      try {
        body = (await req.json()) as { text?: unknown }
      } catch {
        return handleCors(
          req,
          new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      if (typeof body.text !== 'string') {
        return handleCors(
          req,
          new Response(JSON.stringify({ error: 'Text is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      const result = replaceBookmarksFromText(body.text)
      return handleCors(
        req,
        new Response(JSON.stringify({ data: result }), {
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
          new Response(JSON.stringify({ error: 'id or urlPath is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
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

    // Livestream routes (YouTube, OBS integration)
    const livestreamResponse = await handleLivestreamRoutes(
      req,
      url,
      handleCors,
      checkPermission,
      _context,
    )
    if (livestreamResponse) return livestreamResponse

    // MIDI routes
    const midiResponse = await handleMIDIRoutes(
      req,
      url,
      handleCors,
      checkPermission,
    )
    if (midiResponse) return midiResponse

    // Screen share routes (native capture frames, MJPEG stream)
    const screenShareResponse = await handleScreenShareRoutes(
      req,
      url,
      handleCors,
      checkPermission,
    )
    if (screenShareResponse) return screenShareResponse

    // Screen links: another device shows a screen over WebRTC (T-214)
    if (url.pathname.startsWith('/api/screen-links')) {
      const screenLinkResponse = await handleScreenLinkRoutes(
        req,
        url,
        _context,
        checkPermission,
      )
      if (screenLinkResponse) return handleCors(req, screenLinkResponse)
    }

    // Remote access (phones reaching this computer over WebRTC)
    if (url.pathname.startsWith('/api/remote-access')) {
      const remoteAccessResponse = await handleRemoteAccessRoutes(
        req,
        url,
        checkPermission,
      )
      if (remoteAccessResponse) return handleCors(req, remoteAccessResponse)
    }

    // Live translation routes
    if (url.pathname.startsWith('/api/live-translation/')) {
      const translationResponse = await handleLiveTranslationRoutes(
        req,
        url,
        checkPermission,
        _context,
      )
      if (translationResponse) return handleCors(req, translationResponse)
    }

    // Music routes (folders, files, playlists)
    const musicResponse = await handleMusicRoutes(
      req,
      url,
      handleCors,
      checkPermission,
    )
    if (musicResponse) return musicResponse

    // Per-song edit history (list, entry detail, restore)
    const songHistoryResponse = await handleSongHistoryRoutes(
      req,
      url,
      handleCors,
      _context,
    )
    if (songHistoryResponse) return songHistoryResponse

    // Song sources (built-in configs and the user's own)
    const songSourcesResponse = await handleSongSourceRoutes(
      req,
      url,
      handleCors,
      _context,
    )
    if (songSourcesResponse) return songSourcesResponse

    // Bible verses by topic
    const bibleTopicsResponse = await handleBibleTopicRoutes(
      req,
      url,
      handleCors,
      _context,
    )
    if (bibleTopicsResponse) return bibleTopicsResponse

    // Slide templates and the screens' OBS scene templates (CH-184)
    const slideTemplatesResponse = await handleSlideTemplateRoutes(
      req,
      url,
      handleCors,
      _context,
    )
    if (slideTemplatesResponse) return slideTemplatesResponse

    // A presentation's and its items' slide templates (CH-184)
    const scheduleTemplatesResponse = await handleScheduleTemplateRoutes(
      req,
      url,
      handleCors,
      _context,
    )
    if (scheduleTemplatesResponse) return scheduleTemplatesResponse

    // The notifications history (song syncs, app updates)
    const notificationsResponse = await handleNotificationRoutes(
      req,
      url,
      handleCors,
      _context,
    )
    if (notificationsResponse) return notificationsResponse

    // Where the key sealing saved secrets is kept
    const secretStoreResponse = await handleSecretStoreRoutes(
      req,
      url,
      handleCors,
      _context,
    )
    if (secretStoreResponse) return secretStoreResponse

    // A presentation song item's MIDI file, its slides synced to it
    const scheduleMidiResponse = await handleScheduleMidiRoutes(
      req,
      url,
      handleCors,
      _context,
    )
    if (scheduleMidiResponse) return scheduleMidiResponse

    // Background media routes (screen background image/video uploads)
    const backgroundMediaResponse = await handleBackgroundMediaRoutes(
      req,
      url,
      handleCors,
      _context,
    )
    if (backgroundMediaResponse) return backgroundMediaResponse

    // The built-in themes' photos and videos (read-only)
    const themeBackgroundResponse = await handleThemeBackgroundRoutes(
      req,
      url,
      handleCors,
      _context,
    )
    if (themeBackgroundResponse) return themeBackgroundResponse

    // Usage data on/off (Settings > Privacy)
    const analyticsResponse = await handleAnalyticsRoutes(
      req,
      url,
      handleCors,
      _context,
    )
    if (analyticsResponse) return analyticsResponse

    // An API path no route answered: a 404, never the client app's page
    if (url.pathname.startsWith('/api/')) {
      return handleCors(
        req,
        Response.json({ error: 'Not found' }, { status: 404 }),
      )
    }

    // Serve client app (static files in production, proxy to Vite in development)
    if (canServeStaticFiles && clientDistPath) {
      // Production: serve from bundled static files
      const staticResponse = await serveStaticFile(url.pathname, clientDistPath)
      if (staticResponse) {
        return handleCors(req, staticResponse)
      }
    } else if (shouldProxyToVite) {
      // Development: proxy to Vite dev server
      return proxyToVite(req)
    }

    return handleCors(req, new Response('Not Found', { status: 404 }))
  }
}
