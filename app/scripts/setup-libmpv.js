#!/usr/bin/env node
/**
 * Cross-platform script to setup libmpv libraries and mpv executable for Tauri
 * Works on Windows, macOS, and Linux
 */

import { execFileSync } from 'node:child_process'
import {
  cpSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  unlinkSync,
} from 'node:fs'
import { get } from 'node:https'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'

const appDir = join(import.meta.dirname, '..')
const srcTauriLibDir = join(appDir, 'src-tauri', 'lib')
const tauriLibDir = join(appDir, 'tauri', 'lib')
const tauriMpvDir = join(appDir, 'tauri', 'resources', 'mpv')

// mpv Windows builds from GitHub (shinchiro's builds)
const MPV_GITHUB_API =
  'https://api.github.com/repos/shinchiro/mpv-winbuild-cmake/releases/latest'

async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destPath)
    const request = (urlString) => {
      get(
        urlString,
        {
          headers: { 'User-Agent': 'church-hub-setup' },
        },
        (response) => {
          // Handle redirects
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            request(response.headers.location)
            return
          }
          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download: ${response.statusCode}`))
            return
          }
          pipeline(response, file).then(resolve).catch(reject)
        },
      ).on('error', reject)
    }
    request(url)
  })
}

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    get(
      url,
      {
        headers: {
          'User-Agent': 'church-hub-setup',
          Accept: 'application/vnd.github.v3+json',
        },
      },
      (response) => {
        let data = ''
        response.on('data', (chunk) => (data += chunk))
        response.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(e)
          }
        })
      },
    ).on('error', reject)
  })
}

async function extract7z(archivePath, destDir) {
  const { dirname, basename } = await import('node:path')
  const SevenZip = await import('7z-wasm').then((m) => m.default || m)

  // Ensure dest directory exists
  if (existsSync(destDir)) {
    rmSync(destDir, { recursive: true, force: true })
  }
  mkdirSync(destDir, { recursive: true })

  const archiveName = basename(archivePath)
  const archiveDir = dirname(archivePath)

  // Initialize SevenZip with silenced output
  const sevenZip = await SevenZip({
    print: () => {},
    printErr: () => {},
  })

  // Mount source and destination directories
  const mountSrc = '/archive_source'
  const mountDest = '/archive_dest'
  sevenZip.FS.mkdir(mountSrc)
  sevenZip.FS.mkdir(mountDest)
  sevenZip.FS.mount(sevenZip.NODEFS, { root: archiveDir }, mountSrc)
  sevenZip.FS.mount(sevenZip.NODEFS, { root: destDir }, mountDest)

  const vArchivePath = `${mountSrc}/${archiveName}`
  const args = ['x', vArchivePath, `-o${mountDest}`, '-y']

  try {
    sevenZip.callMain(args)
  } catch (err) {
    // Exit code 0 means success
    if (err && err.status !== 0) {
      throw new Error(`7z extraction failed: ${err}`)
    }
  } finally {
    try {
      sevenZip.FS.unmount(mountSrc)
      sevenZip.FS.unmount(mountDest)
    } catch {
      // Ignore unmount errors
    }
  }
}

async function downloadMpvExecutable() {
  if (process.platform !== 'win32') {
    console.log('Skipping mpv.exe download (not on Windows)')
    return
  }

  console.log('Downloading mpv executable for Windows...')

  try {
    // Fetch latest release info from GitHub
    const release = await fetchJson(MPV_GITHUB_API)
    console.log(`Found mpv release: ${release.tag_name}`)

    // Find the mpv x86_64 archive (not -dev, not ffmpeg)
    const asset = release.assets.find(
      (a) =>
        a.name.startsWith('mpv-') &&
        a.name.includes('x86_64') &&
        a.name.endsWith('.7z') &&
        !a.name.includes('-dev'),
    )

    if (!asset) {
      console.warn('Could not find mpv x86_64 build, skipping...')
      return
    }

    console.log(`Downloading: ${asset.name}`)
    const archivePath = join(appDir, asset.name)

    await downloadFile(asset.browser_download_url, archivePath)
    console.log('Download complete, extracting...')

    // Create temp extraction directory
    const extractDir = join(appDir, 'mpv-temp')
    if (existsSync(extractDir)) {
      rmSync(extractDir, { recursive: true, force: true })
    }
    mkdirSync(extractDir, { recursive: true })

    // Extract the archive
    await extract7z(archivePath, extractDir)

    // Find mpv.exe in the extracted files
    const findMpvExe = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          const result = findMpvExe(fullPath)
          if (result) return result
        } else if (entry.name === 'mpv.exe') {
          return fullPath
        }
      }
      return null
    }

    const mpvExePath = findMpvExe(extractDir)
    if (!mpvExePath) {
      throw new Error('mpv.exe not found in archive')
    }

    // Ensure mpv directory exists
    if (!existsSync(tauriMpvDir)) {
      mkdirSync(tauriMpvDir, { recursive: true })
    }

    // Copy mpv.exe to tauri/resources/mpv
    const destPath = join(tauriMpvDir, 'mpv.exe')
    cpSync(mpvExePath, destPath)
    console.log(`Copied mpv.exe to ${destPath}`)

    // Cleanup
    unlinkSync(archivePath)
    rmSync(extractDir, { recursive: true, force: true })
    console.log('mpv.exe setup complete!')
  } catch (error) {
    console.error('Failed to download mpv executable:', error.message)
    console.log(
      'You may need to install mpv manually: https://mpv.io/installation/',
    )
  }
}

async function setupLibmpv() {
  console.log('Setting up libmpv libraries...')

  try {
    // Run the libmpv setup tool using npx
    execFileSync('npx', ['tauri-plugin-libmpv-api', 'setup-lib'], {
      cwd: appDir,
      stdio: 'inherit',
      shell: true,
    })

    // Create tauri/lib directory if it doesn't exist
    if (!existsSync(tauriLibDir)) {
      mkdirSync(tauriLibDir, { recursive: true })
    }

    // Copy files from src-tauri/lib to tauri/lib
    if (existsSync(srcTauriLibDir)) {
      cpSync(srcTauriLibDir, tauriLibDir, { recursive: true })
      console.log('Copied libmpv libraries to tauri/lib')

      // Clean up src-tauri directory
      rmSync(join(appDir, 'src-tauri'), { recursive: true, force: true })
      console.log('Cleaned up temporary src-tauri directory')
    }

    console.log('libmpv libraries setup complete!')
  } catch (error) {
    console.error('Failed to setup libmpv libraries:', error.message)
    throw error
  }
}

async function main() {
  try {
    await setupLibmpv()
    await downloadMpvExecutable()
    console.log('\nAll mpv components setup complete!')
  } catch (error) {
    console.error('Setup failed:', error.message)
    process.exit(1)
  }
}

main()
