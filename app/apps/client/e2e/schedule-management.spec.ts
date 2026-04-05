import { expect, test } from '@playwright/test'

test.describe('Schedule Management - API', () => {
  const testScheduleIds: number[] = []

  test.afterAll(async ({ request }) => {
    for (const id of testScheduleIds) {
      await request.delete(`/api/schedules/${id}`)
    }
  })

  test('can list all schedules', async ({ request }) => {
    const response = await request.get('/api/schedules')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('can create a new schedule', async ({ request }) => {
    const response = await request.post('/api/schedules', {
      data: {
        title: `E2E Test Schedule ${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
      },
    })

    expect(response.status()).toBe(200)
    const json = await response.json()
    expect(json).toHaveProperty('data')
    expect(json.data).toHaveProperty('id')
    expect(json.data).toHaveProperty('title')

    testScheduleIds.push(json.data.id)
  })

  test('can get a schedule by ID with items', async ({ request }) => {
    // Create a schedule first
    const createResponse = await request.post('/api/schedules', {
      data: {
        title: `E2E Get Schedule ${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
      },
    })
    const { data: created } = await createResponse.json()
    testScheduleIds.push(created.id)

    const getResponse = await request.get(`/api/schedules/${created.id}`)
    expect(getResponse.status()).toBe(200)

    const json = await getResponse.json()
    expect(json.data).toHaveProperty('id')
    expect(json.data.id).toBe(created.id)
  })

  test('can add a song item to schedule', async ({ request }) => {
    // Create a schedule
    const scheduleResponse = await request.post('/api/schedules', {
      data: {
        title: `E2E Add Item ${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
      },
    })
    const { data: schedule } = await scheduleResponse.json()
    testScheduleIds.push(schedule.id)

    // Get a song to add
    const songsResponse = await request.get('/api/songs?limit=1')
    const songsJson = await songsResponse.json()

    if (songsJson.data.length === 0) {
      test.skip(true, 'No songs available')
      return
    }

    const songId = songsJson.data[0].id

    // Add the song to the schedule
    const addResponse = await request.post(
      `/api/schedules/${schedule.id}/items`,
      {
        data: { songId },
      },
    )

    expect(addResponse.status()).toBe(200)
    const addJson = await addResponse.json()
    expect(addJson.data).toHaveProperty('id')
  })

  test('can add a standalone slide item to schedule', async ({ request }) => {
    const scheduleResponse = await request.post('/api/schedules', {
      data: {
        title: `E2E Slide Item ${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
      },
    })
    const { data: schedule } = await scheduleResponse.json()
    testScheduleIds.push(schedule.id)

    const addResponse = await request.post(
      `/api/schedules/${schedule.id}/items`,
      {
        data: {
          slideType: 'custom',
          slideContent: 'Custom announcement text',
        },
      },
    )

    expect(addResponse.status()).toBe(200)
    const addJson = await addResponse.json()
    expect(addJson.data).toHaveProperty('id')
  })

  test('can update a standalone slide in schedule', async ({ request }) => {
    const scheduleResponse = await request.post('/api/schedules', {
      data: {
        title: `E2E Update Item ${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
      },
    })
    const { data: schedule } = await scheduleResponse.json()
    testScheduleIds.push(schedule.id)

    // Add a slide item
    const addResponse = await request.post(
      `/api/schedules/${schedule.id}/items`,
      {
        data: {
          slideType: 'custom',
          slideContent: 'Original content',
        },
      },
    )
    const { data: item } = await addResponse.json()

    // Update it
    const updateResponse = await request.put(
      `/api/schedules/${schedule.id}/items/${item.id}`,
      {
        data: {
          slideType: 'custom',
          slideContent: 'Updated content',
        },
      },
    )

    expect(updateResponse.status()).toBe(200)
  })

  test('can remove an item from schedule', async ({ request }) => {
    const scheduleResponse = await request.post('/api/schedules', {
      data: {
        title: `E2E Remove Item ${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
      },
    })
    const { data: schedule } = await scheduleResponse.json()
    testScheduleIds.push(schedule.id)

    const addResponse = await request.post(
      `/api/schedules/${schedule.id}/items`,
      {
        data: {
          slideType: 'custom',
          slideContent: 'To be removed',
        },
      },
    )
    const { data: item } = await addResponse.json()

    const deleteResponse = await request.delete(
      `/api/schedules/${schedule.id}/items/${item.id}`,
    )
    expect(deleteResponse.status()).toBe(200)
  })

  test('can reorder schedule items', async ({ request }) => {
    const scheduleResponse = await request.post('/api/schedules', {
      data: {
        title: `E2E Reorder Items ${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
      },
    })
    const { data: schedule } = await scheduleResponse.json()
    testScheduleIds.push(schedule.id)

    // Add multiple items
    const item1 = await request.post(`/api/schedules/${schedule.id}/items`, {
      data: { slideType: 'custom', slideContent: 'Item 1' },
    })
    const item2 = await request.post(`/api/schedules/${schedule.id}/items`, {
      data: { slideType: 'custom', slideContent: 'Item 2' },
    })
    const item3 = await request.post(`/api/schedules/${schedule.id}/items`, {
      data: { slideType: 'custom', slideContent: 'Item 3' },
    })

    const id1 = (await item1.json()).data.id
    const id2 = (await item2.json()).data.id
    const id3 = (await item3.json()).data.id

    // Reverse order
    const reorderResponse = await request.put(
      `/api/schedules/${schedule.id}/items/reorder`,
      {
        data: { itemIds: [id3, id2, id1] },
      },
    )

    expect(reorderResponse.status()).toBe(200)
  })

  test('can delete a schedule', async ({ request }) => {
    const createResponse = await request.post('/api/schedules', {
      data: {
        title: `E2E Delete Schedule ${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
      },
    })
    const { data: created } = await createResponse.json()

    const deleteResponse = await request.delete(`/api/schedules/${created.id}`)
    expect(deleteResponse.status()).toBe(200)

    // Verify deleted
    const getResponse = await request.get(`/api/schedules/${created.id}`)
    expect(getResponse.status()).toBe(404)
  })

  test('can search schedules', async ({ request }) => {
    const response = await request.get('/api/schedules/search?q=test')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('can import schedule to presentation queue', async ({ request }) => {
    // Create a schedule with items
    const scheduleResponse = await request.post('/api/schedules', {
      data: {
        title: `E2E Queue Import ${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
      },
    })
    const { data: schedule } = await scheduleResponse.json()
    testScheduleIds.push(schedule.id)

    // Add an item
    await request.post(`/api/schedules/${schedule.id}/items`, {
      data: { slideType: 'custom', slideContent: 'Queue content' },
    })

    // Import to queue
    const importResponse = await request.post(
      `/api/schedules/${schedule.id}/import-to-queue`,
    )
    expect(importResponse.status()).toBe(200)

    const json = await importResponse.json()
    expect(json.data).toHaveProperty('success')
  })

  test('getting non-existent schedule returns 404', async ({ request }) => {
    const response = await request.get('/api/schedules/999999')
    expect(response.status()).toBe(404)
  })
})

test.describe('Schedule Management - UI', () => {
  test('can navigate to schedules page', async ({ page }) => {
    await page.goto('/schedules')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/.*schedules/)
  })

  test('schedule list is displayed', async ({ page }) => {
    await page.goto('/schedules')
    await page.waitForLoadState('networkidle')

    // Page should load with schedule content
    await expect(page.locator('body')).toBeVisible()
    await page.waitForTimeout(1000)
  })

  test('can navigate to new schedule page', async ({ page }) => {
    await page.goto('/schedules/new')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/.*schedules\/new/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('can navigate to an existing schedule', async ({ page, request }) => {
    const listResponse = await request.get('/api/schedules')
    const listJson = await listResponse.json()

    if (listJson.data.length === 0) {
      test.skip(true, 'No schedules available')
      return
    }

    const scheduleId = listJson.data[0].id
    await page.goto(`/schedules/${scheduleId}`)
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(new RegExp(`schedules/${scheduleId}`))
    await expect(page.locator('body')).toBeVisible()
  })
})
