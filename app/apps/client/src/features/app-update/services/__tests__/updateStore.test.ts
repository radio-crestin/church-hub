import type { DownloadEvent, Update } from '@tauri-apps/plugin-updater'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  dismissUpdateError,
  getUpdateState,
  installUpdate,
  resetUpdateStoreForTests,
  setPendingUpdate,
  startDownload,
} from '../updateStore'

const { invoke, relaunch } = vi.hoisted(() => ({
  invoke: vi.fn(),
  relaunch: vi.fn(),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch }))

type OnEvent = (event: DownloadEvent) => void

/** A stand-in for the plugin's handle: version, download, install, close. */
function fakeUpdate(
  version: string,
  download: (onEvent: OnEvent) => Promise<void> = async (onEvent) => {
    onEvent({ event: 'Started', data: { contentLength: 100 } })
    onEvent({ event: 'Progress', data: { chunkLength: 60 } })
    onEvent({ event: 'Progress', data: { chunkLength: 40 } })
    onEvent({ event: 'Finished' })
  },
) {
  const update = {
    version,
    download: vi.fn(download),
    install: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  }
  return update as unknown as Update & typeof update
}

beforeEach(() => {
  resetUpdateStoreForTests()
  invoke.mockReset().mockResolvedValue(undefined)
  relaunch.mockReset().mockResolvedValue(undefined)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('updateStore', () => {
  it('starts idle and takes the version of the handle it is given', () => {
    expect(getUpdateState().phase).toBe('idle')
    setPendingUpdate(fakeUpdate('1.1.0'))
    expect(getUpdateState()).toMatchObject({ phase: 'idle', version: '1.1.0' })
  })

  it('downloads, reports the bytes and ends ready', async () => {
    const update = fakeUpdate('1.1.0')
    setPendingUpdate(update)

    await startDownload()

    expect(update.download).toHaveBeenCalledTimes(1)
    expect(getUpdateState()).toMatchObject({
      phase: 'ready',
      version: '1.1.0',
      receivedBytes: 100,
      totalBytes: 100,
      error: null,
    })
  })

  it('retries a network failure, then reports it', async () => {
    vi.useFakeTimers()
    const update = fakeUpdate('1.1.0', async () => {
      throw new Error('error sending request for url (https://x)')
    })
    setPendingUpdate(update)

    const run = startDownload()
    await vi.advanceTimersByTimeAsync(1_000)
    await vi.advanceTimersByTimeAsync(3_000)
    await run

    expect(update.download).toHaveBeenCalledTimes(3)
    expect(getUpdateState()).toMatchObject({
      phase: 'error',
      errorCode: 'network',
      error: 'error sending request for url (https://x)',
    })
  })

  it('never retries a signature that does not match', async () => {
    const update = fakeUpdate('1.1.0', async () => {
      throw new Error('signature verification failed')
    })
    setPendingUpdate(update)

    await startDownload()

    expect(update.download).toHaveBeenCalledTimes(1)
    expect(getUpdateState()).toMatchObject({
      phase: 'error',
      errorCode: 'signature',
    })
  })

  it('clears a failure once it has been seen', async () => {
    setPendingUpdate(
      fakeUpdate('1.1.0', async () => {
        throw new Error('Download request failed with status: 404 Not Found')
      }),
    )
    await startDownload()
    expect(getUpdateState()).toMatchObject({
      phase: 'error',
      errorCode: 'http',
    })

    dismissUpdateError()
    expect(getUpdateState()).toMatchObject({
      phase: 'idle',
      version: '1.1.0',
      error: null,
      errorCode: null,
    })
  })

  it('prepares, installs and relaunches — in that order', async () => {
    const update = fakeUpdate('1.1.0')
    setPendingUpdate(update)
    await startDownload()

    const order: string[] = []
    invoke.mockImplementation(async (command: string) => {
      order.push(command)
    })
    update.install.mockImplementation(async () => {
      order.push('install')
    })
    relaunch.mockImplementation(async () => {
      order.push('relaunch')
    })

    const result = await installUpdate()

    expect(result).toEqual({ success: true })
    expect(invoke).toHaveBeenCalledWith('prepare_update_install', {
      version: '1.1.0',
    })
    expect(order).toEqual(['prepare_update_install', 'install', 'relaunch'])
  })

  it('refuses to install what has not been downloaded', async () => {
    setPendingUpdate(fakeUpdate('1.1.0'))

    const result = await installUpdate()

    expect(result).toMatchObject({ success: false })
    expect(invoke).not.toHaveBeenCalled()
  })

  it('puts the sidecar back and reports when the install fails', async () => {
    const update = fakeUpdate('1.1.0')
    setPendingUpdate(update)
    await startDownload()
    update.install.mockRejectedValue(new Error('Failed to install package'))

    const result = await installUpdate()

    expect(result).toEqual({
      success: false,
      error: 'Failed to install package',
    })
    expect(invoke).toHaveBeenCalledWith('abort_update_install')
    expect(relaunch).not.toHaveBeenCalled()
    expect(getUpdateState()).toMatchObject({
      phase: 'error',
      errorCode: 'install',
    })
  })

  it('discards a downloaded build when a newer version turns up', async () => {
    const older = fakeUpdate('1.1.0')
    setPendingUpdate(older)
    await startDownload()
    expect(getUpdateState().phase).toBe('ready')

    setPendingUpdate(fakeUpdate('1.2.0'))

    expect(older.close).toHaveBeenCalled()
    expect(getUpdateState()).toMatchObject({ phase: 'idle', version: '1.2.0' })
  })

  it('keeps the downloaded build when a check finds the same version again', async () => {
    const first = fakeUpdate('1.1.0')
    setPendingUpdate(first)
    await startDownload()

    const again = fakeUpdate('1.1.0')
    setPendingUpdate(again)

    expect(again.close).toHaveBeenCalled()
    expect(first.close).not.toHaveBeenCalled()
    expect(getUpdateState().phase).toBe('ready')

    await installUpdate()
    expect(first.install).toHaveBeenCalled()
    expect(again.install).not.toHaveBeenCalled()
  })
})
