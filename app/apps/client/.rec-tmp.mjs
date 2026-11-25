import { chromium } from 'playwright'
import { renameSync } from 'node:fs'
const base = 'http://localhost:20040'
const size = { width: 1920, height: 1080 }
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: '.demo/T-184/rec/raw', size } })
const users = await (await ctx.request.get(base + '/api/auth/local-users')).json()
await ctx.request.post(base + '/api/auth/login', { data: { userId: users.data.find((u) => u.isSuperAdmin).id } })
const page = await ctx.newPage()
await page.goto(base + '/settings/screens'); await page.waitForTimeout(2500)
await page.mouse.move(1200, 600); await page.mouse.wheel(0, 500); await page.waitForTimeout(1500)
await page.mouse.wheel(0, -500); await page.waitForTimeout(1000)
await page.getByRole('button', { name: /Editează aspectul/ }).first().click()
await page.waitForTimeout(2000)
await page.getByText('Cântare', { exact: true }).first().click(); await page.waitForTimeout(1200)
await page.getByText('Verset biblic', { exact: true }).first().click(); await page.waitForTimeout(2000)
await page.getByText('Implicit (fără scenă)').first().click(); await page.waitForTimeout(1200)
await page.getByText('predicator', { exact: true }).first().click(); await page.waitForTimeout(2500)
await page.keyboard.press('Escape'); await page.waitForTimeout(500)
const v = page.video()
await ctx.close(); await browser.close()
renameSync(await v.path(), '.demo/T-184/rec/before-editor.webm')
