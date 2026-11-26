import { expect, test } from '@playwright/test'

/**
 * The links this computer shares for the signaling relay carry a hosted
 * room's id ("h1" + 43 characters); the host key it comes from never leaves
 * the computer.
 */
const HOSTED_ROOM = /^h1[A-Za-z0-9_-]{43}$/

test('the listener link carries a hosted room, renewed on reset', async ({
  request,
}) => {
  const read = async () =>
    (await (await request.get('/api/live-translation/stream-secret')).json())
      .secret as string
  const before = await read()
  expect(before).toMatch(HOSTED_ROOM)
  expect(await read()).toBe(before)

  const reset = await request.post('/api/live-translation/stream-secret/reset')
  const { secret } = await reset.json()
  expect(secret).toMatch(HOSTED_ROOM)
  expect(secret).not.toBe(before)
  expect(await read()).toBe(secret)
})

test('the pairing code carries a hosted room and no host key', async ({
  request,
}) => {
  const res = await request.get('/api/remote-access')
  const { data } = await res.json()
  expect(data.secret).toMatch(HOSTED_ROOM)
  expect(Object.keys(data).sort()).toEqual(['enabled', 'relay', 'secret'])
})
