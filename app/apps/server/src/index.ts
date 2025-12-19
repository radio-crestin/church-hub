import process from 'node:process'

import { closeDatabase, initializeDatabase } from './db'
import type { RequestContext } from './middleware'
import {
  appOnlyAuthMiddleware,
  combinedAuthMiddleware,
  requirePermission,
} from './middleware'
import { getOpenApiSpec, getScalarDocs } from './openapi'
import {
  ALL_PERMISSIONS,
  type CreateUserInput,
  createUser,
  deleteSetting,
  deleteUser,
  getAllRoles,
  getAllSettings,
  getAllUsers,
  getSetting,
  getUserById,
  getUserByToken,
  type Permission,
  regenerateUserToken,
  type SettingsTable,
  setUserRole,
  type UpdateUserInput,
  updateUser,
  updateUserPermissions,
  upsertSetting,
} from './service'
import {
  type CreateTranslationInput,
  deleteTranslation,
  ensureRCCVExists,
  getAllTranslations,
  getBooksByTranslation,
  getChaptersForBook,
  getTranslationById,
  getVerse,
  getVerseById,
  getVersesByChapter,
  importUsfxTranslation,
  type SearchVersesInput,
  searchBible,
} from './service/bible'
import {
  checkLibreOfficeInstalled,
  convertPptToPptx,
} from './service/conversion'
import { getExternalInterfaces } from './service/network'
import {
  clearSlide,
  type DisplayTheme,
  deleteDisplay,
  getAllDisplays,
  getDisplayById,
  getPresentationState,
  navigateQueueSlide,
  showSlide,
  stopPresentation,
  type UpdatePresentationStateInput,
  type UpsertDisplayInput,
  updateDisplayTheme,
  updatePresentationState,
  upsertDisplay,
} from './service/presentation'
import {
  type AddToQueueInput,
  addToQueue,
  clearQueue,
  exportQueueToSchedule,
  getQueue,
  type InsertBiblePassageInput,
  type InsertBibleVerseInput,
  type InsertSlideInput,
  type InsertVerseteTineriInput,
  insertBiblePassageToQueue,
  insertBibleVerseToQueue,
  insertSlideToQueue,
  insertVerseteTineriToQueue,
  type ReorderQueueInput,
  removeFromQueue,
  reorderQueue,
  setExpanded,
  type UpdateSlideInput,
  updateSlide,
} from './service/queue'
import {
  type AddToScheduleInput,
  addItemToSchedule,
  deleteSchedule,
  getScheduleById,
  getSchedules,
  importScheduleToQueue,
  type ReorderScheduleItemsInput,
  rebuildScheduleSearchIndex,
  removeItemFromSchedule,
  reorderScheduleItems,
  searchSchedules,
  type UpdateScheduleSlideInput,
  type UpsertScheduleInput,
  updateScheduleSlide,
  upsertSchedule,
} from './service/schedules'
import {
  type BatchImportSongInput,
  batchImportSongs,
  batchUpdateSearchIndex,
  cloneSongSlide,
  deleteCategory,
  deleteSong,
  deleteSongSlide,
  getAllCategories,
  getAllSongs,
  getAllSongsWithSlides,
  getSongWithSlides,
  type ReorderCategoriesInput,
  type ReorderSongSlidesInput,
  rebuildSearchIndex,
  removeFromSearchIndex,
  reorderCategories,
  reorderSongSlides,
  searchSongs,
  type UpsertCategoryInput,
  type UpsertSongInput,
  type UpsertSongSlideInput,
  updateSearchIndex,
  updateSearchIndexByCategory,
  upsertCategory,
  upsertSong,
  upsertSongSlide,
} from './service/songs'
import {
  broadcastPresentationState,
  handleWebSocketClose,
  handleWebSocketMessage,
  handleWebSocketOpen,
  type WebSocketData,
} from './websocket'

