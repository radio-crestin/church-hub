import { type APIRequestContext, devices, expect, test } from '@playwright/test'
import { copyFileSync } from 'node:fs'

import { setAppLanguage } from './helpers/app-language'
import { FakeS3 } from './helpers/fake-s3'
import { PublicAppServer } from './helpers/public-app'
import { relayToService } from './helpers/relay-to-service'
import { SyncService } from './helpers/sync-service'

// Demo recording for T-174 (not committed).
test.use({
  launchOptions: { args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] },
})
const REC = process.env.DEMO_REC as string
const s3 = new FakeS3()
const service = new SyncService()
const publicApp = new PublicAppServer()
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function remote(request: APIRequestContext, enabled: boolean) {
  await request.put('/api/remote-access', { data: { enabled } })
}

test('demo', async ({ browser, request }) => {
  test.setTimeout(600_000)
  s3.signedWritesOnly = true
  await s3.start()
  await service.start(s3.endpoint, {
    ALLOWED_ORIGINS: publicApp.url,
    SYNC_COMPACT_AFTER: '100000',
  })
  const stopRelay = await relayToService(service.url)
  await publicApp.start()
  await request.post('/api/sync/cloud', { data: { serviceUrl: service.url } })
  await remote(request, false)
  const user = await request.post('/api/users', {
    data: { name: 'Andrei', permissions: ['songs.view'] },
  })
  const userId = (await user.json()).data.user.id
  const song = await request.post('/api/songs', {
    data: {
      title: 'Ce bine e când frații stau',
      slides: [{ content: '<p>Ce bine e când frații stau</p><p>în pace și-n iubire</p>', sortOrder: 0, label: 'V1' }],
    },
  })
  const songId = (await song.json()).data.id
  try {
    // PC: turn on remote access, create the link.
    const pc = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: { dir: `${REC}/raw-pc`, size: { width: 1920, height: 1080 } },
    })
    const pcPage = await pc.newPage()
    await setAppLanguage(pcPage, 'en')
    await pcPage.goto('/settings/phones')
    await expect(pcPage.getByTestId('cloud-device-remote-off')).toBeVisible()
    await pause(2500)
    await pcPage.getByTestId('remote-access-switch').click()
    await expect(pcPage.getByTestId('cloud-device-remote-off')).toBeHidden()
    await pause(1200)
    await pcPage.getByLabel('Device name').fill("Andrei's phone")
    await pcPage.getByTestId('cloud-device-account').click()
    await pcPage.getByRole('option', { name: 'Andrei' }).click()
    await pause(600)
    await pcPage.getByTestId('cloud-device-create').click()
    const qr = pcPage.getByTestId('join-qr')
    await expect(qr).toBeVisible({ timeout: 120_000 })
    const joinUrl = (await qr.getAttribute('data-url')) ?? ''
    await qr.scrollIntoViewIfNeeded()
    await pause(3000)
    const pcVideo = pcPage.video()
    await pc.close()
    copyFileSync((await pcVideo?.path()) as string, `${REC}/pc-link.webm`)
    await expect
      .poll(
        async () => {
          await request.post('/api/sync/now')
          return (await (await request.get('/api/sync/status')).json()).data
            .pendingCount
        },
        { timeout: 300_000, intervals: [1000, 2000] },
      )
      .toBe(0)

    // Phone: join, live.
    const phone = await browser.newContext({
      ...devices['Pixel 7'],
      recordVideo: { dir: `${REC}/raw-phone`, size: { width: 824, height: 1830 } },
    })
    const page = await phone.newPage()
    await page.clock.install()
    await page.goto(joinUrl)
    const link = page.getByTestId('pc-link')
    await expect(link).toHaveAttribute('data-link', 'live', { timeout: 60_000 })
    await pause(3000)
    await page.getByRole('searchbox').pressSequentially('ce bine e cand', { delay: 90 })
    await pause(1500)
    await page.getByTestId('church-song').filter({ hasText: 'Ce bine e când frații stau' }).first().click()
    await pause(2500)
    // The PC edits the song.
    await request.post('/api/songs', {
      data: {
        id: songId,
        title: 'Ce bine e când frații stau',
        slides: [{ content: '<p>Ce bine e când frații stau</p><p>în pace și-n iubire</p><p>(cântăm de două ori)</p>', sortOrder: 0, label: 'V1' }],
      },
    })
    await expect(page.getByTestId('song-slide')).toContainText('de două ori', { timeout: 10_000 })
    await pause(3500)
    // PC out of reach.
    await page.getByRole('button', { name: 'Songs' }).click()
    await pause(1000)
    await remote(request, false)
    await expect(link).toHaveAttribute('data-link', 'cloud', { timeout: 30_000 })
    await pause(4000)
    await remote(request, true)
    await page.clock.fastForward(31_000)
    await expect(link).toHaveAttribute('data-link', 'live', { timeout: 60_000 })
    await pause(3000)
    const phoneVideo = page.video()
    await phone.close()
    copyFileSync((await phoneVideo?.path()) as string, `${REC}/phone.webm`)
  } finally {
    await remote(request, false)
    await request.delete(`/api/songs/${songId}`)
    await request.delete('/api/sync/cloud')
    await request.delete(`/api/users/${userId}`)
    await publicApp.stop()
    stopRelay()
    await service.dispose()
    await s3.stop()
  }
})
