import { describe, expect, it, vi } from 'vitest'

import { buildGif } from '../../../../test/buildGif'
import { makeReadableFile } from '../../../../test/makeReadableFile'
import { fireEvent, render, screen, waitFor } from '../../../../test/test-utils'
import { useConfirmHeavyGifUpload } from '../useConfirmHeavyGifUpload'

const HEAVY = buildGif({ width: 1500, height: 1500, frames: 15 })

function Harness({
  files,
  onAnswer,
}: {
  files: File[]
  onAnswer: (proceed: boolean) => void
}) {
  const { confirmUpload, modal } = useConfirmHeavyGifUpload()
  return (
    <>
      <button
        type="button"
        onClick={() => void confirmUpload(files).then(onAnswer)}
      >
        pick
      </button>
      {modal}
    </>
  )
}

function dialogButton(name: string) {
  return screen.getByRole('button', { name, hidden: true })
}

describe('useConfirmHeavyGifUpload', () => {
  it('confirms at once when no file is a heavy animated GIF', async () => {
    const onAnswer = vi.fn()
    const files = [
      makeReadableFile(['png'], 'still.png', 'image/png'),
      makeReadableFile(
        [buildGif({ width: 100, height: 100, frames: 5 })],
        'light.gif',
        'image/gif',
      ),
    ]
    render(<Harness files={files} onAnswer={onAnswer} />)

    fireEvent.click(screen.getByText('pick'))

    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(true))
    expect(screen.queryAllByTestId('heavy-gif-warning-item')).toHaveLength(0)
  })

  it('lists the heavy GIFs and uploads when confirmed', async () => {
    const onAnswer = vi.fn()
    const files = [
      makeReadableFile([HEAVY], 'long-loop.gif', 'image/gif'),
      makeReadableFile(['png'], 'still.png', 'image/png'),
    ]
    render(<Harness files={files} onAnswer={onAnswer} />)

    fireEvent.click(screen.getByText('pick'))

    const items = await screen.findAllByTestId('heavy-gif-warning-item')
    expect(items).toHaveLength(1)
    expect(items[0].textContent).toContain('long-loop.gif')
    expect(items[0].textContent).toContain(`${HEAVY.length} B · 15 frames`)
    expect(screen.getByTestId('heavy-gif-warning').textContent).toContain(
      'Large animated GIF',
    )
    expect(onAnswer).not.toHaveBeenCalled()

    fireEvent.click(dialogButton('Upload anyway'))

    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(true))
    expect(screen.queryAllByTestId('heavy-gif-warning-item')).toHaveLength(0)
  })

  it('uploads nothing when cancelled', async () => {
    const onAnswer = vi.fn()
    const files = [makeReadableFile([HEAVY], 'long-loop.gif', 'image/gif')]
    render(<Harness files={files} onAnswer={onAnswer} />)

    fireEvent.click(screen.getByText('pick'))
    await screen.findByTestId('heavy-gif-warning-item')
    fireEvent.click(dialogButton('Cancel'))

    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false))
    expect(screen.queryAllByTestId('heavy-gif-warning-item')).toHaveLength(0)
  })
})
