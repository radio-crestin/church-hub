import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { ToastProvider } from '../toast/ToastProvider'
import { useToast } from '../toast/useToast'

function TestConsumer() {
  const { showToast } = useToast()
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
    </div>
  )
}

describe('ToastProvider', () => {
  test('renders children', () => {
    render(
      <ToastProvider>
        <div>Child content</div>
      </ToastProvider>,
    )
    expect(screen.getByText('Child content')).toBeInTheDocument()
  })

  test('shows info toast', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    )

    await user.click(screen.getByText('Show Info'))

    expect(screen.getByText('Info message')).toBeInTheDocument()
  })

  test('shows success toast with correct styles', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    )

    await user.click(screen.getByText('Show Success'))

    const toast = screen.getByText('Success!').closest('div')
    expect(toast).toHaveClass('bg-green-600')
  })

  test('shows error toast with correct styles', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    )

    await user.click(screen.getByText('Show Error'))

    const toast = screen.getByText('Error!').closest('div')
    expect(toast).toHaveClass('bg-red-600')
  })

  test('shows toast with action button', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    )

    await user.click(screen.getByText('Show Action'))

    expect(screen.getByText('Undo')).toBeInTheDocument()
  })

  test('dismisses toast when X button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    )

    await user.click(screen.getByText('Show Info'))
    expect(screen.getByText('Info message')).toBeInTheDocument()

    // The dismiss button is the last button in the toast (the X icon)
    const dismissButtons = screen
      .getByText('Info message')
      .closest('div')!
      .querySelectorAll('button')
    const dismissButton = dismissButtons[dismissButtons.length - 1]
    await user.click(dismissButton)

    expect(screen.queryByText('Info message')).not.toBeInTheDocument()
  })

  test('auto-removes toast after duration', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTime(ms),
    })

    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    )

    await user.click(screen.getByText('Show Info'))
    expect(screen.getByText('Info message')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(3100)
    })

    expect(screen.queryByText('Info message')).not.toBeInTheDocument()

    vi.useRealTimers()
  })

  test('can show multiple toasts', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTime(ms),
    })

    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    )

    await user.click(screen.getByText('Show Info'))
    await user.click(screen.getByText('Show Success'))

    expect(screen.getByText('Info message')).toBeInTheDocument()
    expect(screen.getByText('Success!')).toBeInTheDocument()

    vi.useRealTimers()
  })
})

describe('useToast', () => {
  test('throws when used outside ToastProvider', () => {
    // Suppress console.error for the expected error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    function BadConsumer() {
      useToast()
      return null
    }

    expect(() => render(<BadConsumer />)).toThrow(
      'useToast must be used within a ToastProvider',
    )

    consoleSpy.mockRestore()
  })
})
