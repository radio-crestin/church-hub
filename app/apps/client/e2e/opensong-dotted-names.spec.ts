import { expect, type Page, test } from '@playwright/test'
import JSZip from 'jszip'

/**
 * OpenSong saves songs as files with no extension, named after the song, and
 * resursecrestine.ro's ZIP does the same ("Când suferi... - 168654"). A dot in
 * such a name is not an extension: those songs used to be skipped, so 168
 * songs were missing from the Resurse Creștine import (WhatsApp #65).
 */

const ts = Date.now()
/** Each file, its title, and the words Song discovery lists it by. */
const songs = [
  {
    file: `Cand suferi... - ${ts}`,
    title: 'Când suferi...',
    shown: /Când suferi/,
  },
  {
    file: `Domnul e adapostul si sprijinul meu. - ${ts}`,
    title: 'Domnul e adăpostul și sprijinul meu.',
    shown: /Domnul e adăpostul și sprijinul meu/,
  },
  {
    file: `Cantarea lui Ezechia (Isaia 38.9-20) - ${ts}`,
    title: 'Cântarea lui Ezechia (Isaia 38.9-20)',
    shown: /Cântarea lui Ezechia/,
  },
  {
    file: `Isus e Domnul - ${ts}`,
    title: 'Isus e Domnul',
    shown: /Isus e Domnul/,
  },
]

const openSong = (title: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<song>
  <title>${title}</title>
  <lyrics>[V1]
 ${title}, aleluia</lyrics>
</song>`

/** Drops a file on the page the way a user drags one in. */
async function dropFile(page: Page, bytes: Buffer, name: string) {
  await page.evaluate(
    ({ base64, fileName }) => {
      const data = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const transfer = new DataTransfer()
      transfer.items.add(new File([data], fileName))
      document.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        }),
      )
    },
    { base64: bytes.toString('base64'), fileName: name },
  )
}

test('OpenSong files with dots in their names are read', async ({ page }) => {
  // A plain ZIP of OpenSong files, laid out like resursecrestine.ro's.
  const zip = new JSZip()
  for (const song of songs) {
    zip.file(`cantece/${song.file}`, openSong(song.title))
  }
  const file = await zip.generateAsync({ type: 'nodebuffer' })

  await page.goto('/songs')
  await dropFile(page, file, `opensong-${ts}.chsongs`)
  await expect(page).toHaveURL(/\/songs\/discover\?source=file-/)

  for (const song of songs) {
    await expect(page.getByRole('checkbox', { name: song.shown })).toBeVisible({
      timeout: 30_000,
    })
  }
})
