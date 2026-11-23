import { expect, test } from '@playwright/test'

import { selectAction } from './helpers/actions-menu'

/**
 * A Markdown list becomes a presentation (T-016): "Încarcă din fișier" on the
 * presentation page takes a `.md` file, such as a Marcaje export, and turns its
 * songs, Bible passages and notes into the presentation's items.
 */

interface ApiItem {
  itemType: string
  slideType: string | null
  slideContent: string | null
  song: { title: string } | null
}

test.describe('Presentation from Markdown', () => {
  test('a Marcaje-style Markdown file becomes the presentation', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const songTitle = `E2E Markdown Song ${uniq}`
    const songRes = await request.post('/api/songs', {
      data: {
        title: songTitle,
        slides: [{ content: '<p>Verse</p>', sortOrder: 0 }],
      },
    })
    expect(songRes.ok()).toBeTruthy()
    const songId: number = (await songRes.json()).data.id

    const translations = (
      await (await request.get('/api/bible/translations')).json()
    ).data as { abbreviation: string }[]
    const bible = translations[0]?.abbreviation

    const scheduleRes = await request.post('/api/schedules', {
      data: { title: `E2E Markdown ${uniq}` },
    })
    const scheduleId: number = (await scheduleRes.json()).data.id

    // As the song Marcaje export writes it: the heading with the song's id,
    // its details and lyrics (skipped), then a note.
    const markdown = [
      '# Duminică dimineața',
      '',
      `## ${songTitle} {#song-${songId}}`,
      '',
      '*Laudă · Do major*',
      '',
      '### Strofa 1',
      '',
      'Verse',
      '',
      '> Bun venit la **slujbă**!',
      ...(bible
        ? ['', `## Ioan 3:16 - ${bible}`, '', 'Fiindcă atât de mult...']
        : []),
    ].join('\n')

    try {
      await page.goto(`/schedules/${scheduleId}`)
      await expect(page.getByTestId('schedule-run-button')).toBeVisible({
        timeout: 15_000,
      })

      const chooser = page.waitForEvent('filechooser')
      await selectAction(
        page,
        'schedule-presenter-actions-menu',
        'schedule-load-from-file-action',
      )
      await (await chooser).setFiles({
        name: 'Duminica.md',
        mimeType: 'text/markdown',
        buffer: Buffer.from(markdown, 'utf8'),
      })

      const dialog = page.getByRole('dialog')
      await expect(dialog).toContainText('Duminică dimineața')
      await dialog.getByRole('button', { name: /^(Import|Importă)/ }).click()

      await expect
        .poll(
          async () =>
            (
              (await (await request.get(`/api/schedules/${scheduleId}`)).json())
                .data.items as ApiItem[]
            ).length,
          { timeout: 10_000 },
        )
        .toBe(bible ? 3 : 2)

      const items: ApiItem[] = (
        await (await request.get(`/api/schedules/${scheduleId}`)).json()
      ).data.items
      expect(items[0].song?.title).toBe(songTitle)
      expect(items[1].slideType).toBe('announcement')
      expect(items[1].slideContent).toBe('<p>Bun venit la slujbă!</p>')
      if (bible) expect(JSON.stringify(items[2])).toContain('3:16')
    } finally {
      await request.delete(`/api/schedules/${scheduleId}`)
      await request.delete(`/api/songs/${songId}`)
    }
  })
})
