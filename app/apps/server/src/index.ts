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

  const server = Bun.serve({
    port: process.env['PORT'] ?? 3000,
    hostname: '127.0.0.1',
    async fetch(req: Request) {
      if (req.method === 'OPTIONS') {
        return handleCors(req, new Response(null, { status: 204 }))
      }

      const url = new URL(req.url)
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
            new Response(
              JSON.stringify({ error: String(error) }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
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

      return handleCors(req, new Response('Not Found', { status: 404 }))
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
