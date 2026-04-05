import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { Checkbox } from '../checkbox/Checkbox'

describe('Checkbox', () => {
  test('renders a checkbox input', () => {
    render(<Checkbox />)
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  test('renders with a label', () => {
    render(<Checkbox label="Accept terms" />)
    expect(screen.getByText('Accept terms')).toBeInTheDocument()
  })

  test('does not render label span when label is not provided', () => {
    const { container } = render(<Checkbox />)
    expect(container.querySelector('span')).not.toBeInTheDocument()
  })

  test('reflects checked state', () => {
    render(<Checkbox checked={true} label="Checked" />)
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  test('reflects unchecked state', () => {
    render(<Checkbox checked={false} label="Unchecked" />)
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  test('calls onCheckedChange when clicked', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(
      <Checkbox
        checked={false}
        onCheckedChange={handleChange}
        label="Toggle"
      />,
    )

    await user.click(screen.getByRole('checkbox'))

    expect(handleChange).toHaveBeenCalledOnce()
    expect(handleChange).toHaveBeenCalledWith(true)
  })

  test('does not call onCheckedChange when disabled', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(
      <Checkbox
        checked={false}
        onCheckedChange={handleChange}
        label="Disabled"
        disabled
      />,
    )

    await user.click(screen.getByRole('checkbox'))

    expect(handleChange).not.toHaveBeenCalled()
  })

  test('is disabled when disabled prop is true', () => {
    render(<Checkbox disabled label="Disabled" />)
    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  test('applies disabled opacity class', () => {
    const { container } = render(<Checkbox disabled label="Disabled" />)
    const label = container.querySelector('label')
    expect(label).toHaveClass('opacity-50')
  })

  test('applies custom className', () => {
    const { container } = render(<Checkbox className="my-custom" />)
    const label = container.querySelector('label')
    expect(label).toHaveClass('my-custom')
  })

  test('uses provided id for input', () => {
    render(<Checkbox id="my-checkbox" label="Custom ID" />)
    expect(screen.getByRole('checkbox')).toHaveAttribute('id', 'my-checkbox')
  })

  test('label htmlFor matches input id', () => {
    const { container } = render(<Checkbox id="linked" label="Linked" />)
    const label = container.querySelector('label')
    expect(label).toHaveAttribute('for', 'linked')
  })

  test('forwards ref correctly', () => {
    const ref = vi.fn()
    render(<Checkbox ref={ref} />)
    expect(ref).toHaveBeenCalled()
  })
})
