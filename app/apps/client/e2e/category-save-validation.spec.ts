import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * Saving a category takes its fields as values, never as SQL.
 *
 * A priority is a whole number: anything else is refused with 400 and the
 * category stays as it was. A name is stored exactly as typed, quotes included.
 */

interface Category {
  id: number
  name: string
  priority: number
}

async function save(request: APIRequestContext, data: Record<string, unknown>) {
  return request.post('/api/categories', { data })
}

async function read(request: APIRequestContext, id: number) {
  const list = (await (await request.get('/api/categories')).json())
    .data as Category[]
  return list.find((c) => c.id === id)
}

test.describe('Saving a category', () => {
  let category: Category

  test.beforeEach(async ({ request }) => {
    const response = await save(request, {
      name: `E2E Save ${Date.now()}`,
      priority: 1,
    })
    expect(response.status()).toBe(201)
    category = (await response.json()).data
  })

  test.afterEach(async ({ request }) => {
    await request.delete(`/api/categories/${category.id}`)
  })

  for (const priority of ['abc', '2', 1.5, `1, name = 'changed'`, null]) {
    test(`refuses priority ${JSON.stringify(priority)} and leaves the category as it was`, async ({
      request,
    }) => {
      const response = await save(request, {
        id: category.id,
        name: category.name,
        priority,
      })
      expect(response.status()).toBe(400)
      expect(await read(request, category.id)).toMatchObject({
        name: category.name,
        priority: 1,
      })
    })
  }

  test('refuses a non-integer priority on a new category', async ({
    request,
  }) => {
    const response = await save(request, {
      name: `E2E Save bad ${Date.now()}`,
      priority: 'high',
    })
    const created = response.ok() ? (await response.json()).data : null
    if (created) await request.delete(`/api/categories/${created.id}`)
    expect(response.status()).toBe(400)
  })

  test('keeps a whole-number priority and a name with quotes as typed', async ({
    request,
  }) => {
    const name = `E2E Save "Cântări" d'acum ${Date.now()}`
    const response = await save(request, { id: category.id, name, priority: 7 })
    expect(response.status()).toBe(200)
    expect(await read(request, category.id)).toMatchObject({
      name,
      priority: 7,
    })
  })
})
