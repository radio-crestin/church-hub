import { describe, expect, it } from 'vitest'

import i18n from '~/i18n/config'
import type { ScheduleItem } from '../../types'
import { getNextScheduleItemPreview } from '../nextScheduleItemPreview'

function makeItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 1,
    scheduleId: 1,
    itemType: 'slide',
    songId: null,
    song: null,
    slides: [],
    keyLine: null,
    isSung: false,
    sungAt: null,
    slideType: 'announcement',
    slideContent: '<p>Anunt</p>',
    biblePassageReference: null,
    biblePassageTranslation: null,
    biblePassageVerses: [],
    verseteTineriEntries: [],
    obsSceneName: null,
    sortOrder: 0,
    createdAt: 0,
    ...overrides,
  } as ScheduleItem
}

const verseteTineri = makeItem({
  id: 2,
  slideType: 'versete_tineri',
  slideContent: null,
  verseteTineriEntries: [
    {
      id: 1,
      personName: 'Ion Popescu',
      translationId: 1,
      bookCode: 'JHN',
      bookName: 'Ioan',
      reference: 'Ioan 3:16',
      text: 'Fiindca atat de mult a iubit Dumnezeu lumea...',
      startChapter: 3,
      startVerse: 16,
      endChapter: 3,
      endVerse: 16,
      sortOrder: 0,
    },
  ],
})

/**
 * The "what comes next" strip used to carry hardcoded Romanian labels, so an
 * English operator read Romanian type names. The labels now come from the
 * add-menu's own names, which is what these assertions pin.
 */
describe('getNextScheduleItemPreview labels', () => {
  const current = makeItem({ id: 1 })
  const items = [current, verseteTineri]

  it('names the Bible item the way the add menu does, in Romanian', async () => {
    await i18n.changeLanguage('ro')
    const preview = getNextScheduleItemPreview(items, current)
    expect(preview?.label).toBe('Versete Biblice')
    expect(preview?.preview).toBe('Ion Popescu (Ioan 3:16)')
  })

  it('follows the operator into English', async () => {
    await i18n.changeLanguage('en')
    expect(getNextScheduleItemPreview(items, current)?.label).toBe(
      'Bible Verses',
    )
  })

  it('translates announcements too', async () => {
    await i18n.changeLanguage('ro')
    const announcement = makeItem({ id: 3 })
    const preview = getNextScheduleItemPreview([current, announcement], current)
    expect(preview?.label).toBe('Anunț')
  })

  it('returns nothing when the current item is last', () => {
    expect(getNextScheduleItemPreview(items, verseteTineri)).toBeUndefined()
  })
})
