import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * Presentations inside presentations (T-907): a `schedule` item plays another
 * presentation in its place, nested at any depth, and never in a loop. The
 * control room's queue is a presentation too, hidden from the list.
 */

async function createPresentation(
  request: APIRequestContext,
  ids: number[],
  title: string,
): Promise<number> {
  const res = await request.post('/api/schedules', {
    data: { title, automation: { autoplayByText: false } },
  })
  expect(res.ok()).toBeTruthy()
  const id: number = (await res.json()).data.id
  ids.push(id)
  return id
}

function nest(request: APIRequestContext, scheduleId: number, childId: number) {
  return request.post(`/api/schedules/${scheduleId}/items`, {
    data: { childScheduleId: childId },
  })
}

test.describe('Presentations inside presentations - API', () => {
  const ids: number[] = []

  test.afterAll(async ({ request }) => {
    for (const id of ids) await request.delete(`/api/schedules/${id}`)
  })

  test('a presentation plays another one, nested items and all', async ({
    request,
  }) => {
    const tag = Date.now()
    const outer = await createPresentation(request, ids, `Outer ${tag}`)
    const middle = await createPresentation(request, ids, `Middle ${tag}`)
    const inner = await createPresentation(request, ids, `Inner ${tag}`)
    await request.post(`/api/schedules/${inner}/items`, {
      data: { slideType: 'announcement', slideContent: '<p>Inner</p>' },
    })
    expect((await nest(request, middle, inner)).status()).toBe(201)
    const added = await nest(request, outer, middle)
    expect(added.status()).toBe(201)
    expect((await added.json()).data).toMatchObject({
      itemType: 'schedule',
      childScheduleId: middle,
      childSchedule: { id: middle, title: `Middle ${tag}` },
    })

    const got = (await (await request.get(`/api/schedules/${outer}`)).json())
      .data
    expect(got.childScheduleIds).toEqual([middle])
    const nested = got.items[0].childSchedule.items[0].childSchedule
    expect(nested.id).toBe(inner)
    expect(nested.items[0].slideContent).toBe('<p>Inner</p>')

    // The list says what each one plays, for the add menu to offer only
    // presentations that make no loop.
    const list = (await (await request.get('/api/schedules')).json()).data
    expect(list.find((s: { id: number }) => s.id === middle)).toMatchObject({
      childScheduleIds: [inner],
    })
  })

  test('a loop is refused: itself, or one that already includes it', async ({
    request,
  }) => {
    const tag = Date.now()
    const a = await createPresentation(request, ids, `Loop A ${tag}`)
    const b = await createPresentation(request, ids, `Loop B ${tag}`)
    const c = await createPresentation(request, ids, `Loop C ${tag}`)
    expect((await nest(request, a, b)).status()).toBe(201)
    expect((await nest(request, b, c)).status()).toBe(201)

    const self = await nest(request, a, a)
    expect(self.status()).toBe(400)
    expect((await self.json()).error).toMatch(/loop/)

    // C is inside B, which is inside A: A inside C would loop.
    const transitive = await nest(request, c, a)
    expect(transitive.status()).toBe(400)
    expect((await transitive.json()).error).toMatch(/loop/)

    const missing = await nest(request, a, 99_999_999)
    expect(missing.status()).toBe(400)

    // The same presentation twice side by side is no loop.
    expect((await nest(request, a, c)).status()).toBe(201)
  })

  test('deleting a presentation removes the items that played it', async ({
    request,
  }) => {
    const tag = Date.now()
    const outer = await createPresentation(request, ids, `Holder ${tag}`)
    const child = await createPresentation(request, ids, `Gone ${tag}`)
    await nest(request, outer, child)
    await request.delete(`/api/schedules/${child}`)
    const got = (await (await request.get(`/api/schedules/${outer}`)).json())
      .data
    expect(got.items).toEqual([])
  })

  test('a presentation held many times over loads quickly and stays bounded; too many items are refused', async ({
    request,
  }) => {
    const tag = Date.now()
    const levels: number[] = []
    for (let i = 0; i < 5; i++) {
      levels.push(await createPresentation(request, ids, `Fan ${i} ${tag}`))
    }
    await request.post(`/api/schedules/${levels[4]}/items`, {
      data: { slideType: 'announcement', slideContent: '<p>Fan</p>' },
    })
    // Each level holds the next one six times: 1, 12, 78, 474 items.
    for (const level of [3, 2, 1]) {
      for (let n = 0; n < 6; n++) {
        const res = await nest(request, levels[level]!, levels[level + 1]!)
        expect(res.status()).toBe(201)
      }
    }
    // A fourth level of six would run 2844 items: refused past 1000.
    expect((await nest(request, levels[0]!, levels[1]!)).status()).toBe(201)
    expect((await nest(request, levels[0]!, levels[1]!)).status()).toBe(201)
    const tooMany = await nest(request, levels[0]!, levels[1]!)
    expect(tooMany.status()).toBe(400)
    expect((await tooMany.json()).error).toMatch(/at most 1000 items/)

    const started = Date.now()
    const got = await request.get(`/api/schedules/${levels[0]}`)
    expect(got.status()).toBe(200)
    expect(Date.now() - started).toBeLessThan(2000)
    type Item = { childSchedule: { items: Item[] } | null }
    const count = (items: Item[]): number =>
      items.reduce(
        (sum, item) => sum + 1 + count(item.childSchedule?.items ?? []),
        0,
      )
    const expanded = count((await got.json()).data.items)
    expect(expanded).toBe(2 + 2 * 474)
    expect(expanded).toBeLessThanOrEqual(1000)
  })

  test('nesting deeper than five levels is refused', async ({ request }) => {
    const tag = Date.now()
    const chain: number[] = []
    for (let i = 0; i < 7; i++) {
      chain.push(await createPresentation(request, ids, `Deep ${i} ${tag}`))
    }
    for (let i = 0; i < 5; i++) {
      expect((await nest(request, chain[i]!, chain[i + 1]!)).status()).toBe(201)
    }
    const tooDeep = await nest(request, chain[5]!, chain[6]!)
    expect(tooDeep.status()).toBe(400)
    expect((await tooDeep.json()).error).toMatch(/5 levels deep/)
  })

  test('the queue is a presentation hidden from the list, that cannot go inside another', async ({
    request,
  }) => {
    const res = await request.get('/api/schedules/queue')
    expect(res.status()).toBe(200)
    const queue = (await res.json()).data
    expect(Array.isArray(queue.items)).toBe(true)
    // The same one every time.
    const again = (await (await request.get('/api/schedules/queue')).json())
      .data
    expect(again.id).toBe(queue.id)

    const list = (await (await request.get('/api/schedules')).json()).data
    expect(list.some((s: { id: number }) => s.id === queue.id)).toBe(false)

    const holder = await createPresentation(
      request,
      ids,
      `Queue holder ${Date.now()}`,
    )
    const refused = await nest(request, holder, queue.id)
    expect(refused.status()).toBe(400)

    // A program can go into the queue.
    const program = await createPresentation(
      request,
      ids,
      `Queued program ${Date.now()}`,
    )
    const queued = await nest(request, queue.id, program)
    expect(queued.status()).toBe(201)
    await request.delete(
      `/api/schedules/${queue.id}/items/${(await queued.json()).data.id}`,
    )
  })
})
