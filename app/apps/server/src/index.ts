import process from 'node:process'

import { closeDatabase, initializeDatabase, runMigrations } from './db'
import type { RequestContext } from './middleware'
import { appOnlyAuthMiddleware, combinedAuthMiddleware } from './middleware'
import { getOpenApiSpec, getScalarDocs } from './openapi'
import { listenRustIPC } from './rust-ipc'
import {
  type CreateDeviceInput,
  createDevice,
  type DevicePermissions,
  deleteDevice,
  deleteSetting,
  getAllDevices,
  getAllSettings,
  getDeviceById,
  getDeviceByToken,
  getSetting,
  regenerateDeviceToken,
  type SettingsTable,
  type UpdateDeviceInput,
  updateDevice,
  updateDevicePermissions,
  upsertSetting,
} from './service'
import {
  clearSlide,
  type DisplayTheme,
  deleteDisplay,
  getAllDisplays,
  getDisplayById,
  getPresentationState,
  type NavigateInput,
  navigateSlide,
  startPresentation,
  stopPresentation,
  type UpdatePresentationStateInput,
  type UpsertDisplayInput,
  updateDisplayTheme,
  updatePresentationState,
  upsertDisplay,
} from './service/presentation'
import {
  deleteProgram,
  deleteSlide,
  getAllPrograms,
  getProgramWithSlides,
  getSlideById,
  type ReorderSlidesInput,
  reorderSlides,
  type UpsertProgramInput,
  type UpsertSlideInput,
  upsertProgram,
  upsertSlide,
} from './service/programs'
import {
  broadcastPresentationState,
  handleWebSocketClose,
  handleWebSocketMessage,
  handleWebSocketOpen,
  type WebSocketData,
} from './websocket'

