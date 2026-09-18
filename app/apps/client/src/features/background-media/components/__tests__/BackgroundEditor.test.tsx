import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ScreenBackgroundConfig } from '~/features/presentation/types'
import type { BackgroundMediaSelection } from '../../service'
import { BackgroundEditor } from '../BackgroundEditor'

const showToast = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}))

vi.mock('~/ui/toast', () => ({
  useToast: () => ({ showToast }),
}))

// The picker's own behaviour (upload, list, permissions) is not under test:
// it only has to report a chosen file.
vi.mock('../BackgroundMediaPicker', () => ({
  BackgroundMediaPicker: ({
    kind,
    onChange,
  }: {
    kind: string
    onChange: (selection: BackgroundMediaSelection) => void
  }) => (
    <div data-testid="picker" data-kind={kind}>
      <button
        type="button"
        onClick={() => onChange({ kind: 'image', url: '/bg/new.jpg' })}
      >
        pick image
      </button>
      <button
        type="button"
        onClick={() => onChange({ kind: 'video', url: '/bg/new.webm' })}
      >
        pick video
      </button>
    </div>
  ),
}))

const VIDEO: ScreenBackgroundConfig = {
  type: 'video',
  videoUrl: '/bg/old.webm',
  color: '#000000',
  opacity: 0.5,
}

function typeOptionValues(): (string | null)[] {
  return screen
    .getAllByTestId('background-type-select-option')
    .map((option) => option.getAttribute('data-value'))
}

function chooseType(value: string) {
  fireEvent.click(screen.getByTestId('background-type-select'))
  const option = screen
    .getAllByTestId('background-type-select-option')
    .find((item) => item.getAttribute('data-value') === value)
  if (!option) throw new Error(`No option ${value}`)
  fireEvent.click(within(option).getAllByRole('button')[0])
}

describe('BackgroundEditor', () => {
  beforeEach(() => {
    showToast.mockClear()
  })

  it('switches a video background to an image uploaded in its picker', () => {
    const onChange = vi.fn()
    render(<BackgroundEditor value={VIDEO} onChange={onChange} />)

    fireEvent.click(screen.getByText('pick image'))

    expect(onChange).toHaveBeenCalledWith({
      ...VIDEO,
      type: 'image',
      imageUrl: '/bg/new.jpg',
    })
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('screens.background.switchedType'),
      'info',
    )
  })

  it('keeps the type and stays quiet when the file is of the same kind', () => {
    const onChange = vi.fn()
    render(<BackgroundEditor value={VIDEO} onChange={onChange} />)

    fireEvent.click(screen.getByText('pick video'))

    expect(onChange).toHaveBeenCalledWith({
      ...VIDEO,
      videoUrl: '/bg/new.webm',
    })
    expect(showToast).not.toHaveBeenCalled()
  })

  it('offers the screen default first and reports it as null', () => {
    const onChange = vi.fn()
    render(<BackgroundEditor value={VIDEO} onChange={onChange} allowInherit />)

    fireEvent.click(screen.getByTestId('background-type-select'))
    expect(typeOptionValues()[0]).toBe('inherit')
    fireEvent.click(screen.getByTestId('background-type-select'))

    chooseType('inherit')

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('shows only the type select while the background is inherited', () => {
    render(<BackgroundEditor value={null} onChange={vi.fn()} allowInherit />)

    expect(screen.getByTestId('background-type-select').textContent).toContain(
      'screens.background.types.inherit',
    )
    expect(screen.queryByTestId('picker')).toBeNull()
    expect(screen.queryByTestId('background-opacity')).toBeNull()
  })

  it('starts a background from black when leaving the default', () => {
    const onChange = vi.fn()
    render(<BackgroundEditor value={null} onChange={onChange} allowInherit />)

    chooseType('image')

    expect(onChange).toHaveBeenCalledWith({
      type: 'image',
      color: '#000000',
      opacity: 1,
    })
  })

  it('does not offer the default without allowInherit', () => {
    render(<BackgroundEditor value={VIDEO} onChange={vi.fn()} />)

    fireEvent.click(screen.getByTestId('background-type-select'))

    expect(typeOptionValues()).toEqual([
      'transparent',
      'color',
      'image',
      'video',
    ])
  })
})
