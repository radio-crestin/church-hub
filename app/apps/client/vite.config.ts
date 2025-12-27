import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import type { Plugin } from 'vite'
import { defineConfig, loadEnv } from 'vite'
import viteTsConfigPaths from 'vite-tsconfig-paths'

import packageJSON from './package.json'

const host = process.env.TAURI_DEV_HOST

/**
 * Kill any process using a specific port.
 * Called synchronously before Vite starts to prevent "Port is already in use" errors.
 */
function killPortProcess(port: number): void {
  // Get our own PID to avoid killing ourselves or parent processes
  const currentPid = process.pid
  const parentPid = process.ppid

  try {
    // Find PID using the port (Windows) - only LISTENING state
    const result = execSync(
      `netstat -ano | findstr :${port} | findstr LISTENING`,
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    )
    const lines = result.trim().split('\n')
    const pids = new Set<string>()
    for (const line of lines) {
      // Parse: TCP 0.0.0.0:8086 0.0.0.0:0 LISTENING 1234
      const parts = line.trim().split(/\s+/)
      // Verify this is actually our port (not just containing the number)
      const localAddress = parts[1]
      if (!localAddress?.endsWith(`:${port}`)) {
        continue
      }
      const pid = parts[parts.length - 1]
      if (pid && /^\d+$/.test(pid)) {
        const pidNum = Number.parseInt(pid, 10)
        // Don't kill ourselves or our parent
        if (pidNum !== currentPid && pidNum !== parentPid) {
          pids.add(pid)
        }
      }
    }
    for (const pid of pids) {
      console.log(`[vite] Killing stale process ${pid} on port ${port}`)
      try {
        execSync(`powershell -Command "Stop-Process -Id ${pid} -Force"`, {
          stdio: 'ignore',
        })
      } catch {
        // Process may have already exited
      }
    }
  } catch {
    // No process found on port, which is fine
  }
}

// Kill any stale process on port 8086 before Vite starts
killPortProcess(8086)

/**
 * Plugin to handle socket errors gracefully in development.
 * Prevents crashes from ECONNRESET errors when proxied connections are closed.
 */
function socketErrorHandler(): Plugin {
  return {
    name: 'socket-error-handler',
    configureServer(server) {
      server.httpServer?.on('connection', (socket) => {
        socket.on('error', (err: NodeJS.ErrnoException) => {
          // Ignore common socket errors that occur when clients disconnect
          if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
            return
          }
          // Log other socket errors for debugging
          console.error('[vite] Socket error:', err.message)
        })
      })
    },
  }
}

const config = defineConfig(({ mode }) => {
  // Load env from app/ directory (two levels up from apps/client)
  const env = loadEnv(mode, '../../', ['VITE_'])

  // Merge with process.env so VITE_ vars are available
  Object.assign(process.env, env)

  return {
    plugins: [
      socketErrorHandler(),
      viteTsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
      TanStackRouterVite({
        routeFileIgnorePattern: '(^[A-Z].*)',
      }),
      tailwindcss(),
      codeInspectorPlugin({
        bundler: 'vite',
        behavior: {
          copy: '{file}:{line}:{column}',
          locate: false,
        },
      }),
      viteReact(),
    ],
    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    // 1. prevent Vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
      port: 8086,
      strictPort: true,
      host: host || '0.0.0.0',
      // Always configure HMR to connect directly to Vite's port
      // This is needed because the app is accessed via port 3000 (proxy)
      hmr: {
        protocol: 'ws',
        host: host || 'localhost',
        port: 8086,
      },
      watch: {
        ignored: ['**/src-tauri/**'],
      },
      // Pre-transform entry files when server starts for faster first load
      warmup: {
        clientFiles: ['./src/router.tsx', './index.html'],
      },
    },
    resolve: {
      alias: {
        '~': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    // Pre-bundle heavy dependencies for faster dev startup
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        '@tanstack/react-router',
        '@tanstack/react-query',
        '@tauri-apps/api',
        '@tauri-apps/api/core',
        '@tauri-apps/plugin-dialog',
        '@tauri-apps/plugin-fs',
        '@tauri-apps/plugin-global-shortcut',
        '@tauri-apps/plugin-http',
        '@tauri-apps/plugin-opener',
        '@tauri-apps/plugin-shell',
        '@dnd-kit/core',
        '@dnd-kit/sortable',
        '@dnd-kit/utilities',
        '@tiptap/react',
        '@tiptap/core',
        '@tiptap/starter-kit',
        'i18next',
        'react-i18next',
        'i18next-browser-languagedetector',
        'lucide-react',
        'zod',
        'jszip',
        'qrcode',
      ],
    },
    // See `src/router.tsx` file to assign these defined values to window.
    define: {
      __appVersion: JSON.stringify(packageJSON.version),
      __envMode: JSON.stringify(mode),
    },
  }
})

export default config