async function main() {
  // Initialize database
  const db = await initializeDatabase()
  runMigrations(db)

  // Only listen to Rust IPC when running inside Tauri
  const isTauriMode =
    process.env.TAURI_MODE === 'true' || process.stdin.isTTY === false
  if (isTauriMode) {
    listenRustIPC()
  }

  const isProd = process.env.NODE_ENV === 'production'

  function handleCors(_: Request, res: Response) {
    res.headers.set('Access-Control-Allow-Origin', '*')
    res.headers.set('Access-Control-Allow-Headers', '*')
    res.headers.set('Access-Control-Allow-Credentials', 'true')
    return res
  }

  const server = Bun.serve<WebSocketData>({
    port: process.env['PORT'] ?? 3000,
    hostname: '127.0.0.1',
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

      // Device authentication endpoint (public - sets cookie)
      const deviceAuthMatch = url.pathname.match(
        /^\/api\/auth\/device\/([^/]+)$/,
      )
      if (req.method === 'GET' && deviceAuthMatch?.[1]) {
        const token = decodeURIComponent(deviceAuthMatch[1])
        const device = await getDeviceByToken(token)

        if (!device || !device.isActive) {
          return handleCors(
            req,
            new Response(
              JSON.stringify({
                error: 'Invalid or inactive device token',
              }),
              {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }

        // Redirect to main app with cookie set
        const response = new Response(null, {
          status: 302,
          headers: {
            Location: '/',
            'Set-Cookie': `device_auth=${token}; HttpOnly; SameSite=Lax; Max-Age=31536000; Path=/`,
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

      // All other /api/* routes require authentication in production
      if (isProd && url.pathname.startsWith('/api/')) {
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
        const table = getSettingMatch[1] as SettingsTable
        const key = getSettingMatch[2]

        const setting = getSetting(table, key)
        if (!setting) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Setting not found' }), {
              status: 404,
            }),
          )
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ data: setting }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/settings/:table - Get all settings from a table
      const getAllSettingsMatch = url.pathname.match(
        /^\/api\/settings\/([^/]+)$/,
      )
      if (req.method === 'GET' && getAllSettingsMatch) {
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

      // GET /api/devices - List all devices
      if (req.method === 'GET' && url.pathname === '/api/devices') {
        const authError = await requireAppAuth()
        if (authError) return authError

        const devices = getAllDevices()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: devices }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/devices/:id - Get device by ID
      const getDeviceMatch = url.pathname.match(/^\/api\/devices\/(\d+)$/)
      if (req.method === 'GET' && getDeviceMatch?.[1]) {
        const authError = await requireAppAuth()
        if (authError) return authError

        const id = parseInt(getDeviceMatch[1], 10)
        const device = getDeviceById(id)

        if (!device) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Device not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ data: device }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/devices - Create new device
      if (req.method === 'POST' && url.pathname === '/api/devices') {
        const authError = await requireAppAuth()
        if (authError) return authError

        try {
          const body = (await req.json()) as CreateDeviceInput

          if (!body.name || !body.permissions) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({ error: 'Missing name or permissions' }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          const result = await createDevice(body)

          if (!result) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({ error: 'Failed to create device' }),
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
              status: 201,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch (error) {
          // biome-ignore lint/suspicious/noConsole: debugging
          console.error('Create device error:', error)
          return handleCors(
            req,
            new Response(JSON.stringify({ error: String(error) }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // PUT /api/devices/:id - Update device
      const updateDeviceMatch = url.pathname.match(/^\/api\/devices\/(\d+)$/)
      if (req.method === 'PUT' && updateDeviceMatch?.[1]) {
        const authError = await requireAppAuth()
        if (authError) return authError

        const id = parseInt(updateDeviceMatch[1], 10)

        try {
          const body = (await req.json()) as UpdateDeviceInput
          const result = updateDevice(id, body)

          if (!result.success) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: result.error }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const updatedDevice = getDeviceById(id)
          return handleCors(
            req,
            new Response(JSON.stringify({ data: updatedDevice }), {
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

      // DELETE /api/devices/:id - Delete device
      const deleteDeviceMatch = url.pathname.match(/^\/api\/devices\/(\d+)$/)
      if (req.method === 'DELETE' && deleteDeviceMatch?.[1]) {
        const authError = await requireAppAuth()
        if (authError) return authError

        const id = parseInt(deleteDeviceMatch[1], 10)
        const result = deleteDevice(id)

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

      // PUT /api/devices/:id/permissions - Update device permissions
      const updatePermissionsMatch = url.pathname.match(
        /^\/api\/devices\/(\d+)\/permissions$/,
      )
      if (req.method === 'PUT' && updatePermissionsMatch?.[1]) {
        const authError = await requireAppAuth()
        if (authError) return authError

        const id = parseInt(updatePermissionsMatch[1], 10)

        try {
          const body = (await req.json()) as { permissions: DevicePermissions }

          if (!body.permissions) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing permissions' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const result = updateDevicePermissions(id, body.permissions)

          if (!result.success) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: result.error }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const updatedDevice = getDeviceById(id)
          return handleCors(
            req,
            new Response(JSON.stringify({ data: updatedDevice }), {
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

      // POST /api/devices/:id/regenerate-token - Regenerate device token
      const regenerateTokenMatch = url.pathname.match(
        /^\/api\/devices\/(\d+)\/regenerate-token$/,
      )
      if (req.method === 'POST' && regenerateTokenMatch?.[1]) {
        const authError = await requireAppAuth()
        if (authError) return authError

        const id = parseInt(regenerateTokenMatch[1], 10)
        const result = await regenerateDeviceToken(id)

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

        const device = getDeviceById(id)
        return handleCors(
          req,
          new Response(
            JSON.stringify({
              data: { device, token: result.token },
            }),
            {
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        )
      }

      // ============================================================
      // Programs API Endpoints
      // ============================================================

      // GET /api/programs - List all programs
      if (req.method === 'GET' && url.pathname === '/api/programs') {
        const programs = getAllPrograms()
        return handleCors(
          req,
          new Response(JSON.stringify({ data: programs }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/programs/:id - Get program with slides
      const getProgramMatch = url.pathname.match(/^\/api\/programs\/(\d+)$/)
      if (req.method === 'GET' && getProgramMatch?.[1]) {
        const id = parseInt(getProgramMatch[1], 10)
        const program = getProgramWithSlides(id)

        if (!program) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Program not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return handleCors(
          req,
          new Response(JSON.stringify({ data: program }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/programs - Create/update program
      if (req.method === 'POST' && url.pathname === '/api/programs') {
        try {
          const body = (await req.json()) as UpsertProgramInput

          if (!body.name) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing name' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const program = upsertProgram(body)

          if (!program) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({ error: 'Failed to save program' }),
                {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          return handleCors(
            req,
            new Response(JSON.stringify({ data: program }), {
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

      // DELETE /api/programs/:id - Delete program
      const deleteProgramMatch = url.pathname.match(/^\/api\/programs\/(\d+)$/)
      if (req.method === 'DELETE' && deleteProgramMatch?.[1]) {
        const id = parseInt(deleteProgramMatch[1], 10)
        const result = deleteProgram(id)

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
      // Slides API Endpoints
      // ============================================================

      // POST /api/slides - Create/update slide
      if (req.method === 'POST' && url.pathname === '/api/slides') {
        try {
          const body = (await req.json()) as UpsertSlideInput

          if (!body.programId || !body.content) {
            return handleCors(
              req,
              new Response(
                JSON.stringify({ error: 'Missing programId or content' }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          const slide = upsertSlide(body)

          if (!slide) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Failed to save slide' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
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

      // GET /api/slides/:id - Get slide by ID
      const getSlideMatch = url.pathname.match(/^\/api\/slides\/(\d+)$/)
      if (req.method === 'GET' && getSlideMatch?.[1]) {
        const id = parseInt(getSlideMatch[1], 10)
        const slide = getSlideById(id)

        if (!slide) {
          return handleCors(
            req,
            new Response(JSON.stringify({ error: 'Slide not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return handleCors(
          req,
          new Response(JSON.stringify(slide), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // DELETE /api/slides/:id - Delete slide
      const deleteSlideMatch = url.pathname.match(/^\/api\/slides\/(\d+)$/)
      if (req.method === 'DELETE' && deleteSlideMatch?.[1]) {
        const id = parseInt(deleteSlideMatch[1], 10)
        const result = deleteSlide(id)

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

      // PUT /api/programs/:id/slides/reorder - Reorder slides
      const reorderSlidesMatch = url.pathname.match(
        /^\/api\/programs\/(\d+)\/slides\/reorder$/,
      )
      if (req.method === 'PUT' && reorderSlidesMatch?.[1]) {
        try {
          const programId = parseInt(reorderSlidesMatch[1], 10)
          const body = (await req.json()) as ReorderSlidesInput

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

          const result = reorderSlides(programId, body)

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
      // Displays API Endpoints
      // ============================================================

      // GET /api/displays - List all displays
      if (req.method === 'GET' && url.pathname === '/api/displays') {
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

      // POST /api/presentation/navigate - Navigate slides
      if (
        req.method === 'POST' &&
        url.pathname === '/api/presentation/navigate'
      ) {
        try {
          const body = (await req.json()) as NavigateInput

          if (!body.direction) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing direction' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const state = navigateSlide(body)
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

      // POST /api/presentation/start - Start presenting a program
      if (req.method === 'POST' && url.pathname === '/api/presentation/start') {
        try {
          const body = (await req.json()) as { programId: number }

          if (!body.programId) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing programId' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const state = startPresentation(body.programId)
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
        const state = stopPresentation()
        broadcastPresentationState(state)

        return handleCors(
          req,
          new Response(JSON.stringify({ data: state }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // POST /api/presentation/clear - Clear current slide
      if (req.method === 'POST' && url.pathname === '/api/presentation/clear') {
        const state = clearSlide()
        broadcastPresentationState(state)

        return handleCors(
          req,
          new Response(JSON.stringify({ data: state }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
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
