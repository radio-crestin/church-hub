import process from 'node:process'

import { authMiddleware } from './middleware'
import { listenRustIPC } from './rust-ipc'
import { initializeDatabase, runMigrations, closeDatabase } from './db'
import { upsertSetting, deleteSetting, getSetting, getAllSettings, type SettingsTable } from './service'

async function main() {
  // Initialize database
  const db = await initializeDatabase()
  runMigrations(db)

  // Only listen to Rust IPC when running inside Tauri
  const isTauriMode = process.env.TAURI_MODE === 'true' || process.stdin.isTTY === false
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

    if (isProd) {
      const authResp = await authMiddleware(req)
      if (authResp) return handleCors(req, authResp)
    }

    const url = new URL(req.url)
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
    const getSettingMatch = url.pathname.match(/^\/api\/settings\/([^/]+)\/([^/]+)$/)
    if (req.method === 'GET' && getSettingMatch) {
      const table = getSettingMatch[1] as SettingsTable
      const key = getSettingMatch[2]

      const setting = getSetting(table, key)
      if (!setting) {
        return handleCors(req, new Response(JSON.stringify({ error: 'Setting not found' }), { status: 404 }))
      }

      return handleCors(req, new Response(JSON.stringify({ data: setting }), {
        headers: { 'Content-Type': 'application/json' }
      }))
    }

    // GET /api/settings/:table - Get all settings from a table
    const getAllSettingsMatch = url.pathname.match(/^\/api\/settings\/([^/]+)$/)
    if (req.method === 'GET' && getAllSettingsMatch) {
      const table = getAllSettingsMatch[1] as SettingsTable
      const settings = getAllSettings(table)

      return handleCors(req, new Response(JSON.stringify({ data: settings }), {
        headers: { 'Content-Type': 'application/json' }
      }))
    }

    // POST /api/settings/:table - Upsert a setting
    if (req.method === 'POST' && url.pathname.match(/^\/api\/settings\/([^/]+)$/)) {
      const tableMatch = url.pathname.match(/^\/api\/settings\/([^/]+)$/)
      const table = tableMatch![1] as SettingsTable

      try {
        const body = await req.json() as { key: string; value: string }

        if (!body.key || !body.value) {
          return handleCors(req, new Response(JSON.stringify({ error: 'Missing key or value' }), { status: 400 }))
        }

        const result = upsertSetting(table, { key: body.key, value: body.value })

        if (!result.success) {
          return handleCors(req, new Response(JSON.stringify({ error: result.error }), { status: 500 }))
        }

        return handleCors(req, new Response(JSON.stringify({ data: result }), {
          headers: { 'Content-Type': 'application/json' }
        }))
      } catch (error) {
        return handleCors(req, new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 }))
      }
    }

    // DELETE /api/settings/:table/:key - Delete a setting
    const deleteSettingMatch = url.pathname.match(/^\/api\/settings\/([^/]+)\/([^/]+)$/)
    if (req.method === 'DELETE' && deleteSettingMatch) {
      const table = deleteSettingMatch[1] as SettingsTable
      const key = deleteSettingMatch[2]

      const result = deleteSetting(table, key)

      if (!result.success) {
        return handleCors(req, new Response(JSON.stringify({ error: result.error }), { status: 404 }))
      }

      return handleCors(req, new Response(JSON.stringify({ data: result }), {
        headers: { 'Content-Type': 'application/json' }
      }))
    }

    return handleCors(req, new Response('Not Found', { status: 404 }))
    },
  })

  // biome-ignore lint/suspicious/noConsole: <>
  console.log(`Bun server running at ${server.url}`)

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...')
    closeDatabase()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    console.log('\nShutting down gracefully...')
    closeDatabase()
    process.exit(0)
  })
}

main().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
