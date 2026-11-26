import { expect, test } from '@playwright/test'

/** The bundled fonts' OFL notices ship with the app (T-091 follow-up). */
test('serves the third-party font licences', async ({ request }) => {
  const response = await request.get('/licenses/third-party-fonts.txt')
  expect(response.ok()).toBe(true)
  const text = await response.text()
  for (const font of ['Fira Sans', 'Montserrat', 'Lora']) {
    expect(text).toContain(font)
  }
  expect(text).toContain('SIL OPEN FONT LICENSE Version 1.1')
})