async function main() {
  // Initialize database (Drizzle ORM wrapper) and run migrations
  const { migrationResult } = await initializeDatabase()

  // Only rebuild search indexes when FTS tables were recreated
  if (migrationResult.ftsRecreated) {
    rebuildSearchIndex()
    rebuildScheduleSearchIndex()
  }

  // Seed RCCV Bible translation if no translations exist
  ensureRCCVExists()

  const isProd = process.env.NODE_ENV === 'production'

  // biome-ignore lint/suspicious/noConsole: Startup logging
  console.log('[server] Starting with simple auth (localhost = admin)')

  function handleCors(req: Request, res: Response) {
    // Get the origin from the request, or use localhost as fallback
    const origin = req.headers.get('Origin') || 'http://localhost:8086'
    res.headers.set('Access-Control-Allow-Origin', origin)
    res.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS',
    )
    res.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-App-Session, Cache-Control',
    )
    res.headers.set('Access-Control-Allow-Credentials', 'true')
    return res
  }

  const server = Bun.serve<WebSocketData>({
    port: process.env['PORT'] ?? 3000,
    hostname: '0.0.0.0',
    async fetch(req: Request, server) {
      if (req.method === 'OPTIONS') {
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
        const host = req.headers.get('host')?.split(':')[0] ?? 'localhost'
        const frontendPort = process.env['VITE_PORT'] ?? 8086
        const frontendUrl = `http://${host}:${frontendPort}/`

        // Build cookie with domain for cross-port sharing
        // Note: Domain attribute allows cookie to be sent to all ports on the same host
        const cookieParts = [
          `user_auth=${token}`,
          'HttpOnly',
          'SameSite=Lax',
          'Max-Age=31536000',
          'Path=/',
        ]
        // Only add Domain for non-localhost (IP addresses need explicit domain)
        if (host !== 'localhost' && host !== '127.0.0.1') {
          cookieParts.push(`Domain=${host}`)
        }

        // Redirect to frontend app with cookie set
        const response = new Response(null, {
          status: 302,
          headers: {
            Location: frontendUrl,
            'Set-Cookie': cookieParts.join('; '),
          },
        })

        return handleCors(req, response)
      }

      // OpenAPI documentation endpoints (public)
      if (url.pathname === '/api/docs') {
        return handleCors(req, getScalarDocs())
      }
      if (url.pathname === '/api/openapi.json') {
        return handleCors(req, getOpenApiSpec())
      }

      // All /api/* routes require authentication (localhost = admin)
      if (url.pathname.startsWith('/api/')) {
        const authResult = await combinedAuthMiddleware(req)
        if (authResult.response) return handleCors(req, authResult.response)
        _context = authResult.context
      }
      if (url.pathname === '/') {
        return handleCors(
          req,
          new Response(JSON.stringify({ data: 'Hello from Bun!' })),
        )
      }
      if (url.pathname === '/ping') {
        return handleCors(req, new Response(JSON.stringify({ data: 'pong' })))
      }

      // Settings API endpoints
      // GET /api/settings/:table/:key - Get a setting by key
      const getSettingMatch = url.pathname.match(
        /^\/api\/settings\/([^/]+)\/([^/]+)$/,
      )
      if (req.method === 'GET' && getSettingMatch?.[1] && getSettingMatch[2]) {
        const permError = checkPermission('settings.view')
        if (permError) return permError

        const table = getSettingMatch[1] as SettingsTable
        const key = getSettingMatch[2]

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
        const permError = checkPermission('settings.edit')
        if (permError) return permError

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

      // Helper function to check app-only auth
      async function requireAppAuth(): Promise<Response | null> {
        if (isProd) {
          const authResult = await appOnlyAuthMiddleware(req)
          if (authResult.response) return handleCors(req, authResult.response)
        }
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

      // GET /api/auth/me - Get current user's info and permissions
      if (req.method === 'GET' && url.pathname === '/api/auth/me') {
        const authResult = await combinedAuthMiddleware(req)
        if (authResult.response) return handleCors(req, authResult.response)

        if (authResult.context?.authType === 'app') {
          return handleCors(
            req,
            new Response(
              JSON.stringify({
                data: {
                  id: 0,
                  name: 'Local Admin',
                  authType: 'app',
                  isAdmin: true,
                  isApp: true,
                  permissions: ALL_PERMISSIONS,
                },
              }),
              {
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }

        if (authResult.context?.userId) {
          const user = getUserById(authResult.context.userId)
          return handleCors(
            req,
            new Response(
              JSON.stringify({
                data: {
                  authType: 'user',
                  user,
                  isAdmin: false,
                  permissions: authResult.context.permissions || [],
                },
              }),
              {
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }),
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

      // POST /api/schedules/:id/import-to-queue - Import schedule to queue
      const importScheduleMatch = url.pathname.match(
        /^\/api\/schedules\/(\d+)\/import-to-queue$/,
      )
      if (req.method === 'POST' && importScheduleMatch?.[1]) {
        const permError = checkPermission('programs.import_to_queue')
        if (permError) return permError

        const scheduleId = parseInt(importScheduleMatch[1], 10)
        const result = importScheduleToQueue(scheduleId)

        if (!result) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({ error: 'Failed to import schedule' }),
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

      // ============================================================
      // Displays API Endpoints
      // ============================================================

      // GET /api/displays - List all displays
      if (req.method === 'GET' && url.pathname === '/api/displays') {
        const permError = checkPermission('displays.view')
        if (permError) return permError

        const displays = getAllDisplays()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: displays }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/displays/:id - Get display by ID
      const getDisplayMatch = url.pathname.match(/^\/api\/displays\/(\d+)$/)
      if (req.method === 'GET' && getDisplayMatch?.[1]) {
        const permError = checkPermission('displays.view')
        if (permError) return permError

        const id = parseInt(getDisplayMatch[1], 10)
        const display = getDisplayById(id)

        if (!display) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Display not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ data: display }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/displays - Create/update display
      if (req.method === 'POST' && url.pathname === '/api/displays') {
        try {
          const body = (await req.json()) as UpsertDisplayInput

          // Check create or edit permission based on whether it's a new display
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

          const display = upsertDisplay(body)

          if (!display) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({ error: 'Failed to save display' }),
                {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: display }), {
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

      // DELETE /api/displays/:id - Delete display
      const deleteDisplayMatch = url.pathname.match(/^\/api\/displays\/(\d+)$/)
      if (req.method === 'DELETE' && deleteDisplayMatch?.[1]) {
        const permError = checkPermission('displays.delete')
        if (permError) return permError

        const id = parseInt(deleteDisplayMatch[1], 10)
        const result = deleteDisplay(id)

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

      // PUT /api/displays/:id/theme - Update display theme
      const updateThemeMatch = url.pathname.match(
        /^\/api\/displays\/(\d+)\/theme$/,
      )
      if (req.method === 'PUT' && updateThemeMatch?.[1]) {
        const permError = checkPermission('displays.edit')
        if (permError) return permError

        try {
          const id = parseInt(updateThemeMatch[1], 10)
          const body = (await req.json()) as { theme: DisplayTheme }

          if (!body.theme) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing theme' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const result = updateDisplayTheme(id, body.theme)

          if (!result.success) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: result.error }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const display = getDisplayById(id)
          return handleCors(
            req,
            new Response(JSON.stringify({ data: display }), {
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

        return handleCors(
          req,
          new Response(JSON.stringify({ data: state }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/presentation/navigate-queue - Navigate queue slides
      if (
        req.method === 'POST' &&
        url.pathname === '/api/presentation/navigate-queue'
      ) {
        const permError = checkPermission('control_room.control')
        if (permError) return permError

        try {
          const body = (await req.json()) as { direction: 'next' | 'prev' }

          if (!body.direction) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing direction' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const state = navigateQueueSlide(body.direction)
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
        const results = searchSongs(query)

        return handleCors(
          req,
          new Response(JSON.stringify({ data: results }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
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

      // GET /api/songs - List all songs
      if (req.method === 'GET' && url.pathname === '/api/songs') {
        const permError = checkPermission('songs.view')
        if (permError) return permError

        const songs = getAllSongs()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: songs }), {
            headers: { 'Content-Type': 'application/json' },
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
          const permError = checkPermission(
            body.id ? 'songs.edit' : 'songs.create',
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

          return handleCors(
            req,
            new Response(JSON.stringify({ data: song }), {
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

      // POST /api/songs/batch - Batch import songs
      if (req.method === 'POST' && url.pathname === '/api/songs/batch') {
        const permError = checkPermission('songs.create')
        if (permError) return permError

        try {
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

          const result = batchImportSongs(
            body.songs,
            body.categoryId,
            body.overwriteDuplicates,
            body.skipManuallyEdited,
          )

          // Update search index for all imported songs in a single batch operation
          batchUpdateSearchIndex(result.songIds)

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

      // ============================================================
      // File Conversion API Endpoints
      // ============================================================

      // GET /api/convert/check-libreoffice - Check if LibreOffice is installed
      if (
        req.method === 'GET' &&
        url.pathname === '/api/convert/check-libreoffice'
      ) {
        const permError = checkPermission('songs.view')
        if (permError) return permError

        const isInstalled = await checkLibreOfficeInstalled()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: { installed: isInstalled } }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/convert/ppt-to-pptx - Convert PPT to PPTX
      if (
        req.method === 'POST' &&
        url.pathname === '/api/convert/ppt-to-pptx'
      ) {
        const permError = checkPermission('songs.create')
        if (permError) return permError

        try {
          const body = (await req.json()) as { data: string }

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

          // Convert using service
          const result = await convertPptToPptx(pptBuffer)

          if (!result.success) {
            const status =
              result.errorCode === 'LIBREOFFICE_NOT_INSTALLED' ? 503 : 500
            return handleCors(
              req,
              new Response(
                JSON.stringify({
                  error: result.error,
                  errorCode: result.errorCode,
                }),
                {
                  status,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Return converted PPTX as base64
          const pptxBase64 = result.data!.toString('base64')
          return handleCors(
            req,
            new Response(JSON.stringify({ data: pptxBase64 }), {
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Conversion failed' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
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

      // GET /api/bible/translations - List all translations
      if (req.method === 'GET' && url.pathname === '/api/bible/translations') {
        const permError = checkPermission('bible.view')
        if (permError) return permError

        const translations = getAllTranslations()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: translations }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/bible/translations/:id - Get single translation
      const getTranslationMatch = url.pathname.match(
        /^\/api\/bible\/translations\/(\d+)$/,
      )
      if (req.method === 'GET' && getTranslationMatch?.[1]) {
        const permError = checkPermission('bible.view')
        if (permError) return permError

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

          const result = importUsfxTranslation(body)

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

        const translationId = parseInt(getBooksMatch[1], 10)
        const books = getBooksByTranslation(translationId)

        return handleCors(
          req,
          new Response(JSON.stringify({ data: books }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/bible/chapters/:bookId - Get chapters for book
      const getChaptersMatch = url.pathname.match(
        /^\/api\/bible\/chapters\/(\d+)$/,
      )
      if (req.method === 'GET' && getChaptersMatch?.[1]) {
        const permError = checkPermission('bible.view')
        if (permError) return permError

        const bookId = parseInt(getChaptersMatch[1], 10)
        const chapters = getChaptersForBook(bookId)

        return handleCors(
          req,
          new Response(JSON.stringify({ data: chapters }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/bible/verses/:bookId/:chapter - Get verses for chapter
      const getVersesMatch = url.pathname.match(
        /^\/api\/bible\/verses\/(\d+)\/(\d+)$/,
      )
      if (req.method === 'GET' && getVersesMatch?.[1] && getVersesMatch?.[2]) {
        const permError = checkPermission('bible.view')
        if (permError) return permError

        const bookId = parseInt(getVersesMatch[1], 10)
        const chapter = parseInt(getVersesMatch[2], 10)
        const verses = getVersesByChapter(bookId, chapter)

        return handleCors(
          req,
          new Response(JSON.stringify({ data: verses }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/bible/verse/:verseId - Get single verse by ID
      const getVerseMatch = url.pathname.match(/^\/api\/bible\/verse\/(\d+)$/)
      if (req.method === 'GET' && getVerseMatch?.[1]) {
        const permError = checkPermission('bible.view')
        if (permError) return permError

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
      }

      // GET /api/bible/search - Search verses (by reference or text)
      if (req.method === 'GET' && url.pathname === '/api/bible/search') {
        const permError = checkPermission('bible.view')
        if (permError) return permError

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

          // Re-index songs when updating category name
          if (body.id) {
            updateSearchIndexByCategory(body.id)
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
      // Presentation Queue API Endpoints
      // ============================================================

      // GET /api/queue - Get all queue items
      if (req.method === 'GET' && url.pathname === '/api/queue') {
        const permError = checkPermission('queue.view')
        if (permError) return permError

        const queue = getQueue()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: queue }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/queue - Add song to queue
      if (req.method === 'POST' && url.pathname === '/api/queue') {
        const permError = checkPermission('queue.add')
        if (permError) return permError

        try {
          const body = (await req.json()) as AddToQueueInput

          if (!body.songId) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing songId' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const queueItem = addToQueue(body)

          if (!queueItem) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({ error: 'Failed to add to queue' }),
                {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Handle presentNow: auto-select and present the first slide
          if (body.presentNow && queueItem.slides.length > 0) {
            const firstSlideId = queueItem.slides[0].id
            const state = updatePresentationState({
              currentQueueItemId: queueItem.id,
              currentSongSlideId: firstSlideId,
              isPresenting: true,
              isHidden: false,
            })
            broadcastPresentationState(state)
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: queueItem }), {
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

      // POST /api/queue/slide - Insert standalone slide to queue
      if (req.method === 'POST' && url.pathname === '/api/queue/slide') {
        const permError = checkPermission('queue.add')
        if (permError) return permError

        try {
          const body = (await req.json()) as InsertSlideInput

          if (!body.slideType || !body.slideContent) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({ error: 'Missing slideType or slideContent' }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          const queueItem = insertSlideToQueue(body)

          if (!queueItem) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({ error: 'Failed to insert slide to queue' }),
                {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: queueItem }), {
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

      // POST /api/queue/bible - Insert Bible verse to queue
      if (req.method === 'POST' && url.pathname === '/api/queue/bible') {
        const permError = checkPermission('queue.add')
        if (permError) return permError

        try {
          const body = (await req.json()) as InsertBibleVerseInput

          if (
            !body.verseId ||
            !body.reference ||
            !body.text ||
            !body.translationAbbreviation
          ) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({
                  error:
                    'Missing verseId, reference, text, or translationAbbreviation',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          const queueItem = insertBibleVerseToQueue(body)

          if (!queueItem) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({
                  error: 'Failed to insert Bible verse to queue',
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
            new Response(JSON.stringify({ data: queueItem }), {
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

      // POST /api/queue/bible-passage - Insert Bible passage (verse range) to queue
      if (
        req.method === 'POST' &&
        url.pathname === '/api/queue/bible-passage'
      ) {
        const permError = checkPermission('queue.add')
        if (permError) return permError

        try {
          const body = (await req.json()) as InsertBiblePassageInput

          if (
            !body.translationId ||
            !body.translationAbbreviation ||
            !body.bookCode ||
            !body.bookName ||
            body.startChapter === undefined ||
            body.startVerse === undefined ||
            body.endChapter === undefined ||
            body.endVerse === undefined
          ) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({
                  error:
                    'Missing required fields: translationId, translationAbbreviation, bookCode, bookName, startChapter, startVerse, endChapter, endVerse',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          const queueItem = insertBiblePassageToQueue(body)

          if (!queueItem) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({
                  error: 'Failed to insert Bible passage to queue',
                }),
                {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Handle presentNow: auto-select and present the first verse
          if (body.presentNow && queueItem.biblePassageVerses.length > 0) {
            const firstVerseId = queueItem.biblePassageVerses[0].id
            const state = updatePresentationState({
              currentQueueItemId: queueItem.id,
              currentBiblePassageVerseId: firstVerseId,
              isPresenting: true,
              isHidden: false,
            })
            broadcastPresentationState(state)
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: queueItem }), {
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

      // POST /api/queue/versete-tineri - Insert Versete Tineri group to queue
      if (
        req.method === 'POST' &&
        url.pathname === '/api/queue/versete-tineri'
      ) {
        const permError = checkPermission('queue.add')
        if (permError) return permError

        try {
          const body = (await req.json()) as InsertVerseteTineriInput

          if (
            !body.entries ||
            !Array.isArray(body.entries) ||
            body.entries.length === 0
          ) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({
                  error:
                    'Missing required field: entries (must be a non-empty array)',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Validate each entry
          for (const entry of body.entries) {
            if (
              !entry.personName ||
              !entry.translationId ||
              !entry.bookCode ||
              !entry.bookName ||
              entry.startChapter === undefined ||
              entry.startVerse === undefined ||
              entry.endChapter === undefined ||
              entry.endVerse === undefined
            ) {
              return handleCors(
                req,
                new Response(
                  JSON.stringify({
                    error:
                      'Each entry must have: personName, translationId, bookCode, bookName, startChapter, startVerse, endChapter, endVerse',
                  }),
                  {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                  },
                ),
              )
            }
          }

          const queueItem = insertVerseteTineriToQueue(body)

          if (!queueItem) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({
                  error: 'Failed to insert Versete Tineri to queue',
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
            new Response(JSON.stringify({ data: queueItem }), {
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

      // PUT /api/queue/slide/:id - Update a standalone slide in queue
      const updateSlideMatch = url.pathname.match(
        /^\/api\/queue\/slide\/(\d+)$/,
      )
      if (req.method === 'PUT' && updateSlideMatch?.[1]) {
        const permError = checkPermission('queue.add')
        if (permError) return permError

        try {
          const id = parseInt(updateSlideMatch[1], 10)
          const body = (await req.json()) as Partial<UpdateSlideInput>

          if (!body.slideType || !body.slideContent) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({ error: 'Missing slideType or slideContent' }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          const queueItem = updateSlide({
            id,
            slideType: body.slideType,
            slideContent: body.slideContent,
          })

          if (!queueItem) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({ error: 'Failed to update slide in queue' }),
                {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // If this slide is currently being displayed, broadcast to refresh displays
          const currentState = getPresentationState()
          if (currentState.currentQueueItemId === id) {
            // Update the timestamp to trigger refetch on clients
            const updatedState = updatePresentationState({})
            broadcastPresentationState(updatedState)
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: queueItem }), {
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

      // DELETE /api/queue - Clear entire queue
      if (req.method === 'DELETE' && url.pathname === '/api/queue') {
        const permError = checkPermission('queue.clear')
        if (permError) return permError

        const result = clearQueue()

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

      // DELETE /api/queue/:id - Remove item from queue
      const removeFromQueueMatch = url.pathname.match(/^\/api\/queue\/(\d+)$/)
      if (req.method === 'DELETE' && removeFromQueueMatch?.[1]) {
        const permError = checkPermission('queue.remove')
        if (permError) return permError

        const id = parseInt(removeFromQueueMatch[1], 10)
        const result = removeFromQueue(id)

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

      // PUT /api/queue/reorder - Reorder queue items
      if (req.method === 'PUT' && url.pathname === '/api/queue/reorder') {
        const permError = checkPermission('queue.reorder')
        if (permError) return permError

        try {
          const body = (await req.json()) as ReorderQueueInput

          if (!body.itemIds || !Array.isArray(body.itemIds)) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing itemIds array' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const result = reorderQueue(body)

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

      // PUT /api/queue/:id/expand - Set queue item expanded state
      const expandQueueMatch = url.pathname.match(
        /^\/api\/queue\/(\d+)\/expand$/,
      )
      if (req.method === 'PUT' && expandQueueMatch?.[1]) {
        const permError = checkPermission('queue.view')
        if (permError) return permError

        try {
          const id = parseInt(expandQueueMatch[1], 10)
          const body = (await req.json()) as { expanded: boolean }

          if (body.expanded === undefined) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing expanded' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const queueItem = setExpanded(id, body.expanded)

          if (!queueItem) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({ error: 'Failed to update queue item' }),
                {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: queueItem }), {
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

      // POST /api/queue/export-to-schedule - Export queue to a new schedule
      if (
        req.method === 'POST' &&
        url.pathname === '/api/queue/export-to-schedule'
      ) {
        const permError = checkPermission('programs.create')
        if (permError) return permError

        try {
          const body = (await req.json()) as { title: string }

          if (!body.title) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing title' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const scheduleId = exportQueueToSchedule(body.title)

          if (!scheduleId) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({ error: 'Failed to export queue to schedule' }),
                {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          return handleCors(
            req,
            new Response(
              JSON.stringify({ success: true, data: { scheduleId } }),
              {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
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

      return handleCors(req, new Response('Not Found', { status: 404 }))
    },
    websocket: {
      open: handleWebSocketOpen,
      message: handleWebSocketMessage,
      close: handleWebSocketClose,
    },
  })

  // biome-ignore lint/suspicious/noConsole: <>
  console.log(`Bun server running at ${server.url}`)

  // Graceful shutdown
  process.on('SIGINT', () => {
    closeDatabase()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    closeDatabase()
    process.exit(0)
  })
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: Need to log startup errors
  console.error('Server failed to start:', error)
  process.exit(1)
})
