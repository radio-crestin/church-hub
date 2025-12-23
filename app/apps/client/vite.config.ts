import { fileURLToPath } from 'url'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import { defineConfig, loadEnv } from 'vite'
import viteTsConfigPaths from 'vite-tsconfig-paths'

import packageJSON from './package.json'

const host = process.env.TAURI_DEV_HOST

const config = defineConfig(({ mode }) => {
  // Load env from app/ directory (two levels up from apps/client)
  const env = loadEnv(mode, '../../', ['VITE_'])

  // Merge with process.env so VITE_ vars are available
  Object.assign(process.env, env)

  return {
    plugins: [
      viteTsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
      TanStackRouterVite({
        routeFileIgnorePattern: '(^[A-Z].*)',
      }),
      tailwindcss(),
      viteReact(),
      codeInspectorPlugin({
        bundler: 'vite',
        behavior: {
          copy: '{file}:{line}:{column}',
          locate: false,
        },
      }),
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
    },
    resolve: {
      alias: {
        '~': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    // See `src/router.tsx` file to assign these defined values to window.
    define: {
      __appVersion: JSON.stringify(packageJSON.version),
      __envMode: JSON.stringify(mode),
    },
  }
})

export default config
