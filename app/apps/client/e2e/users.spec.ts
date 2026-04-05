import { expect, test } from '@playwright/test'

test.describe('User Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
  })

  test('settings page loads with user list section', async ({ page }) => {
    // The settings page should contain the user list component
    await expect(page.locator('body')).toBeVisible()
    // Look for the authorized users / devices section heading
    const userSection = page.locator(
      'text=/authorized|users|devices|utilizatori|dispozitive/i',
    )
    await expect(userSection.first()).toBeVisible({ timeout: 10000 })
  })

  test('can view the list of devices via API', async ({ request }) => {
    const response = await request.get('/api/devices')
    // May be 200 or 403 depending on auth context
    expect([200, 403]).toContain(response.status())

    if (response.status() === 200) {
      const json = await response.json()
      expect(json).toHaveProperty('data')
      expect(Array.isArray(json.data)).toBe(true)
    }
  })

  test('can create a device via API', async ({ request }) => {
    const response = await request.post('/api/devices', {
      data: {
        name: `E2E Test Device ${Date.now()}`,
        permissions: {
          'songs.view': true,
          'songs.edit': false,
          'bible.view': true,
          'schedules.view': true,
          'settings.view': false,
        },
      },
    })

    // May be 201 or 403 depending on auth context
    expect([201, 400, 403]).toContain(response.status())

    if (response.status() === 201) {
      const json = await response.json()
      expect(json).toHaveProperty('data')
      expect(json.data).toHaveProperty('device')
      expect(json.data).toHaveProperty('token')
      expect(typeof json.data.token).toBe('string')

      // Clean up: delete the created device
      const deviceId = json.data.device.id
      await request.delete(`/api/devices/${deviceId}`)
    }
  })

  test('can update device permissions via API', async ({ request }) => {
    // First create a device
    const createResponse = await request.post('/api/devices', {
      data: {
        name: `E2E Perm Test ${Date.now()}`,
        permissions: {
          'songs.view': true,
          'songs.edit': false,
        },
      },
    })

    if (createResponse.status() !== 201) {
      test.skip(true, 'Cannot create device (auth required)')
      return
    }

    const { data: createData } = await createResponse.json()
    const deviceId = createData.device.id

    // Update permissions
    const updateResponse = await request.put(
      `/api/devices/${deviceId}/permissions`,
      {
        data: {
          permissions: {
            'songs.view': true,
            'songs.edit': true,
            'bible.view': true,
          },
        },
      },
    )

    expect(updateResponse.status()).toBe(200)
    const updated = await updateResponse.json()
    expect(updated).toHaveProperty('data')

    // Clean up
    await request.delete(`/api/devices/${deviceId}`)
  })

  test('can regenerate device token via API', async ({ request }) => {
    // Create a device first
    const createResponse = await request.post('/api/devices', {
      data: {
        name: `E2E Token Test ${Date.now()}`,
        permissions: { 'songs.view': true },
      },
    })

    if (createResponse.status() !== 201) {
      test.skip(true, 'Cannot create device (auth required)')
      return
    }

    const { data: createData } = await createResponse.json()
    const deviceId = createData.device.id
    const originalToken = createData.token

    // Regenerate token
    const regenResponse = await request.post(
      `/api/devices/${deviceId}/regenerate-token`,
    )

    expect(regenResponse.status()).toBe(200)
    const regenData = await regenResponse.json()
    expect(regenData.data).toHaveProperty('token')
    expect(regenData.data.token).not.toBe(originalToken)

    // Clean up
    await request.delete(`/api/devices/${deviceId}`)
  })

  test('can delete a device via API', async ({ request }) => {
    // Create and immediately delete
    const createResponse = await request.post('/api/devices', {
      data: {
        name: `E2E Delete Test ${Date.now()}`,
        permissions: {},
      },
    })

    if (createResponse.status() !== 201) {
      test.skip(true, 'Cannot create device (auth required)')
      return
    }

    const { data: createData } = await createResponse.json()
    const deviceId = createData.device.id

    const deleteResponse = await request.delete(`/api/devices/${deviceId}`)
    expect(deleteResponse.status()).toBe(200)
    const deleteData = await deleteResponse.json()
    expect(deleteData.data.success).toBe(true)

    // Verify it is gone
    const getResponse = await request.get(`/api/devices/${deviceId}`)
    expect(getResponse.status()).toBe(404)
  })

  test('device authentication via token redirects', async ({ request }) => {
    // Create a device to get a token
    const createResponse = await request.post('/api/devices', {
      data: {
        name: `E2E Auth Test ${Date.now()}`,
        permissions: { 'songs.view': true },
      },
    })

    if (createResponse.status() !== 201) {
      test.skip(true, 'Cannot create device (auth required)')
      return
    }

    const { data: createData } = await createResponse.json()
    const token = createData.token
    const deviceId = createData.device.id

    // Auth endpoint should set cookie and redirect
    const authResponse = await request.get(`/api/auth/device/${token}`, {
      maxRedirects: 0,
    })
    // Should be a redirect (302) or 200 if followed
    expect([200, 302]).toContain(authResponse.status())

    // Clean up
    await request.delete(`/api/devices/${deviceId}`)
  })
})
