import { chromium } from 'playwright'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const url = pathToFileURL(resolve('.demo/T-184/plan.html')).href
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
for (const id of ['model','resolve','migration','gallery','screens','presentation','steps']) {
  await page.goto(url + '#' + id); await page.reload(); await page.waitForTimeout(300)
  await page.screenshot({ path: `.demo/T-184/${id}.png` })
}
await browser.close()
