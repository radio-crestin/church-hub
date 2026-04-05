import { describe, expect, it } from 'vitest'

import { calculateNextSlideData } from '../calculateNextSlide'

// Minimal types matching the expected shapes used by calculateNextSlide

interface QueueItem {
  id: number
  itemType: 'song' | 'bible' | 'bible_passage' | 'slide'
  slideType?: 'announcement' | 'versete_tineri'
  slides?: Array<{ id: number; content: string; sortOrder: number }>
  bibleReference?: string | null
  bibleText?: string | null
  biblePassageVerses?: Array<{
    id: number
    reference: string
    text: string
  }>
  slideContent?: string | null
  verseteTineriEntries?: Array<{
    id: number
    personName: string
    reference: string
  }>
}

interface PresentationState {
  currentQueueItemId: number | null
  currentSongSlideId: number | null
  currentBiblePassageVerseId: number | null
  currentVerseteTineriEntryId: number | null
}

function makePresentationState(
  overrides: Partial<PresentationState> = {},
): PresentationState {
  return {
    currentQueueItemId: null,
    currentSongSlideId: null,
    currentBiblePassageVerseId: null,
    currentVerseteTineriEntryId: null,
    ...overrides,
  }
}

describe('calculateNextSlideData', () => {
  // ==========================================================================
  // Edge cases
  // ==========================================================================

  it('returns undefined when currentQueueItemId is null', () => {
    const result = calculateNextSlideData({
      queueItems: [
        { id: 1, itemType: 'song', slides: [] },
      ] as QueueItem[] as never,
      presentationState: makePresentationState() as never,
    })
    expect(result).toBeUndefined()
  })

  it('returns undefined when queueItems is empty', () => {
    const result = calculateNextSlideData({
      queueItems: [] as never,
      presentationState: makePresentationState({
        currentQueueItemId: 1,
      }) as never,
    })
    expect(result).toBeUndefined()
  })

  it('returns undefined when currentQueueItemId not found in queue', () => {
    const result = calculateNextSlideData({
      queueItems: [
        { id: 1, itemType: 'song', slides: [] },
      ] as QueueItem[] as never,
      presentationState: makePresentationState({
        currentQueueItemId: 999,
      }) as never,
    })
    expect(result).toBeUndefined()
  })

  // ==========================================================================
  // Song content type
  // ==========================================================================

  describe('song navigation', () => {
    const songItem: QueueItem = {
      id: 1,
      itemType: 'song',
      slides: [
        { id: 10, content: '<p>Verse 1</p>', sortOrder: 0 },
        { id: 11, content: '<p>Verse 2</p>', sortOrder: 1 },
        { id: 12, content: '<p>Chorus</p>', sortOrder: 2 },
      ],
    }

    it('returns next slide when not at end of song', () => {
      const result = calculateNextSlideData({
        queueItems: [songItem] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 1,
          currentSongSlideId: 10,
        }) as never,
      })
      expect(result).toBeDefined()
      expect(result!.contentType).toBe('song')
      expect(result!.preview).toBe('Verse 2')
    })

    it('returns next slide for middle slide', () => {
      const result = calculateNextSlideData({
        queueItems: [songItem] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 1,
          currentSongSlideId: 11,
        }) as never,
      })
      expect(result).toBeDefined()
      expect(result!.contentType).toBe('song')
      expect(result!.preview).toBe('Chorus')
    })

    it('returns next queue item preview when at end of song', () => {
      const bibleItem: QueueItem = {
        id: 2,
        itemType: 'bible',
        bibleReference: 'John 3:16 - RCCV',
        bibleText: 'For God so loved the world',
      }
      const result = calculateNextSlideData({
        queueItems: [songItem, bibleItem] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 1,
          currentSongSlideId: 12,
        }) as never,
      })
      expect(result).toBeDefined()
      expect(result!.contentType).toBe('bible')
      expect(result!.preview).toContain('John 3:16')
      // Translation abbreviation should be stripped
      expect(result!.preview).not.toContain('RCCV')
    })

    it('returns undefined when at end of song with no next queue item', () => {
      const result = calculateNextSlideData({
        queueItems: [songItem] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 1,
          currentSongSlideId: 12,
        }) as never,
      })
      expect(result).toBeUndefined()
    })

    it('strips HTML from song preview', () => {
      const result = calculateNextSlideData({
        queueItems: [songItem] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 1,
          currentSongSlideId: 10,
        }) as never,
      })
      expect(result!.preview).not.toContain('<p>')
      expect(result!.preview).not.toContain('</p>')
    })
  })

  // ==========================================================================
  // Bible passage content type
  // ==========================================================================

  describe('bible passage navigation', () => {
    const passageItem: QueueItem = {
      id: 2,
      itemType: 'bible_passage',
      biblePassageVerses: [
        { id: 20, reference: 'Genesis 1:1', text: 'In the beginning' },
        { id: 21, reference: 'Genesis 1:2', text: 'And the earth was void' },
        { id: 22, reference: 'Genesis 1:3', text: 'Let there be light' },
      ],
    }

    it('returns next verse when not at end', () => {
      const result = calculateNextSlideData({
        queueItems: [passageItem] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 2,
          currentBiblePassageVerseId: 20,
        }) as never,
      })
      expect(result).toBeDefined()
      expect(result!.contentType).toBe('bible_passage')
      expect(result!.preview).toContain('Genesis 1:2')
      expect(result!.preview).toContain('And the earth was void')
    })

    it('returns next queue item when at end of passage', () => {
      const nextItem: QueueItem = {
        id: 3,
        itemType: 'slide',
        slideType: 'announcement',
        slideContent: '<p>Welcome everyone!</p>',
      }
      const result = calculateNextSlideData({
        queueItems: [passageItem, nextItem] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 2,
          currentBiblePassageVerseId: 22,
        }) as never,
      })
      expect(result).toBeDefined()
      expect(result!.contentType).toBe('announcement')
      expect(result!.preview).toContain('Welcome everyone!')
    })

    it('returns next Bible verse when at end with no next queue item', () => {
      const result = calculateNextSlideData({
        queueItems: [passageItem] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 2,
          currentBiblePassageVerseId: 22,
        }) as never,
        nextBibleVerse: {
          id: 100,
          translationId: 1,
          bookId: 1,
          bookCode: 'GEN',
          bookName: 'Genesis',
          chapter: 1,
          verse: 4,
          text: 'And God saw that the light was good',
        } as never,
      })
      expect(result).toBeDefined()
      expect(result!.contentType).toBe('bible')
      expect(result!.preview).toContain('Genesis 1:4')
    })

    it('returns undefined at end of passage with no next item or verse', () => {
      const result = calculateNextSlideData({
        queueItems: [passageItem] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 2,
          currentBiblePassageVerseId: 22,
        }) as never,
      })
      expect(result).toBeUndefined()
    })

    it('uses first verse when currentBiblePassageVerseId is null', () => {
      const result = calculateNextSlideData({
        queueItems: [passageItem] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 2,
          currentBiblePassageVerseId: null,
        }) as never,
      })
      // Should start from first verse (id=20) and show next (id=21)
      expect(result).toBeDefined()
      expect(result!.preview).toContain('Genesis 1:2')
    })
  })

  // ==========================================================================
  // Versete Tineri content type
  // ==========================================================================

  describe('versete tineri navigation', () => {
    const vtItem: QueueItem = {
      id: 3,
      itemType: 'slide',
      slideType: 'versete_tineri',
      verseteTineriEntries: [
        { id: 30, personName: 'Maria', reference: 'Psalm 23:1' },
        { id: 31, personName: 'Ion', reference: 'Romans 8:28' },
        { id: 32, personName: 'Ana', reference: 'John 14:6' },
      ],
    }

    it('returns next entry preview when not at end', () => {
      const result = calculateNextSlideData({
        queueItems: [vtItem] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 3,
          currentVerseteTineriEntryId: 30,
        }) as never,
      })
      expect(result).toBeDefined()
      expect(result!.contentType).toBe('versete_tineri')
      expect(result!.preview).toContain('Ion')
      expect(result!.preview).toContain('Romans 8:28')
    })

    it('returns next queue item at end of versete tineri', () => {
      const nextSong: QueueItem = {
        id: 4,
        itemType: 'song',
        slides: [{ id: 40, content: '<p>Next song verse</p>', sortOrder: 0 }],
      }
      const result = calculateNextSlideData({
        queueItems: [vtItem, nextSong] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 3,
          currentVerseteTineriEntryId: 32,
        }) as never,
      })
      expect(result).toBeDefined()
      expect(result!.contentType).toBe('song')
      expect(result!.preview).toContain('Next song verse')
    })

    it('returns undefined at end with no next queue item', () => {
      const result = calculateNextSlideData({
        queueItems: [vtItem] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 3,
          currentVerseteTineriEntryId: 32,
        }) as never,
      })
      expect(result).toBeUndefined()
    })
  })

  // ==========================================================================
  // Single Bible verse content type
  // ==========================================================================

  describe('single bible verse navigation', () => {
    const bibleItem: QueueItem = {
      id: 5,
      itemType: 'bible',
      bibleReference: 'John 3:16 - RCCV',
      bibleText: 'For God so loved the world',
    }

    it('returns next queue item when available', () => {
      const nextAnnouncement: QueueItem = {
        id: 6,
        itemType: 'slide',
        slideType: 'announcement',
        slideContent: 'Next week event',
      }
      const result = calculateNextSlideData({
        queueItems: [bibleItem, nextAnnouncement] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 5,
        }) as never,
      })
      expect(result).toBeDefined()
      expect(result!.contentType).toBe('announcement')
    })

    it('returns next Bible verse when no next queue item', () => {
      const result = calculateNextSlideData({
        queueItems: [bibleItem] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 5,
        }) as never,
        nextBibleVerse: {
          id: 200,
          translationId: 1,
          bookId: 43,
          bookCode: 'JHN',
          bookName: 'John',
          chapter: 3,
          verse: 17,
          text: 'For God did not send his Son',
        } as never,
      })
      expect(result).toBeDefined()
      expect(result!.contentType).toBe('bible')
      expect(result!.preview).toContain('John 3:17')
    })

    it('returns undefined with no next item and no next verse', () => {
      const result = calculateNextSlideData({
        queueItems: [bibleItem] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 5,
        }) as never,
      })
      expect(result).toBeUndefined()
    })
  })

  // ==========================================================================
  // Announcement content type
  // ==========================================================================

  describe('announcement navigation', () => {
    const announcementItem: QueueItem = {
      id: 7,
      itemType: 'slide',
      slideType: 'announcement',
      slideContent: "<p>Today's announcement</p>",
    }

    it('returns next queue item', () => {
      const nextSong: QueueItem = {
        id: 8,
        itemType: 'song',
        slides: [{ id: 80, content: 'Song lyric', sortOrder: 0 }],
      }
      const result = calculateNextSlideData({
        queueItems: [announcementItem, nextSong] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 7,
        }) as never,
      })
      expect(result).toBeDefined()
      expect(result!.contentType).toBe('song')
    })

    it('returns undefined when no next queue item', () => {
      const result = calculateNextSlideData({
        queueItems: [announcementItem] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 7,
        }) as never,
      })
      expect(result).toBeUndefined()
    })
  })

  // ==========================================================================
  // Next queue item previews
  // ==========================================================================

  describe('next queue item preview formatting', () => {
    it('previews a song queue item (first slide)', () => {
      const currentItem: QueueItem = {
        id: 1,
        itemType: 'slide',
        slideType: 'announcement',
        slideContent: 'Current',
      }
      const songItem: QueueItem = {
        id: 2,
        itemType: 'song',
        slides: [
          { id: 20, content: '<b>Amazing Grace</b>', sortOrder: 0 },
          { id: 21, content: 'How sweet', sortOrder: 1 },
        ],
      }
      const result = calculateNextSlideData({
        queueItems: [currentItem, songItem] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 1,
        }) as never,
      })
      expect(result).toBeDefined()
      expect(result!.contentType).toBe('song')
      expect(result!.preview).toBe('Amazing Grace')
    })

    it('returns undefined for a song with no slides', () => {
      const currentItem: QueueItem = {
        id: 1,
        itemType: 'slide',
        slideType: 'announcement',
        slideContent: 'Current',
      }
      const songItem: QueueItem = {
        id: 2,
        itemType: 'song',
        slides: [],
      }
      const result = calculateNextSlideData({
        queueItems: [currentItem, songItem] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 1,
        }) as never,
      })
      expect(result).toBeUndefined()
    })

    it('previews a bible_passage queue item (first verse)', () => {
      const currentItem: QueueItem = {
        id: 1,
        itemType: 'slide',
        slideType: 'announcement',
        slideContent: 'Current',
      }
      const passageItem: QueueItem = {
        id: 2,
        itemType: 'bible_passage',
        biblePassageVerses: [
          { id: 20, reference: 'Psalm 1:1', text: 'Blessed is the man' },
        ],
      }
      const result = calculateNextSlideData({
        queueItems: [currentItem, passageItem] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 1,
        }) as never,
      })
      expect(result).toBeDefined()
      expect(result!.contentType).toBe('bible_passage')
      expect(result!.preview).toContain('Psalm 1:1')
    })

    it('previews a versete_tineri queue item with summary', () => {
      const currentItem: QueueItem = {
        id: 1,
        itemType: 'slide',
        slideType: 'announcement',
        slideContent: 'Current',
      }
      const vtItem: QueueItem = {
        id: 2,
        itemType: 'slide',
        slideType: 'versete_tineri',
        verseteTineriEntries: [
          { id: 30, personName: 'Maria', reference: 'Psalm 23:1' },
          { id: 31, personName: 'Ion', reference: 'Romans 8:28' },
        ],
      }
      const result = calculateNextSlideData({
        queueItems: [currentItem, vtItem] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 1,
        }) as never,
      })
      expect(result).toBeDefined()
      expect(result!.contentType).toBe('versete_tineri')
      expect(result!.preview).toContain('Maria')
      expect(result!.preview).toContain('Ion')
      expect(result!.verseteTineriSummary).toBeDefined()
      expect(result!.verseteTineriSummary!.entries).toHaveLength(2)
      expect(result!.verseteTineriSummary!.hasMore).toBe(false)
    })

    it('limits versete_tineri summary to 5 entries and sets hasMore', () => {
      const currentItem: QueueItem = {
        id: 1,
        itemType: 'slide',
        slideType: 'announcement',
        slideContent: 'Current',
      }
      const entries = Array.from({ length: 7 }, (_, i) => ({
        id: 30 + i,
        personName: `Person ${i + 1}`,
        reference: `Ref ${i + 1}`,
      }))
      const vtItem: QueueItem = {
        id: 2,
        itemType: 'slide',
        slideType: 'versete_tineri',
        verseteTineriEntries: entries,
      }
      const result = calculateNextSlideData({
        queueItems: [currentItem, vtItem] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 1,
        }) as never,
      })
      expect(result!.verseteTineriSummary!.entries).toHaveLength(5)
      expect(result!.verseteTineriSummary!.hasMore).toBe(true)
    })

    it('returns undefined for versete_tineri with no entries', () => {
      const currentItem: QueueItem = {
        id: 1,
        itemType: 'slide',
        slideType: 'announcement',
        slideContent: 'Current',
      }
      const vtItem: QueueItem = {
        id: 2,
        itemType: 'slide',
        slideType: 'versete_tineri',
        verseteTineriEntries: [],
      }
      const result = calculateNextSlideData({
        queueItems: [currentItem, vtItem] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 1,
        }) as never,
      })
      expect(result).toBeUndefined()
    })

    it('strips translation from Bible reference in preview', () => {
      const currentItem: QueueItem = {
        id: 1,
        itemType: 'slide',
        slideType: 'announcement',
        slideContent: 'Current',
      }
      const bibleItem: QueueItem = {
        id: 2,
        itemType: 'bible',
        bibleReference: 'Romans 12:1 - NTR',
        bibleText: 'Therefore I urge you',
      }
      const result = calculateNextSlideData({
        queueItems: [currentItem, bibleItem] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 1,
        }) as never,
      })
      expect(result!.preview).toContain('Romans 12:1')
      expect(result!.preview).not.toContain('NTR')
    })
  })

  // ==========================================================================
  // HTML stripping
  // ==========================================================================

  describe('HTML stripping in previews', () => {
    it('converts <br> tags to newlines', () => {
      const songItem: QueueItem = {
        id: 1,
        itemType: 'song',
        slides: [
          { id: 10, content: 'Line 1<br>Line 2', sortOrder: 0 },
          { id: 11, content: 'Next', sortOrder: 1 },
        ],
      }
      const result = calculateNextSlideData({
        queueItems: [songItem] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 1,
          currentSongSlideId: 10,
        }) as never,
      })
      expect(result!.preview).toBe('Next')
    })

    it('strips all HTML tags from content', () => {
      const announcementItem: QueueItem = {
        id: 1,
        itemType: 'slide',
        slideType: 'announcement',
        slideContent: 'Current',
      }
      const nextAnnouncement: QueueItem = {
        id: 2,
        itemType: 'slide',
        slideType: 'announcement',
        slideContent: '<div><p>Hello <strong>World</strong></p></div>',
      }
      const result = calculateNextSlideData({
        queueItems: [announcementItem, nextAnnouncement] as never,
        presentationState: makePresentationState({
          currentQueueItemId: 1,
        }) as never,
      })
      expect(result!.preview).not.toContain('<')
      expect(result!.preview).not.toContain('>')
      expect(result!.preview).toContain('Hello')
      expect(result!.preview).toContain('World')
    })
  })
})
