import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * The song editor modal is a native <dialog> opened with showModal(), which
 * puts it in the browser's top layer. A dropdown portalled to document.body
 * lands BELOW that layer: invisible, unclickable, and — where it overflows the
 * card — swallowed as a backdrop click that closes the whole editor. So the
 * category and tag pickers must portal into the dialog itself.
 *
 * This walks the modal from the Marcaje pencil, the same modal the Programe
 * pencil opens.
 */

async function createSong(request: APIRequestContext, title: string) {
  const response = await request.post('/api/songs', {
    data: { title, slides: [{ content: `${title} lyrics`, sortOrder: 0 }] },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).data as { id: number; title: string }
}

async function readSong(request: APIRequestContext, songId: number) {
  const response = await request.get(`/api/songs/${songId}`)
  return (await response.json()).data as {
    categoryId: number | null
    tags: Array<{ id: number; name: string }>
  }
}

test.describe('Song editor modal pickers', () => {
  test('the category and tag dropdowns open inside the dialog and save', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const categoryName = `E2E Modal Cat ${uniq}`
    const tagName = `E2E Modal Tag ${uniq}`

    const category = (
      await (
        await request.post('/api/categories', { data: { name: categoryName } })
      ).json()
    ).data as { id: number }
    const tag = (
      await (
        await request.post('/api/song-tags', { data: { name: tagName } })
      ).json()
    ).data as { id: number }
    const host = await createSong(request, `E2E Modal Host ${uniq}`)
    const marked = await createSong(request, `E2E Modal Marked ${uniq}`)

    try {
      await request.post('/api/song-bookmarks', { data: { songId: marked.id } })

      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto(`/songs/${host.id}`)
      await page.waitForLoadState('networkidle')

      const row = page
        .getByTestId('bookmark-item')
        .filter({ hasText: `E2E Modal Marked ${uniq}` })
      await expect(row).toBeVisible({ timeout: 10000 })
      await row.getByTestId('bookmark-song-edit').click()

      const modal = page.getByTestId('song-editor-modal')
      await expect(modal).toBeVisible({ timeout: 10000 })

      // Tags: the dropdown must be reachable, and picking an option must add a
      // chip rather than close the editor.
      await modal.getByTestId('tag-picker-trigger').click()
      await expect(page.getByTestId('tag-picker-dropdown')).toBeVisible()
      await page
        .getByTestId('tag-picker-option')
        .filter({ hasText: tagName })
        .click()
      await expect(modal).toBeVisible()
      // Escape from the dropdown's own search box: it is only reachable when
      // the dropdown really lives inside the dialog.
      await page
        .getByTestId('tag-picker-dropdown')
        .getByRole('textbox')
        .press('Escape')
      await expect(page.getByTestId('tag-picker-dropdown')).toHaveCount(0)
      await expect(modal.getByText(tagName)).toBeVisible()

      // Category: same story, through the Combobox.
      await modal.getByTestId('category-picker').click()
      await expect(page.getByTestId('category-picker-dropdown')).toBeVisible()
      await page
        .getByTestId('category-picker-option')
        .filter({ hasText: categoryName })
        .click()
      await expect(modal.getByTestId('category-picker')).toContainText(
        categoryName,
      )

      // Both choices reach the server.
      await modal.getByTestId('song-editor-modal-save').click()
      await expect
        .poll(
          async () => {
            const song = await readSong(request, marked.id)
            return {
              categoryId: song.categoryId,
              tags: song.tags.map((t) => t.name),
            }
          },
          { timeout: 10000 },
        )
        .toEqual({ categoryId: category.id, tags: [tagName] })
    } finally {
      const bookmarks = (
        await (await request.get('/api/song-bookmarks')).json()
      ).data as Array<{ id: number; songId: number }>
      for (const bookmark of bookmarks) {
        if (bookmark.songId === marked.id) {
          await request
            .delete(`/api/song-bookmarks/${bookmark.id}`)
            .catch(() => {})
        }
      }
      await request.delete(`/api/songs/${marked.id}`).catch(() => {})
      await request.delete(`/api/songs/${host.id}`).catch(() => {})
      await request.delete(`/api/song-tags/${tag.id}`).catch(() => {})
      await request.delete(`/api/categories/${category.id}`).catch(() => {})
    }
  })
})
