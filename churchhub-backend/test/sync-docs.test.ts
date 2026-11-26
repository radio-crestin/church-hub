import { expect, test } from 'bun:test'
import app from '../src/index'

/** Run with `bun test` from churchhub-backend/. */
test('the sync docs page loads a pinned Scalar build', async () => {
  const response = await app.request('https://backend.test/sync/docs', {}, {})
  expect(await response.text()).toMatch(/@scalar\/api-reference@\d+\.\d+\.\d+"/)
})
