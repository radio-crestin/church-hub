import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildGif } from '../../../../test/buildGif'
import { makeReadableFile } from '../../../../test/makeReadableFile'
import { fireEvent, render, screen, waitFor } from '../../../../test/test-utils'
import { useGalleryUpload } from '../useGalleryUpload'

const { upload, showToast } = vi.hoisted(() => ({
  upload: vi.fn(),
  showToast: vi.fn(),
}))

vi.mock('~/ui/toast', () => ({
  useToast: () => ({ showToast }),
}))

// Uploads are only recorded; the heavy GIF check is the real one.
vi.mock('~/features/background-media/hooks', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('~/features/background-media/hooks')
  >()),
  useUploadBackgroundMedia: () => ({ mutateAsync: upload }),
}))

const HEAVY_GIF = makeReadableFile(
  [buildGif({ width: 1500, height: 1500, frames: 15 })],
  'long-loop.gif',
  'image/gif',
)
const PNG = makeReadableFile(['png'], 'still.png', 'image/png')

function Harness({ files }: { files: File[] }) {
  const { uploadFiles, heavyGifWarning } = useGalleryUpload()
  return (
    <>
      <button type="button" onClick={() => void uploadFiles(files)}>
        pick
      </button>
      {heavyGifWarning}
    </>
  )
}

function warningButton(name: string) {
  return screen.getByRole('button', { name, hidden: true })
}

describe('useGalleryUpload', () => {
  beforeEach(() => {
    upload.mockReset().mockResolvedValue({})
    showToast.mockClear()
  })

  it('uploads a pick without heavy GIFs straight away', async () => {
    render(<Harness files={[PNG]} />)

    fireEvent.click(screen.getByText('pick'))

    await waitFor(() => expect(upload).toHaveBeenCalledWith(PNG))
    expect(screen.queryAllByTestId('heavy-gif-warning-item')).toHaveLength(0)
  })

  it('uploads nothing from a pick with a heavy GIF when the warning is cancelled', async () => {
    render(<Harness files={[HEAVY_GIF, PNG]} />)

    fireEvent.click(screen.getByText('pick'))

    const items = await screen.findAllByTestId('heavy-gif-warning-item')
    expect(items).toHaveLength(1)
    expect(items[0].textContent).toContain('long-loop.gif')
    fireEvent.click(warningButton('Cancel'))

    await waitFor(() =>
      expect(screen.queryAllByTestId('heavy-gif-warning-item')).toHaveLength(0),
    )
    expect(upload).not.toHaveBeenCalled()
    expect(showToast).not.toHaveBeenCalled()
  })

  it('uploads every file of the pick once the warning is confirmed', async () => {
    render(<Harness files={[HEAVY_GIF, PNG]} />)

    fireEvent.click(screen.getByText('pick'))
    await screen.findByTestId('heavy-gif-warning-item')
    expect(upload).not.toHaveBeenCalled()
    fireEvent.click(warningButton('Upload anyway'))

    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2))
    expect(upload.mock.calls.map(([file]) => file)).toEqual([HEAVY_GIF, PNG])
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('2 files uploaded', 'success'),
    )
  })
})
