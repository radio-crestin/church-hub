import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { Slider } from '../slider/Slider'

describe('Slider', () => {
  test('renders a range input', () => {
    render(<Slider />)
    expect(screen.getByRole('slider')).toBeInTheDocument()
  })

  test('renders with default value of 0', () => {
    render(<Slider />)
    expect(screen.getByRole('slider')).toHaveValue('0')
  })

  test('renders with provided value', () => {
    render(<Slider value={[50]} />)
    expect(screen.getByRole('slider')).toHaveValue('50')
  })

  test('displays the value by default', () => {
    render(<Slider value={[42]} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  test('hides value when showValue is false', () => {
    render(<Slider value={[42]} showValue={false} />)
    expect(screen.queryByText('42')).not.toBeInTheDocument()
  })

  test('uses custom formatValue function', () => {
    render(<Slider value={[75]} formatValue={(v) => `${v}%`} />)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  test('calls onValueChange when value changes', () => {
    const handleChange = vi.fn()
    render(<Slider value={[50]} onValueChange={handleChange} />)

    fireEvent.change(screen.getByRole('slider'), { target: { value: '75' } })

    expect(handleChange).toHaveBeenCalledOnce()
    expect(handleChange).toHaveBeenCalledWith([75])
  })

  test('applies min and max attributes', () => {
    render(<Slider min={10} max={200} />)
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('min', '10')
    expect(slider).toHaveAttribute('max', '200')
  })

  test('applies step attribute', () => {
    render(<Slider step={5} />)
    expect(screen.getByRole('slider')).toHaveAttribute('step', '5')
  })

  test('is disabled when disabled prop is true', () => {
    render(<Slider disabled />)
    expect(screen.getByRole('slider')).toBeDisabled()
  })

  test('applies custom className', () => {
    const { container } = render(<Slider className="custom-slider" />)
    expect(container.firstChild).toHaveClass('custom-slider')
  })

  test('rounds displayed value by default', () => {
    render(<Slider value={[33.7]} />)
    expect(screen.getByText('34')).toBeInTheDocument()
  })

  test('forwards ref correctly', () => {
    const ref = vi.fn()
    render(<Slider ref={ref} />)
    expect(ref).toHaveBeenCalled()
  })
})
