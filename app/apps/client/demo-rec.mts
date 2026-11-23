// Records one demo clip: node demo-rec.ts <name> <songId> <mode>
import { chromium } from '@playwright/test'
import { renameSync } from 'node:fs'
const [name, songId, mode] = process.argv.slice(2)
const out = 'C:/Users/Tibi/projects/church-hub/.superfactory/worktrees/T-084/.demo/T-084/rec'
const base = 'http://127.0.0.1:20050'
const size = { width: 1920, height: 1080 }
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: out, size }, baseURL: base, locale: 'ro-RO' })
const login = await ctx.request.post('/api/auth/login', { data: { userId: 5 } })
if (!login.ok()) throw new Error('login ' + login.status())
const page = await ctx.newPage()
await page.goto(`/songs/${songId}`)
await page.waitForLoadState('networkidle')
await page.waitForTimeout(2500)
if (mode === 'before') {
  await page.getByText('Versiuni ale cântării').first().hover()
  await page.waitForTimeout(3000)
} else if (mode === 'panel') {
  const panel = page.getByTestId('same-theme-panel')
  await panel.getByTestId('same-theme-row').first().waitFor()
  await panel.hover()
  await page.waitForTimeout(3000)
  await panel.getByTestId('same-theme-row').nth(1).hover()
  await page.waitForTimeout(2500)
} else if (mode === 'open') {
  const panel = page.getByTestId('same-theme-panel')
  await panel.getByTestId('same-theme-row').first().waitFor()
  await page.waitForTimeout(1000)
  await panel.getByTestId('same-theme-row').first().click()
  await page.waitForTimeout(3500)
}
const video = page.video()
await ctx.close()
await browser.close()
renameSync(await video!.path(), `${out}/${name}.webm`)
console.log('saved', name)
