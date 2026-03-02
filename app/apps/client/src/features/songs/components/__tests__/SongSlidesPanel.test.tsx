import { render, screen } from '../../../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, test, vi } from 'vitest'

import { SongSlidesPanel } from '../SongSlidesPanel'
import type { SongWithSlides } from '../../types'

// Mock scrollIntoView and scrollTo (not available in jsdom)
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.scrollTo = vi.fn()
})

function createSong(overrides?: Partial<SongWithSlides>): SongWithSlides {
  return {
    id: 1,
    title: 'Test Song',
    slides: [
      {
        id: 10,
        songId: 1,
        content: '<p>First verse text</p>',
        sortOrder: 0,
        label: null,
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: 11,
        songId: 1,
        content: '<p>Second verse text</p>',
        sortOrder: 1,
        label: null,
        createdAt: 0,
        updatedAt: 0,
      },
    ],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  } as SongWithSlides
}

function createSongWithLabels(): SongWithSlides {
  return createSong({
    slides: [
      {
        id: 10,
        songId: 1,
        content: '<p>Chorus one</p>',
        sortOrder: 0,
        label: 'C1',
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: 11,
        songId: 1,
        content: '<p>First verse</p>',
        sortOrder: 1,
        label: 'V1',
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: 12,
        songId: 1,
        content: '<p>Second verse</p>',
        sortOrder: 2,
        label: 'V2',
        createdAt: 0,
        updatedAt: 0,
      },
    ],
  })
}

const defaultProps = {
  song: createSong(),
  presentedSlideIndex: null,
  selectedSlideIndex: 0,
  isLoading: false,
  isEditMode: false,
  onSlideClick: vi.fn(),
}

