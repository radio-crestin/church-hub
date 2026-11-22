import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

/**
 * T-165: while the backup status loaded, the local-backup card grew and its
 * "Remove" (Elimină) button slid into the place of "Choose folder", so a click
 * meant for one cleared the backup folder. The card now keeps its layout from
 * loading to loaded, and removing the folder asks first.
 */
test.describe('Local backup card', () => {
  let folder: string

  test.beforeEach(async ({ request }) => {
    folder = mkdtempSync(join(tmpdir(), 'ch-backup-stable-'))
    await request.put('/api/backup/config', {
      data: { localBackupPath: folder },
    })
    for (let i = 0; i < 2; i++) {
      expect((await request.post('/api/backup/local/now')).ok()).toBeTruthy()
    }
  })

  test.afterEach(async ({ request }) => {
    await request.put('/api/backup/config', { data: { localBackupPath: null } })
    rmSync(folder, { recursive: true, force: true })
  })

  test('nothing moves between loading and loaded, and Remove asks first', async ({
    page,
    request,
  }) => {
    // The desktop shell is what shows "Choose folder" and "Remove".
    await page.addInitScript(() => {
      ;(window as unknown as Record<string, unknown>).__TAURI__ = {}
    })
    // A slow status answer, so the loading layout stays up to be measured.
    let releaseStatus = () => {}
    const statusHeld = new Promise<void>((resolve) => {
      releaseStatus = resolve
    })
    await page.route('**/api/backup/status', async (route) => {
      await statusHeld
      await route.continue()
    })

    await page.goto('/settings/backup')
    await expect(page.getByTestId('backup-drive-loading')).toBeVisible()
    const panel = page.getByTestId('local-backup-panel')
    const choose = page.getByTestId('local-backup-choose')
    await expect(choose).toBeDisabled()
    const panelBefore = await panel.boundingBox()
    const chooseBefore = await choose.boundingBox()

    releaseStatus()
    await expect(page.getByTestId('local-backup-row')).toHaveCount(2)
    await expect(page.getByTestId('local-backup-path')).toHaveText(folder)
    expect(await panel.boundingBox()).toEqual(panelBefore)
    expect(await choose.boundingBox()).toEqual(chooseBefore)

    // Remove opens a confirmation; cancelling keeps the folder.
    await page.getByTestId('local-backup-clear').click()
    const dialog = page.getByTestId('local-backup-clear-dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: /Cancel|Anulează/ }).click()
    await expect(dialog).toBeHidden()
    const kept = await (await request.get('/api/backup/status')).json()
    expect(kept.data.localBackupPath).toBe(folder)

    // Confirming it stops local backups.
    await page.getByTestId('local-backup-clear').click()
    await page.getByTestId('local-backup-clear-confirm').click()
    await expect(page.getByTestId('local-backup-path')).not.toHaveText(folder)
    const cleared = await (await request.get('/api/backup/status')).json()
    expect(cleared.data.localBackupPath).toBeNull()
  })
})
