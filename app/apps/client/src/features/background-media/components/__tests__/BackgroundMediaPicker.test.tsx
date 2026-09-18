import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildGif } from '../../../../test/buildGif'
import { makeReadableFile } from '../../../../test/makeReadableFile'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '../../../../test/test-utils'
import { BackgroundMediaPicker } from '../BackgroundMediaPicker'

const { upload } = vi.hoisted(() => ({ upload: vi.fn() }))

vi.mock('~/provider/permissions-provider', () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}))

vi.mock('~/ui/toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

// The server is not under test: an empty list, and uploads only recorded.
// The heavy GIF check is the real one.
vi.mock('../../hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../hooks')>()),
  useBackgroundMediaList: () => ({
    data: [],
    isLoading: false,
    isError: false,
  }),
  useUploadBackgroundMedia: () => ({ mutate: upload, isPending: false }),
  useDeleteBackgroundMedia: () => ({ mutate: vi.fn() }),
}))

const HEAVY_GIF = makeReadableFile(
  [buildGif({ width: 1500, height: 1500, frames: 15 })],
  'long-loop.gif',
  'image/gif',
)

/** A button of the heavy GIF warning (the delete dialog has a Cancel too). */
function warningButton(name: string) {
  return within(screen.getByTestId('heavy-gif-warning')).getByRole('button', {
    name,
    hidden: true,
  })
}

function pick(file: File) {
  fireEvent.change(screen.getByTestId('background-media-upload-input'), {
    target: { files: [file] },
  })
}

describe('BackgroundMediaPicker', () => {
  beforeEach(() => {
    upload.mockClear()
  })

  it('uploads an ordinary image at once', async () => {
    const png = makeReadableFile(['png'], 'still.png', 'image/png')
    render(<BackgroundMediaPicker kind="image" onChange={vi.fn()} />)

    pick(png)

    await waitFor(() => expect(upload).toHaveBeenCalledOnce())
    expect(upload.mock.calls[0][0]).toBe(png)
    expect(screen.queryAllByTestId('heavy-gif-warning-item')).toHaveLength(0)
  })

  it('uploads a heavy animated GIF only once the warning is confirmed', async () => {
    render(<BackgroundMediaPicker kind="image" onChange={vi.fn()} />)

    pick(HEAVY_GIF)

    const item = await screen.findByTestId('heavy-gif-warning-item')
    expect(item.textContent).toContain('long-loop.gif')
    expect(upload).not.toHaveBeenCalled()

    fireEvent.click(warningButton('Upload anyway'))

    await waitFor(() => expect(upload).toHaveBeenCalledOnce())
    expect(upload.mock.calls[0][0]).toBe(HEAVY_GIF)
  })

  it('uploads nothing when the warning is cancelled', async () => {
    render(<BackgroundMediaPicker kind="image" onChange={vi.fn()} />)

    pick(HEAVY_GIF)
    await screen.findByTestId('heavy-gif-warning-item')
    fireEvent.click(warningButton('Cancel'))

    await waitFor(() =>
      expect(screen.queryAllByTestId('heavy-gif-warning-item')).toHaveLength(0),
    )
    expect(upload).not.toHaveBeenCalled()
  })
})
