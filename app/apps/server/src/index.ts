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
  getQueue,
  type InsertSlideInput,
  insertSlideToQueue,
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
  cloneSongSlide,
  deleteCategory,
  deleteSong,
  deleteSongSlide,
  getAllCategories,
  getAllSongs,
  getSongWithSlides,
  type ReorderSongSlidesInput,
  rebuildSearchIndex,
  removeFromSearchIndex,
  reorderSongSlides,
  searchSongs,
  type UpsertCategoryInput,
  type UpsertSongInput,
  type UpsertSongSlideInput,
  updateSearchIndex,
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
  // Initialize database
  const db = await initializeDatabase()
  runMigrations(db)

  // Rebuild search indexes to ensure FTS tables are populated
  rebuildSearchIndex()
  rebuildScheduleSearchIndex()

  // Only listen to Rust IPC when running inside Tauri
  const isTauriMode =
    process.env.TAURI_MODE === 'true' || process.stdin.isTTY === false
  if (isTauriMode) {
    listenRustIPC()
  }

  const isProd = process.env.NODE_ENV === 'production'

  function handleCors(_: Request, res: Response) {
    res.headers.set('Access-Control-Allow-Origin', '*')
    res.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS',
    )
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
      // Schedules API Endpoints
      // ============================================================

      // GET /api/schedules/search - Search schedules (must be before /api/schedules/:id)
      if (req.method === 'GET' && url.pathname === '/api/schedules/search') {
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

      // POST /api/presentation/clear - Clear current slide (hide)
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

      // POST /api/presentation/show - Show last displayed slide
      if (req.method === 'POST' && url.pathname === '/api/presentation/show') {
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
        const query = url.searchParams.get('q') || ''
        const results = searchSongs(query)

        return handleCors(
          req,
          new Response(JSON.stringify({ data: results }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      // GET /api/songs - List all songs
      if (req.method === 'GET' && url.pathname === '/api/songs') {
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

          if (!body.title) {
            return handleCors(
              req,
              new Response(JSON.stringify({ error: 'Missing title' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const song = upsertSong(body)

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
        try {
          const body = (await req.json()) as {
            songs: BatchImportSongInput[]
            categoryId?: number | null
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

          const result = batchImportSongs(body.songs, body.categoryId)

          // Update search index for all imported songs
          for (const songId of result.songIds) {
            updateSearchIndex(songId)
          }

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

      // DELETE /api/songs/:id - Delete song
      const deleteSongMatch = url.pathname.match(/^\/api\/songs\/(\d+)$/)
      if (req.method === 'DELETE' && deleteSongMatch?.[1]) {
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
      // Song Categories API Endpoints
      // ============================================================

      // GET /api/categories - List all categories
      if (req.method === 'GET' && url.pathname === '/api/categories') {
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

      // ============================================================
      // Presentation Queue API Endpoints
      // ============================================================

      // GET /api/queue - Get all queue items
      if (req.method === 'GET' && url.pathname === '/api/queue') {
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

      // PUT /api/queue/slide/:id - Update a standalone slide in queue
      const updateSlideMatch = url.pathname.match(
        /^\/api\/queue\/slide\/(\d+)$/,
      )
      if (req.method === 'PUT' && updateSlideMatch?.[1]) {
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
