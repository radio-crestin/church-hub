/**
 * Messages over a WebRTC data channel, whole: one too long for a single
 * data channel message travels as numbered pieces and is put back together.
 * The computer's side (server service/remote-access/framing.ts) is the
 * same.
 */
const PIECE = 12_000

interface Piece {
  piece: number
  index: number
  count: number
  data: string
}

let nextId = 0

export function sendFramed(send: (text: string) => void, message: unknown) {
  const text = JSON.stringify(message)
  if (text.length <= PIECE) {
    send(text)
    return
  }
  const id = ++nextId
  const count = Math.ceil(text.length / PIECE)
  for (let index = 0; index < count; index++) {
    const data = text.slice(index * PIECE, (index + 1) * PIECE)
    send(JSON.stringify({ piece: id, index, count, data } satisfies Piece))
  }
}

/** Feeds raw data channel text in; calls `onMessage` with each whole message. */
export function createUnframer(onMessage: (message: unknown) => void) {
  const pending = new Map<number, string[]>()
  return (text: string) => {
    const parsed = JSON.parse(text)
    if (typeof parsed?.piece !== 'number') {
      onMessage(parsed)
      return
    }
    const { piece, index, count, data } = parsed as Piece
    const parts = pending.get(piece) ?? []
    parts[index] = data
    pending.set(piece, parts)
    if (parts.filter((part) => part !== undefined).length < count) return
    pending.delete(piece)
    onMessage(JSON.parse(parts.join('')))
  }
}
