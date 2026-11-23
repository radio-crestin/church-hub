import { gunzipSync } from 'node:zlib'
import { expect, type Page, type Request, test } from '@playwright/test'

import { setAppLanguage } from './helpers/app-language'
import {
  CLIENT_EVENTS,
  COMMON_PROPERTIES,
  POSTHOG_PROPERTIES,
  POSTHOG_PROPERTY_PREFIXES,
} from '../src/features/analytics/analyticsEvents'

/**
 * Anonymous usage data (T-195): every press goes to PostHog as
 * `button_pressed` / `shortcut_used`, with only the properties the typed list
 * in analyticsEvents.ts allows, never typed text, content or addresses; with
 * "Share anonymous usage data" off nothing at all reaches PostHog. PostHog is
 * answered here, so nothing leaves the machine.
 */

interface CapturedEvent {
  event: string
  properties: Record<string, unknown>
}

interface PostHogTraffic {
  requests: string[]
  events: CapturedEvent[]
}

const TYPED_TEXT = 'SecretLyricLine 192.168.1.77'

function decodeBody(request: Request): unknown[] {
  const buffer = request.postDataBuffer()
  if (!buffer?.length) return []
  let text: string
  try {
    text = gunzipSync(buffer).toString('utf8')
  } catch {
    text = buffer.toString('utf8')
  }
  if (text.startsWith('data=')) {
    text = Buffer.from(decodeURIComponent(text.slice(5)), 'base64').toString(
      'utf8',
    )
  }
  const parsed = JSON.parse(text) as unknown
  if (Array.isArray(parsed)) return parsed
  const batch = (parsed as { batch?: unknown[] }).batch
  return batch ?? [parsed]
}

/**
 * Answers every PostHog request and keeps what was sent. The page looks like
 * a person's browser, not an automated one: PostHog drops a bot's events.
 */
async function interceptPostHog(page: Page): Promise<PostHogTraffic> {
  const traffic: PostHogTraffic = { requests: [], events: [] }
  await page.addInitScript(() => {
    const ua = navigator.userAgent.replace('HeadlessChrome', 'Chrome')
    Object.defineProperty(Navigator.prototype, 'webdriver', {
      get: () => false,
    })
    Object.defineProperty(Navigator.prototype, 'userAgent', { get: () => ua })
    Object.defineProperty(Navigator.prototype, 'userAgentData', {
      get: () => undefined,
    })
  })
  await page.route(/posthog\.com/, async (route) => {
    const request = route.request()
    traffic.requests.push(request.url())
    if (request.method() === 'POST') {
      for (const item of decodeBody(request)) {
        const { event, properties } = item as CapturedEvent
        if (event) traffic.events.push({ event, properties: properties ?? {} })
      }
    }
    if (request.url().includes('.js')) {
      return route.fulfill({ contentType: 'text/javascript', body: '' })
    }
    if (request.url().includes('/flags')) {
      return route.fulfill({ json: { featureFlags: {}, flags: {} } })
    }
    return route.fulfill({ json: { status: 1 } })
  })
  return traffic
}

function allowedProperty(event: string, key: string): boolean {
  const own = (CLIENT_EVENTS as Record<string, readonly string[]>)[event] ?? []
  const prefix = (POSTHOG_PROPERTY_PREFIXES as Record<string, string>)[event]
  return (
    own.includes(key) ||
    (COMMON_PROPERTIES as readonly string[]).includes(key) ||
    (POSTHOG_PROPERTIES as readonly string[]).includes(key) ||
    (!!prefix && key.startsWith(prefix))
  )
}

async function setUsageData(page: Page, enabled: boolean) {
  const response = await page.request.put('/api/analytics', {
    data: { enabled },
  })
  expect(response.ok()).toBeTruthy()
}

