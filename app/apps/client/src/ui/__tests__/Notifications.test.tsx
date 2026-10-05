import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  NotificationsProvider,
  useNotifications,
  useNotificationWhile,
} from '../notifications'

function TestConsumer() {
  const { notify, dismiss, showToast } = useNotifications()
  return (
    <div>
      <button onClick={() => showToast('Info message')}>Show Info</button>
      <button onClick={() => showToast('Success!', 'success')}>
        Show Success
      </button>
      <button onClick={() => showToast('Error!', 'error')}>Show Error</button>
      <button
        onClick={() =>
          showToast('With action', 'info', {
            action: { label: 'Undo', onClick: vi.fn() },
          })
        }
      >
        Show Action
      </button>
      <button
        onClick={() =>
          notify({ id: 'sync', message: 'Syncing', persistent: true })
        }
      >
        Start Sync
      </button>
      <button
        onClick={() =>
          notify({ id: 'sync', message: 'Synced', kind: 'success' })
        }
      >
        Finish Sync
      </button>
      <button onClick={() => dismiss('sync')}>Dismiss Sync</button>
    </div>
  )
}

function renderWithProvider(ui = <TestConsumer />) {
  return render(<NotificationsProvider>{ui}</NotificationsProvider>)
}

function cardOf(text: string) {
  return screen.getByText(text).closest('[data-testid="notification"]')
}

afterEach(() => {
  vi.useRealTimers()
})

describe('NotificationsProvider', () => {
  test('renders children', () => {
    renderWithProvider(<div>Child content</div>)
    expect(screen.getByText('Child content')).toBeInTheDocument()
  })

  test('shows a notification of each kind', async () => {
    const user = userEvent.setup()
    renderWithProvider()

    await user.click(screen.getByText('Show Info'))
    await user.click(screen.getByText('Show Success'))
    await user.click(screen.getByText('Show Error'))

    expect(cardOf('Info message')).toHaveAttribute('data-kind', 'info')
    expect(cardOf('Success!')).toHaveAttribute('data-kind', 'success')
    expect(cardOf('Error!')).toHaveAttribute('data-kind', 'error')
    expect(cardOf('Error!')).toHaveAttribute('role', 'alert')
  })

  test('runs the action and closes the notification', async () => {
    const user = userEvent.setup()
    renderWithProvider()

    await user.click(screen.getByText('Show Action'))
    await user.click(screen.getByText('Undo'))

    expect(screen.queryByText('With action')).not.toBeInTheDocument()
  })

  test('closes when the close button is clicked', async () => {
    const user = userEvent.setup()
    renderWithProvider()

    await user.click(screen.getByText('Show Info'))
    await user.click(
      within(cardOf('Info message') as HTMLElement).getByRole('button'),
    )

    expect(screen.queryByText('Info message')).not.toBeInTheDocument()
  })

  test('hides on its own after the duration', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTime(ms),
    })
    renderWithProvider()

    await user.click(screen.getByText('Show Info'))
    expect(screen.getByText('Info message')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(4100)
    })

    expect(screen.queryByText('Info message')).not.toBeInTheDocument()
  })

  test('same id updates in place; persistent stays until dismissed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTime(ms),
    })
    renderWithProvider()

    await user.click(screen.getByText('Start Sync'))
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.getByText('Syncing')).toBeInTheDocument()

    await user.click(screen.getByText('Finish Sync'))
    expect(screen.queryByText('Syncing')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('notification')).toHaveLength(1)
    expect(cardOf('Synced')).toHaveAttribute('data-kind', 'success')

    await user.click(screen.getByText('Dismiss Sync'))
    expect(screen.queryByText('Synced')).not.toBeInTheDocument()
  })
})

describe('useNotificationWhile', () => {
  function Banner({ on }: { on: boolean }) {
    useNotificationWhile(on, { id: 'offline', message: 'Offline' })
    return null
  }

  test('shows while the condition holds and goes away after', () => {
    const { rerender } = renderWithProvider(<Banner on={false} />)
    expect(screen.queryByText('Offline')).not.toBeInTheDocument()

    rerender(
      <NotificationsProvider>
        <Banner on />
      </NotificationsProvider>,
    )
    expect(screen.getByText('Offline')).toBeInTheDocument()

    rerender(
      <NotificationsProvider>
        <Banner on={false} />
      </NotificationsProvider>,
    )
    expect(screen.queryByText('Offline')).not.toBeInTheDocument()
  })
})

describe('useNotifications', () => {
  test('throws when used outside NotificationsProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    function BadConsumer() {
      useNotifications()
      return null
    }

    expect(() => render(<BadConsumer />)).toThrow(
      'useNotifications must be used within a NotificationsProvider',
    )

    consoleSpy.mockRestore()
  })
})
