import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { render, screen } from '../../../../test/test-utils'
import { UpdatePanel } from '../UpdatePanel'

const mockUseAppUpdate = vi.fn()
const mockUseUpdateDownload = vi.fn()
const mockUseReleaseNotes = vi.fn()

vi.mock('../../hooks/useAppUpdate', () => ({
  useAppUpdate: () => mockUseAppUpdate(),
}))
vi.mock('../../hooks/useUpdateDownload', () => ({
  useUpdateDownload: () => mockUseUpdateDownload(),
}))
vi.mock('~/utils/isTauri', () => ({ isTauri: () => true }))
vi.mock('~/features/release-notes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/features/release-notes')>()),
  useReleaseNotes: () => mockUseReleaseNotes(),
}))

const RELEASE_BODY = [
  "## What's Changed",
  '### ✨ Features',
  '- **songs**: transpose from the stage view',
  '### 🐛 Bug Fixes',
  '- **bible**: verse search ignored diacritics',
].join('\n')

function downloadState(overrides: Record<string, unknown> = {}) {
  return {
    state: {
      phase: 'idle',
      version: '0.1.92',
      receivedBytes: 0,
      totalBytes: null,
      error: null,
      errorCode: null,
    },
    progress: null,
    isDownloading: false,
    isReady: false,
    isInstalling: false,
    error: null,
    errorCode: null,
    startDownload: vi.fn(),
    isStarting: false,
    dismissError: vi.fn(),
    install: vi.fn(),
    ...overrides,
  }
}

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <UpdatePanel />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockUseAppUpdate.mockReturnValue({
    updateInfo: {
      currentVersion: '0.1.91',
      latestVersion: '0.1.92',
      hasUpdate: true,
      releaseUrl:
        'https://github.com/radio-crestin/church-hub/releases/tag/v0.1.92',
      releaseNotes: RELEASE_BODY,
      publishedAt: '2026-08-23T10:00:00Z',
      installable: true,
    },
    isLoading: false,
    checkNow: vi.fn(),
  })
  mockUseReleaseNotes.mockReturnValue({ data: [] })
  mockUseUpdateDownload.mockReturnValue(downloadState())
})

describe('UpdatePanel', () => {
  it('renders the new version from the release body when the history has not caught up', () => {
    renderPanel()

    const card = screen.getByTestId('update-version-notes')
    expect(card).toHaveTextContent('v0.1.92')
    expect(card).toHaveTextContent('songs: transpose from the stage view')
    expect(card).toHaveTextContent('bible: verse search ignored diacritics')
    expect(card).not.toHaveTextContent('**')
    expect(card).not.toHaveTextContent('##')
    expect(screen.getByTestId('update-download')).toBeInTheDocument()
  })

  it('explains a network failure and offers to try again', () => {
    mockUseUpdateDownload.mockReturnValue(
      downloadState({
        error: 'ConnectionRefused: Unable to connect.',
        errorCode: 'network',
      }),
    )
    renderPanel()

    const alert = screen.getByTestId('update-error')
    expect(alert).toHaveTextContent(/GitHub/)
    expect(alert).toHaveTextContent('ConnectionRefused: Unable to connect.')
    expect(screen.getByTestId('update-download')).toHaveTextContent(
      /Try again|Încearcă din nou/,
    )
  })

  it('says a signature failure is about the file, not the connection', () => {
    mockUseUpdateDownload.mockReturnValue(
      downloadState({
        error: 'signature verification failed',
        errorCode: 'signature',
      }),
    )
    renderPanel()

    const alert = screen.getByTestId('update-error')
    expect(alert).toHaveTextContent(/signature|semnătur/i)
    expect(alert).not.toHaveTextContent(/internet|connection|conexiune/i)
  })

  it('offers install, not download, once the build is on hand', () => {
    mockUseUpdateDownload.mockReturnValue(
      downloadState({
        isReady: true,
        state: {
          phase: 'ready',
          version: '0.1.92',
          receivedBytes: 50_000_000,
          totalBytes: 50_000_000,
          error: null,
          errorCode: null,
        },
      }),
    )
    renderPanel()

    expect(screen.getByTestId('update-install')).toBeEnabled()
    expect(screen.queryByTestId('update-download')).not.toBeInTheDocument()
  })

  it('explains that a browser tab cannot install', () => {
    mockUseAppUpdate.mockReturnValue({
      ...mockUseAppUpdate(),
      updateInfo: { ...mockUseAppUpdate().updateInfo, installable: false },
    })
    renderPanel()

    expect(screen.getByTestId('update-unavailable')).toBeInTheDocument()
    expect(screen.queryByTestId('update-download')).not.toBeInTheDocument()
  })

  it('dismisses a failure once the operator leaves the page', () => {
    const dismissError = vi.fn()
    mockUseUpdateDownload.mockReturnValue(
      downloadState({ error: 'HTTP 503', errorCode: 'http', dismissError }),
    )
    const { unmount } = renderPanel()
    expect(dismissError).not.toHaveBeenCalled()

    unmount()
    expect(dismissError).toHaveBeenCalledTimes(1)
  })

  it('does not clear anything when there was no failure to see', () => {
    const dismissError = vi.fn()
    mockUseUpdateDownload.mockReturnValue(downloadState({ dismissError }))
    const { unmount } = renderPanel()

    unmount()
    expect(dismissError).not.toHaveBeenCalled()
  })
})