test.describe('Anonymous usage data', () => {
  test.afterEach(async ({ page }) => {
    await setUsageData(page, true)
  })

  test('presses are sent with only the allowed properties, never typed text', async ({
    page,
    baseURL,
  }) => {
    await setUsageData(page, true)
    await setAppLanguage(page, 'en')
    const traffic = await interceptPostHog(page)

    await page.goto('/songs')
    const search = page.getByPlaceholder(/search/i).first()
    await expect(search).toBeVisible({ timeout: 15000 })
    await search.fill(TYPED_TEXT)
    await search.press('PageDown') // typed in a field: not a shortcut
    await page.evaluate(() => (document.activeElement as HTMLElement).blur())
    await page.keyboard.press('PageDown')
    await page.locator('a[href="/settings"]').first().click()
    await page.locator('a[href="/settings/privacy"]').first().click()
    await expect(page.getByTestId('privacy-policy')).toBeVisible()

    await expect
      .poll(() => traffic.events.map((e) => e.event), { timeout: 20000 })
      .toEqual(
        expect.arrayContaining([
          'button_pressed',
          'shortcut_used',
          '$pageview',
        ]),
      )

    for (const { event, properties } of traffic.events) {
      expect(Object.keys(CLIENT_EVENTS), `event ${event}`).toContain(event)
      for (const key of Object.keys(properties)) {
        expect(allowedProperty(event, key), `${event}.${key}`).toBe(true)
      }
      expect(properties.$process_person_profile).toBe(false)
      expect(properties.$ip).toBeNull()
    }

    // A press is counted on the page it happened on: the Settings link on
    // the songs page, then the Privacy link on a settings page.
    const presses = traffic.events
      .filter((e) => e.event === 'button_pressed')
      .map((e) => e.properties)
    expect(presses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'a',
          feature: 'songs',
          route: '/songs',
        }),
        expect.objectContaining({ role: 'a', feature: 'settings' }),
      ]),
    )

    const shortcuts = traffic.events.filter((e) => e.event === 'shortcut_used')
    expect(shortcuts).toHaveLength(1)
    expect(shortcuts[0]?.properties).toMatchObject({
      shortcut: 'PageDown',
      scope: 'app',
      route: '/songs',
    })

    // Typing a search changes the address, not the page: one page view.
    const songsViews = traffic.events.filter(
      (e) => e.event === '$pageview' && e.properties.route === '/songs',
    )
    expect(songsViews).toHaveLength(1)

    const sent = JSON.stringify(traffic.events)
    expect(sent).not.toContain('SecretLyricLine')
    expect(sent).not.toContain('192.168.1.77')
    expect(sent).not.toContain(new URL(baseURL ?? '').host)
  })

  test('with the setting off nothing reaches PostHog', async ({ page }) => {
    await setUsageData(page, true)
    const traffic = await interceptPostHog(page)
    await page.goto('/settings/privacy')

    const toggle = page.getByTestId('usage-data-toggle')
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    // On: events flow (so "nothing" below means something).
    await expect
      .poll(() => traffic.events.length, { timeout: 20000 })
      .toBeGreaterThan(0)
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')

    // Whatever was queued before the switch has had time to go.
    await page.waitForTimeout(4000)
    traffic.requests.length = 0
    traffic.events.length = 0

    await page.locator('a[href="/settings/about"]').first().click()
    await page.keyboard.press('PageDown')
    await page.reload()
    await page.locator('a[href="/settings/privacy"]').first().click()
    await expect(page.getByTestId('usage-data-toggle')).toHaveAttribute(
      'aria-checked',
      'false',
    )
    await page.waitForTimeout(6000)

    expect(traffic.requests).toEqual([])
    expect(traffic.events).toEqual([])
  })

  for (const [lang, title, toggleLabel] of [
    ['en', 'Privacy policy', 'Share anonymous usage data'],
    [
      'ro',
      'Politica de confidențialitate',
      'Trimite date anonime de utilizare',
    ],
  ] as const) {
    test(`the privacy page renders in ${lang}`, async ({ page }) => {
      await setAppLanguage(page, lang)
      await interceptPostHog(page)
      await page.goto('/settings/privacy')

      await expect(page.getByRole('heading', { name: title })).toBeVisible()
      await expect(page.getByText(toggleLabel, { exact: true })).toBeVisible()
      const events = page.getByTestId('privacy-clientEvents')
      for (const name of Object.keys(CLIENT_EVENTS)) {
        await expect(events.getByText(name, { exact: true })).toBeVisible()
      }
    })
  }
})
