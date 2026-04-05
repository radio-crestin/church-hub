import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { render, screen } from '../../test/test-utils'
import { AlertModal } from '../modal/AlertModal'

describe('AlertModal', () => {
  const defaultProps = {
    isOpen: true,
    title: 'Alert Title',
    message: 'Something happened.',
    onClose: vi.fn(),
  }

  test('renders title and message when open', () => {
    render(<AlertModal {...defaultProps} />)

    expect(screen.getByText('Alert Title')).toBeInTheDocument()
    expect(screen.getByText('Something happened.')).toBeInTheDocument()
  })

  test('renders OK button', () => {
    render(<AlertModal {...defaultProps} />)

    expect(
      screen.getByRole('button', { name: /ok/i, hidden: true }),
    ).toBeInTheDocument()
  })

  test('calls onClose when OK button is clicked', async () => {
    const user = userEvent.setup()
    const handleClose = vi.fn()
    render(<AlertModal {...defaultProps} onClose={handleClose} />)

    await user.click(screen.getByRole('button', { name: /ok/i, hidden: true }))

    expect(handleClose).toHaveBeenCalledOnce()
  })

  test('calls showModal when isOpen is true', () => {
    render(<AlertModal {...defaultProps} isOpen={true} />)
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled()
  })

  test('calls close when isOpen is false', () => {
    render(<AlertModal {...defaultProps} isOpen={false} />)
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled()
  })

  test('applies error variant button styles', () => {
    render(<AlertModal {...defaultProps} variant="error" />)

    const button = screen.getByRole('button', { name: /ok/i, hidden: true })
    expect(button).toHaveClass('bg-red-600')
  })

  test('applies warning variant button styles', () => {
    render(<AlertModal {...defaultProps} variant="warning" />)

    const button = screen.getByRole('button', { name: /ok/i, hidden: true })
    expect(button).toHaveClass('bg-yellow-600')
  })

  test('applies info variant button styles by default', () => {
    render(<AlertModal {...defaultProps} />)

    const button = screen.getByRole('button', { name: /ok/i, hidden: true })
    expect(button).toHaveClass('bg-indigo-600')
  })

  test('renders error icon for error variant', () => {
    const { container } = render(
      <AlertModal {...defaultProps} variant="error" />,
    )
    const icon = container.querySelector('.text-red-500')
    expect(icon).toBeInTheDocument()
  })

  test('renders warning icon for warning variant', () => {
    const { container } = render(
      <AlertModal {...defaultProps} variant="warning" />,
    )
    const icon = container.querySelector('.text-yellow-500')
    expect(icon).toBeInTheDocument()
  })

  test('renders info icon for info variant', () => {
    const { container } = render(
      <AlertModal {...defaultProps} variant="info" />,
    )
    const icon = container.querySelector('.text-blue-500')
    expect(icon).toBeInTheDocument()
  })
})