describe('SongSlidesPanel', () => {
  test('renders slides with content', () => {
    render(<SongSlidesPanel {...defaultProps} />)
    expect(screen.getByText('First verse text')).toBeInTheDocument()
    expect(screen.getByText('Second verse text')).toBeInTheDocument()
  })

  test('shows slide numbers', () => {
    render(<SongSlidesPanel {...defaultProps} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  test('does not show edit controls when isEditMode is false', () => {
    render(
      <SongSlidesPanel
        {...defaultProps}
        onSlideEdit={vi.fn()}
        onSlideDelete={vi.fn()}
        onSlideAdd={vi.fn()}
      />,
    )
    // No edit/delete buttons should be visible
    expect(screen.queryByTitle('Edit')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument()
    // No add slide button
    expect(screen.queryByText('Add Slide')).not.toBeInTheDocument()
  })

  test('shows edit controls when isEditMode is true', () => {
    render(
      <SongSlidesPanel
        {...defaultProps}
        isEditMode={true}
        onSlideEdit={vi.fn()}
        onSlideDelete={vi.fn()}
        onSlideAdd={vi.fn()}
      />,
    )
    // Edit and delete buttons should be visible on each original slide
    expect(screen.getAllByTitle('Edit')).toHaveLength(2)
    expect(screen.getAllByTitle('Delete')).toHaveLength(2)
    // Add slide button at bottom
    expect(screen.getByText('Add Slide')).toBeInTheDocument()
  })

  test('shows move up/down buttons in edit mode when onSlideReorder provided', () => {
    render(
      <SongSlidesPanel
        {...defaultProps}
        isEditMode={true}
        onSlideEdit={vi.fn()}
        onSlideReorder={vi.fn()}
      />,
    )
    expect(screen.getAllByTitle('Move Up')).toHaveLength(2)
    expect(screen.getAllByTitle('Move Down')).toHaveLength(2)
  })

  test('does not show edit controls on chorus duplicates', () => {
    const song = createSongWithLabels()
    render(
      <SongSlidesPanel
        {...defaultProps}
        song={song}
        isEditMode={true}
        onSlideEdit={vi.fn()}
        onSlideDelete={vi.fn()}
        onSlideAdd={vi.fn()}
      />,
    )
    // Song with C1, V1, C1(dup), V2, C1(dup) = 5 expanded slides
    // 3 original slides should have edit buttons, 2 duplicates should not
    expect(screen.getAllByTitle('Edit')).toHaveLength(3)
    expect(screen.getAllByTitle('Delete')).toHaveLength(3)
  })

  test('calls onSlideClick when clicking a slide', async () => {
    const user = userEvent.setup()
    const onSlideClick = vi.fn()
    render(
      <SongSlidesPanel
        {...defaultProps}
        onSlideClick={onSlideClick}
      />,
    )
    await user.click(screen.getByText('First verse text'))
    expect(onSlideClick).toHaveBeenCalledTimes(1)
  })

  test('calls onSlideDelete when clicking delete button', async () => {
    const user = userEvent.setup()
    const onSlideDelete = vi.fn().mockResolvedValue(undefined)
    render(
      <SongSlidesPanel
        {...defaultProps}
        isEditMode={true}
        onSlideEdit={vi.fn()}
        onSlideDelete={onSlideDelete}
      />,
    )
    const deleteButtons = screen.getAllByTitle('Delete')
    await user.click(deleteButtons[0])
    expect(onSlideDelete).toHaveBeenCalledWith(10)
  })

  test('calls onSlideAdd when clicking add slide button', async () => {
    const user = userEvent.setup()
    const onSlideAdd = vi.fn().mockResolvedValue(undefined)
    render(
      <SongSlidesPanel
        {...defaultProps}
        isEditMode={true}
        onSlideEdit={vi.fn()}
        onSlideAdd={onSlideAdd}
      />,
    )
    await user.click(screen.getByText('Add Slide'))
    expect(onSlideAdd).toHaveBeenCalledTimes(1)
  })

  test('enters inline edit mode when clicking edit button', async () => {
    const user = userEvent.setup()
    render(
      <SongSlidesPanel
        {...defaultProps}
        isEditMode={true}
        onSlideEdit={vi.fn()}
      />,
    )
    const editButtons = screen.getAllByTitle('Edit')
    await user.click(editButtons[0])
    // Should show a textarea with the slide content
    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeInTheDocument()
    expect(textarea).toHaveValue('First verse text')
  })

  test('saves inline edit with Ctrl+Enter', async () => {
    const user = userEvent.setup()
    const onSlideEdit = vi.fn().mockResolvedValue(undefined)
    render(
      <SongSlidesPanel
        {...defaultProps}
        isEditMode={true}
        onSlideEdit={onSlideEdit}
      />,
    )
    // Enter edit mode
    const editButtons = screen.getAllByTitle('Edit')
    await user.click(editButtons[0])

    // Modify content and save
    const textarea = screen.getByRole('textbox')
    await user.clear(textarea)
    await user.type(textarea, 'Updated text')
    await user.keyboard('{Control>}{Enter}{/Control}')

    expect(onSlideEdit).toHaveBeenCalledWith(10, '<p>Updated text</p>')
  })

  test('cancels inline edit with Escape', async () => {
    const user = userEvent.setup()
    const onSlideEdit = vi.fn()
    render(
      <SongSlidesPanel
        {...defaultProps}
        isEditMode={true}
        onSlideEdit={onSlideEdit}
      />,
    )
    // Enter edit mode
    const editButtons = screen.getAllByTitle('Edit')
    await user.click(editButtons[0])

    // Press Escape
    await user.keyboard('{Escape}')

    // Textarea should be gone, onSlideEdit not called
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(onSlideEdit).not.toHaveBeenCalled()
  })

  test('shows loading spinner', () => {
    render(
      <SongSlidesPanel {...defaultProps} isLoading={true} />,
    )
    // Should not show slides
    expect(screen.queryByText('First verse text')).not.toBeInTheDocument()
  })

  test('highlights presented slide with green ring', () => {
    const { container } = render(
      <SongSlidesPanel {...defaultProps} presentedSlideIndex={0} />,
    )
    const firstSlide = container.querySelector('.ring-green-500')
    expect(firstSlide).toBeInTheDocument()
  })

  test('highlights selected slide with indigo ring when nothing presented', () => {
    const { container } = render(
      <SongSlidesPanel
        {...defaultProps}
        presentedSlideIndex={null}
        selectedSlideIndex={1}
      />,
    )
    const selectedSlide = container.querySelector('.ring-indigo-500')
    expect(selectedSlide).toBeInTheDocument()
  })

  test('calls onSlideReorder with correct direction', async () => {
    const user = userEvent.setup()
    const onSlideReorder = vi.fn().mockResolvedValue(undefined)
    render(
      <SongSlidesPanel
        {...defaultProps}
        isEditMode={true}
        onSlideEdit={vi.fn()}
        onSlideReorder={onSlideReorder}
      />,
    )
    // Click move down on first slide
    const moveDownButtons = screen.getAllByTitle('Move Down')
    await user.click(moveDownButtons[0])
    expect(onSlideReorder).toHaveBeenCalledWith(10, 'down')
  })
})
