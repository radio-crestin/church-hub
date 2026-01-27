import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { render, screen } from '../../test/test-utils'
import { ConfirmModal } from '../modal/ConfirmModal'

describe('ConfirmModal', () => {
  const defaultProps = {
    isOpen: true,
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
    confirmLabel: 'Confirm',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }

  test('renders title and message when open', () => {
    render(<ConfirmModal {...defaultProps} />)

    expect(screen.getByText('Confirm Action')).toBeInTheDocument()
    expect(
      screen.getByText('Are you sure you want to proceed?'),
    ).toBeInTheDocument()
  })

  test('renders confirm and cancel buttons', () => {
    render(<ConfirmModal {...defaultProps} />)

    // Dialog content is not accessible by default, use hidden option
    expect(
      screen.getByRole('button', { name: 'Confirm', hidden: true }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /cancel/i, hidden: true }),
    ).toBeInTheDocument()
  })

  test('calls onConfirm when confirm button is clicked', async () => {
    const user = userEvent.setup()
    const handleConfirm = vi.fn()
    render(<ConfirmModal {...defaultProps} onConfirm={handleConfirm} />)

    await user.click(
      screen.getByRole('button', { name: 'Confirm', hidden: true }),
    )

    expect(handleConfirm).toHaveBeenCalledOnce()
  })

  test('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup()
    const handleCancel = vi.fn()
    render(<ConfirmModal {...defaultProps} onCancel={handleCancel} />)

    await user.click(
      screen.getByRole('button', { name: /cancel/i, hidden: true }),
    )

    expect(handleCancel).toHaveBeenCalledOnce()
  })

  test('applies danger variant styles to confirm button', () => {
    render(<ConfirmModal {...defaultProps} variant="danger" />)

    const confirmButton = screen.getByRole('button', {
      name: 'Confirm',
      hidden: true,
    })
    expect(confirmButton).toHaveClass('bg-red-600')
  })

  test('uses custom cancel label when provided', () => {
    render(<ConfirmModal {...defaultProps} cancelLabel="Dismiss" />)

    expect(
      screen.getByRole('button', { name: 'Dismiss', hidden: true }),
    ).toBeInTheDocument()
  })
})
