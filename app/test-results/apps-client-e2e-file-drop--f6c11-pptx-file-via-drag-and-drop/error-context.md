# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: apps/client/e2e/file-drop-import.spec.ts >> File Drop Import >> can import a .pptx file via drag and drop
- Location: apps/client/e2e/file-drop-import.spec.ts:69:3

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/songs", waiting until "load"

```

# Test source

```ts
  1   | import fs from 'node:fs'
  2   | import path from 'node:path'
  3   | import { fileURLToPath } from 'node:url'
  4   | import { expect, test } from '@playwright/test'
  5   | 
  6   | const currentDir = path.dirname(fileURLToPath(import.meta.url))
  7   | const FIXTURES_DIR = path.join(currentDir, 'fixtures')
  8   | const PPTX_FILE = path.join(FIXTURES_DIR, 'Cand Isus Hristos m-a mantuit.pptx')
  9   | const PPT_FILE = path.join(FIXTURES_DIR, 'Se cuvine.ppt')
  10  | 
  11  | /**
  12  |  * Delete all songs matching a title substring via the API.
  13  |  */
  14  | async function deleteMatchingSongs(
  15  |   request: import('@playwright/test').APIRequestContext,
  16  |   titleSubstring: string,
  17  | ) {
  18  |   const resp = await request.get('http://localhost:3000/api/songs')
  19  |   const json = await resp.json()
  20  |   for (const song of json.data ?? []) {
  21  |     if (
  22  |       (song.title as string)
  23  |         .toLowerCase()
  24  |         .includes(titleSubstring.toLowerCase())
  25  |     ) {
  26  |       await request.delete(`http://localhost:3000/api/songs/${song.id}`)
  27  |     }
  28  |   }
  29  | }
  30  | 
  31  | /**
  32  |  * Simulates a file drop on the document by injecting file bytes into a
  33  |  * synthetic DragEvent. Chromium's DataTransfer constructor supports
  34  |  * `items.add(file)`, so the handler sees `e.dataTransfer.files`.
  35  |  */
  36  | async function simulateFileDrop(
  37  |   page: import('@playwright/test').Page,
  38  |   fileBuffer: Buffer,
  39  |   fileName: string,
  40  |   mimeType: string,
  41  | ) {
  42  |   const base64Data = fileBuffer.toString('base64')
  43  | 
  44  |   await page.evaluate(
  45  |     ({ base64, name, mime }) => {
  46  |       const binaryString = atob(base64)
  47  |       const bytes = new Uint8Array(binaryString.length)
  48  |       for (let i = 0; i < binaryString.length; i++) {
  49  |         bytes[i] = binaryString.charCodeAt(i)
  50  |       }
  51  | 
  52  |       const file = new File([bytes], name, { type: mime })
  53  |       const dt = new DataTransfer()
  54  |       dt.items.add(file)
  55  | 
  56  |       document.dispatchEvent(
  57  |         new DragEvent('drop', {
  58  |           bubbles: true,
  59  |           cancelable: true,
  60  |           dataTransfer: dt,
  61  |         }),
  62  |       )
  63  |     },
  64  |     { base64: base64Data, name: fileName, mime: mimeType },
  65  |   )
  66  | }
  67  | 
  68  | test.describe('File Drop Import', () => {
  69  |   test('can import a .pptx file via drag and drop', async ({ page }) => {
  70  |     // Clean up any existing song with the same title first
  71  |     await deleteMatchingSongs(page.request, 'Isus Hristos')
  72  |     await deleteMatchingSongs(page.request, 'mantuit')
  73  | 
> 74  |     await page.goto('/songs')
      |                ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  75  |     await page.waitForLoadState('networkidle')
  76  | 
  77  |     const fileBuffer = fs.readFileSync(PPTX_FILE)
  78  | 
  79  |     // Listen for the POST /api/songs response that creates the song
  80  |     const songCreatedPromise = page.waitForResponse(
  81  |       (resp) =>
  82  |         resp.url().includes('http://localhost:3000/api/songs') &&
  83  |         !resp.url().includes('/search') &&
  84  |         resp.request().method() === 'POST' &&
  85  |         (resp.status() === 200 || resp.status() === 201),
  86  |       { timeout: 15000 },
  87  |     )
  88  | 
  89  |     await simulateFileDrop(
  90  |       page,
  91  |       fileBuffer,
  92  |       'Cand Isus Hristos m-a mantuit.pptx',
  93  |       'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  94  |     )
  95  | 
  96  |     const response = await songCreatedPromise
  97  |     const json = await response.json()
  98  | 
  99  |     expect(json).toHaveProperty('data')
  100 |     expect(json.data).toHaveProperty('id')
  101 |     expect(json.data.slides.length).toBeGreaterThan(0)
  102 | 
  103 |     // Should navigate to the song detail page
  104 |     await page.waitForURL(/\/songs\/\d+/, { timeout: 10000 })
  105 | 
  106 |     // Clean up the created song
  107 |     await page.request.delete(`http://localhost:3000/api/songs/${json.data.id}`)
  108 |   })
  109 | 
  110 |   test('can import a .ppt file via drag and drop', async ({ page }) => {
  111 |     // Check if LibreOffice is available for PPT conversion
  112 |     const libreCheckResponse = await page.request.get(
  113 |       'http://localhost:3000/api/convert/check-libreoffice',
  114 |     )
  115 |     const libreCheck = await libreCheckResponse.json()
  116 | 
  117 |     if (!libreCheck.data?.installed) {
  118 |       test.skip(
  119 |         true,
  120 |         'LibreOffice is not installed — PPT conversion unavailable',
  121 |       )
  122 |       return
  123 |     }
  124 | 
  125 |     // Clean up any existing song with the same title
  126 |     await deleteMatchingSongs(page.request, 'Se cuvine')
  127 | 
  128 |     await page.goto('/songs')
  129 |     await page.waitForLoadState('networkidle')
  130 | 
  131 |     const fileBuffer = fs.readFileSync(PPT_FILE)
  132 | 
  133 |     // PPT conversion takes longer
  134 |     const songCreatedPromise = page.waitForResponse(
  135 |       (resp) =>
  136 |         resp.url().includes('http://localhost:3000/api/songs') &&
  137 |         !resp.url().includes('/search') &&
  138 |         resp.request().method() === 'POST' &&
  139 |         (resp.status() === 200 || resp.status() === 201),
  140 |       { timeout: 60000 },
  141 |     )
  142 | 
  143 |     await simulateFileDrop(
  144 |       page,
  145 |       fileBuffer,
  146 |       'Se cuvine.ppt',
  147 |       'application/vnd.ms-powerpoint',
  148 |     )
  149 | 
  150 |     const response = await songCreatedPromise
  151 |     const json = await response.json()
  152 | 
  153 |     expect(json).toHaveProperty('data')
  154 |     expect(json.data).toHaveProperty('id')
  155 |     expect(json.data.slides.length).toBeGreaterThan(0)
  156 | 
  157 |     // Should navigate to the song detail page
  158 |     await page.waitForURL(/\/songs\/\d+/, { timeout: 15000 })
  159 | 
  160 |     // Clean up the created song
  161 |     await page.request.delete(`http://localhost:3000/api/songs/${json.data.id}`)
  162 |   })
  163 | })
  164 | 
```