import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'

// The download folder comes from the settings table; point it at a temp dir
// instead of opening the database.
let downloadDir = mkdtempSync(join(tmpdir(), 'church-hub-update-test-'))
mock.module('../updateConfig', () => ({
  resolveDownloadDir: () => downloadDir,
}))

const { cancelDownload, getDownloadState, startDownload } = await import(
  '../downloadUpdate'
)
const { classifyDownloadError } = await import('../classifyDownloadError')
const { HttpStatusError } = await import('../HttpStatusError')

// A stand-in for GitHub's CDN whose behaviour is scripted per test.
let responses: Array<() => Response> = []
let hits = 0
const server = Bun.serve({
  port: 0,
  fetch: () => {
    const next = responses[Math.min(hits, responses.length - 1)]
    hits++
    return next ? next() : new Response('no script', { status: 500 })
  },
})
const assetUrl = `http://127.0.0.1:${server.port}/releases/church-hub-test-v-9.9.9.dmg`

const ok = () => new Response('installer bytes', { status: 200 })
const status = (code: number) => () => new Response('', { status: code })

async function waitForSettled(timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const state = getDownloadState()
    if (state.phase !== 'downloading') return state
    await Bun.sleep(25)
  }
  throw new Error('download did not settle')
}

beforeEach(() => {
  cancelDownload()
  hits = 0
  rmSync(downloadDir, { recursive: true, force: true })
  downloadDir = mkdtempSync(join(tmpdir(), 'church-hub-update-test-'))
})

afterAll(() => {
  server.stop(true)
  rmSync(downloadDir, { recursive: true, force: true })
})

describe('classifyDownloadError', () => {
  it('treats a 5xx from GitHub as worth retrying, a 404 as not', () => {
    expect(classifyDownloadError(new HttpStatusError(503))).toMatchObject({
      code: 'http',
      retryable: true,
    })
    expect(classifyDownloadError(new HttpStatusError(404))).toMatchObject({
      code: 'http',
      message: 'HTTP 404',
      retryable: false,
    })
  })

  it('recognises a folder that cannot be written to', () => {
    const error = Object.assign(new Error('permission denied'), {
      code: 'EACCES',
    })
    expect(classifyDownloadError(error)).toEqual({
      code: 'filesystem',
      message: 'EACCES: permission denied',
      retryable: false,
    })
  })

  it('puts everything else down to the network, naming the cause', () => {
    const error = new Error('fetch() failed', {
      cause: new Error('getaddrinfo ENOTFOUND github.com'),
    })
    expect(classifyDownloadError(error)).toEqual({
      code: 'network',
      message: 'fetch() failed (getaddrinfo ENOTFOUND github.com)',
      retryable: true,
    })
  })
})

describe('startDownload', () => {
  it('retries through a transient 503 and ends up ready', async () => {
    responses = [status(503), status(503), ok]

    await startDownload(assetUrl, '9.9.9')
    const state = await waitForSettled()

    expect(hits).toBe(3)
    expect(state.phase).toBe('ready')
    expect(state.filePath).toBe(
      join(downloadDir, 'church-hub-test-v-9.9.9.dmg'),
    )
    expect(await Bun.file(state.filePath!).text()).toBe('installer bytes')
  })

  it('reports an http failure without retrying a 404', async () => {
    responses = [status(404)]

    await startDownload(assetUrl, '9.9.9')
    const state = await waitForSettled()

    expect(hits).toBe(1)
    expect(state.phase).toBe('error')
    expect(state.errorCode).toBe('http')
    expect(state.error).toBe('HTTP 404')
  })

  it('gives up after three network failures', async () => {
    // Nothing listens here; every attempt is refused.
    const closed = Bun.serve({ port: 0, fetch: () => new Response('') })
    const deadUrl = `http://127.0.0.1:${closed.port}/x.dmg`
    closed.stop(true)

    await startDownload(deadUrl, '9.9.9')
    const state = await waitForSettled()

    expect(state.phase).toBe('error')
    expect(state.errorCode).toBe('network')
  }, 15_000)

  it('a failure is dismissed by cancel, so the next visit starts idle', async () => {
    responses = [status(404)]
    await startDownload(assetUrl, '9.9.9')
    await waitForSettled()
    expect(getDownloadState().phase).toBe('error')

    cancelDownload()

    expect(getDownloadState()).toMatchObject({
      phase: 'idle',
      error: null,
      errorCode: null,
    })
  })

  it('reports a folder it cannot write to as a filesystem problem', async () => {
    responses = [ok]
    // A file where the folder should be: mkdir -p then fails with ENOTDIR/EEXIST.
    rmSync(downloadDir, { recursive: true, force: true })
    await Bun.write(downloadDir, 'not a folder')

    await startDownload(assetUrl, '9.9.9')
    const state = await waitForSettled()

    expect(state.phase).toBe('error')
    expect(state.errorCode).toBe('filesystem')
  })
})
