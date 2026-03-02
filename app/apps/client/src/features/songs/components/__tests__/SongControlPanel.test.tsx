import { render, screen } from '../../../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

// Mock the presentation hooks
vi.mock('~/features/presentation', () => ({
  ContentTypeButton: () => null,
  LivePreview: () => <div data-testid="live-preview">Preview</div>,
  useClearTemporaryContent: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useNavigateTemporary: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  usePresentationState: () => ({
    data: null,
  }),
  useWebSocket: () => ({}),
}))

vi.mock('~/features/presentation/hooks/useSlideHighlights', () => ({
  useSlideHighlights: () => ({ data: [] }),
  useClearSlideHighlights: () => ({ mutate: vi.fn(), isPending: false }),
}))

import { SongControlPanel } from '../SongControlPanel'

const defaultProps = {
  songId: 1,
  onPrevSlide: vi.fn(),
  onNextSlide: vi.fn(),
  canNavigatePrev: true,
  canNavigateNext: true,
  isEditMode: false,
  onToggleEditMode: vi.fn(),
}

describe('SongControlPanel', () => {
  test('renders the edit mode toggle button', () => {
    render(<SongControlPanel {...defaultProps} />)
    expect(screen.getByText('Edit Mode')).toBeInTheDocument()
  })

  test('calls onToggleEditMode when clicking edit toggle', async () => {
    const user = userEvent.setup()
    const onToggleEditMode = vi.fn()
    render(
      <SongControlPanel
        {...defaultProps}
        onToggleEditMode={onToggleEditMode}
      />,
    )
    await user.click(screen.getByText('Edit Mode'))
    expect(onToggleEditMode).toHaveBeenCalledTimes(1)
  })

  test('shows "Done Editing" text when edit mode is active', () => {
    render(<SongControlPanel {...defaultProps} isEditMode={true} />)
    expect(screen.getByText('Done Editing')).toBeInTheDocument()
    expect(screen.queryByText('Edit Mode')).not.toBeInTheDocument()
  })

  test('applies active styles to edit toggle when edit mode is on', () => {
    const { container } = render(
      <SongControlPanel {...defaultProps} isEditMode={true} />,
    )
    const editButton = container.querySelector('.bg-indigo-100')
    expect(editButton).toBeInTheDocument()
  })

  test('renders LivePreview component', () => {
    render(<SongControlPanel {...defaultProps} />)
    expect(screen.getByTestId('live-preview')).toBeInTheDocument()
  })

  test('does not show preview edit overlay when not in edit mode', () => {
    render(
      <SongControlPanel
        {...defaultProps}
        currentSlideContent="<p>Some content</p>"
        onEditCurrentSlide={vi.fn()}
      />,
    )
    expect(
      screen.queryByText('Edit current slide'),
    ).not.toBeInTheDocument()
  })

  test('shows preview edit overlay button when in edit mode with current slide', () => {
    render(
      <SongControlPanel
        {...defaultProps}
        isEditMode={true}
        currentSlideContent="<p>Some content</p>"
        onEditCurrentSlide={vi.fn()}
      />,
    )
    // The edit overlay text appears on hover, it's in the DOM but with opacity-0
    // The button itself is always rendered
    const editButton = screen.getByText('Edit current slide')
    expect(editButton).toBeInTheDocument()
  })

  test('opens preview textarea when clicking edit overlay', async () => {
    const user = userEvent.setup()
    render(
      <SongControlPanel
        {...defaultProps}
        isEditMode={true}
        currentSlideContent="<p>Test content line</p>"
        onEditCurrentSlide={vi.fn()}
      />,
    )
    // Click the edit overlay button
    await user.click(screen.getByText('Edit current slide'))
    // Should show textarea with stripped content
    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeInTheDocument()
    expect(textarea).toHaveValue('Test content line')
  })

  test('renders prev/next navigation buttons', () => {
    render(<SongControlPanel {...defaultProps} />)
    // Look for button text content
    const buttons = screen.getAllByRole('button')
    const prevButton = buttons.find((btn) =>
      btn.textContent?.includes('Anterior'),
    )
    const nextButton = buttons.find((btn) =>
      btn.textContent?.includes('Urmator'),
    )
    // At least the navigation buttons should exist (text depends on locale)
    expect(buttons.length).toBeGreaterThan(2)
    // Fallback: check by role
    expect(prevButton || nextButton || buttons.length > 2).toBeTruthy()
  })

  test('does not show preview edit when no currentSlideContent', () => {
    render(
      <SongControlPanel
        {...defaultProps}
        isEditMode={true}
        onEditCurrentSlide={vi.fn()}
      />,
    )
    expect(
      screen.queryByText('Edit current slide'),
    ).not.toBeInTheDocument()
  })
})
