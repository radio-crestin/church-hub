export const presentationSchemas = {
  PresentationState: {
    type: 'object',
    properties: {
      currentSongSlideId: { type: 'integer', nullable: true },
      lastSongSlideId: { type: 'integer', nullable: true },
      isPresenting: { type: 'boolean' },
      isHidden: { type: 'boolean' },
      temporaryContent: {
        $ref: '#/components/schemas/TemporaryContent',
        nullable: true,
      },
      updatedAt: { type: 'integer', description: 'Unix timestamp' },
    },
  },
  VerseLoopTimer: {
    type: 'object',
    description:
      "A playing verse slideshow's timer: the verse it times and how long it has left. Also sent over the WebSocket as `verse_loop_timer` (null when it stops).",
    properties: {
      slideshow: {
        type: 'string',
        nullable: true,
        description: 'The list that started it, e.g. `bookmarks`, `topic:12`',
      },
      entryIndex: { type: 'integer' },
      durationMs: {
        type: 'number',
        description: "The verse's whole reading time at the current speed",
      },
      remainingMs: {
        type: 'number',
        description: 'Time left before the next verse goes up, as of sending',
      },
    },
    required: ['slideshow', 'entryIndex', 'durationMs', 'remainingMs'],
  },
  UpdatePresentationStateInput: {
    type: 'object',
    properties: {
      currentSongSlideId: { type: 'integer', nullable: true },
      lastSongSlideId: { type: 'integer', nullable: true },
      isPresenting: { type: 'boolean' },
      isHidden: { type: 'boolean' },
    },
  },
  TemporaryContent: {
    type: 'object',
    properties: {
      presentationBackground: {
        type: 'object',
        nullable: true,
        description:
          "The looping video behind a presentation's step, from a video item set as the background of the steps after it",
        properties: { url: { type: 'string' } },
      },
    },
    oneOf: [
      {
        type: 'object',
        required: ['type', 'data'],
        properties: {
          type: { type: 'string', enum: ['bible'] },
          data: { $ref: '#/components/schemas/TemporaryBibleContent' },
        },
      },
      {
        type: 'object',
        required: ['type', 'data'],
        properties: {
          type: { type: 'string', enum: ['song'] },
          data: { $ref: '#/components/schemas/TemporarySongContent' },
        },
      },
      {
        type: 'object',
        required: ['type', 'data'],
        properties: {
          type: { type: 'string', enum: ['deck_slide'] },
          data: { $ref: '#/components/schemas/TemporaryDeckSlideContent' },
        },
      },
    ],
  },
  TemporaryBibleContent: {
    type: 'object',
    required: [
      'verseId',
      'reference',
      'text',
      'translationAbbreviation',
      'bookName',
      'translationId',
      'bookId',
      'bookCode',
      'chapter',
      'currentVerseIndex',
    ],
    properties: {
      verseId: { type: 'integer' },
      reference: { type: 'string', description: 'e.g. "Genesis 1:1"' },
      text: { type: 'string', description: 'Primary verse text' },
      translationAbbreviation: { type: 'string', description: 'e.g. "KJV"' },
      bookName: { type: 'string', description: 'Primary book name' },
      translationId: { type: 'integer' },
      bookId: { type: 'integer' },
      bookCode: { type: 'string', description: 'e.g. "GEN"' },
      chapter: { type: 'integer' },
      currentVerseIndex: {
        type: 'integer',
        description: '0-based index in chapter',
      },
      secondaryText: {
        type: 'string',
        description: 'Secondary version verse text',
        nullable: true,
      },
      secondaryBookName: {
        type: 'string',
        description: 'Secondary version book name',
        nullable: true,
      },
      secondaryTranslationAbbreviation: {
        type: 'string',
        description: 'Secondary version abbreviation',
        nullable: true,
      },
    },
  },
  TemporarySongContent: {
    type: 'object',
    required: ['songId', 'title', 'slides', 'currentSlideIndex'],
    properties: {
      songId: { type: 'integer' },
      title: { type: 'string' },
      displayTitle: {
        type: 'string',
        description:
          'The title without its leading number ("019 - La masa Ta" → "La masa Ta"), as the projector\'s corner shows it.',
      },
      titleNumber: {
        type: 'string',
        description:
          'The songbook\'s initials and the song\'s number ("PDC 19"), from the title, the hymn number or the source file name; absent when the song has none. A screen shows it before the title when its song-title element has showNumber on.',
      },
      background: {
        oneOf: [
          { $ref: '#/components/schemas/ScreenBackgroundConfig' },
          { type: 'null' },
        ],
        description:
          "The song's own background, shown instead of the screen's background while it is live; null/absent = use the screen's background. Refreshed when the song is saved while presented.",
      },
      slides: {
        type: 'array',
        items: { $ref: '#/components/schemas/TemporarySongSlide' },
      },
      currentSlideIndex: { type: 'integer', description: '0-based index' },
    },
  },
  TemporarySongSlide: {
    type: 'object',
    required: ['id', 'content', 'sortOrder'],
    properties: {
      id: { type: 'integer' },
      content: { type: 'string' },
      sortOrder: { type: 'integer' },
    },
  },
  VerseteTineriEntry: {
    type: 'object',
    required: [
      'id',
      'personName',
      'reference',
      'bookCode',
      'bookName',
      'startChapter',
      'startVerse',
      'endChapter',
      'endVerse',
      'text',
      'sortOrder',
    ],
    description: 'One reading shown on a "Versete Biblice" slide',
    properties: {
      id: { type: 'integer' },
      personName: {
        type: 'string',
        description: 'Who reads it (may be empty)',
      },
      reference: { type: 'string' },
      bookCode: { type: 'string' },
      bookName: { type: 'string' },
      startChapter: { type: 'integer' },
      startVerse: { type: 'integer' },
      endChapter: { type: 'integer' },
      endVerse: { type: 'integer' },
      text: { type: 'string' },
      sortOrder: { type: 'integer' },
    },
  },
  PresentTemporaryVerseteTineriInput: {
    type: 'object',
    required: ['entries'],
    properties: {
      entries: {
        type: 'array',
        items: { $ref: '#/components/schemas/VerseteTineriEntry' },
      },
      currentEntryIndex: {
        type: 'integer',
        description: 'Entry to start from (0-based, default 0)',
      },
      loop: {
        type: 'boolean',
        description:
          'Play the entries in a loop: each stays up for its reading time (its words at the bible_reading_speed app setting, words per minute, default 160; at least 3 s), then the next shows, and the last wraps to the first. Hiding or presenting anything else stops it.',
      },
      autoAdvance: {
        type: 'boolean',
        description:
          'Advance by itself after the reading time of each entry, as loop does, but stop on the last entry instead of wrapping (the Bible topics slideshow).',
      },
      slideshow: {
        type: 'string',
        description:
          'The list that started the slideshow, so its panel shows it as playing: `bookmarks` or `topic:<id>`.',
      },
      scheduleId: {
        type: 'integer',
        description:
          'Program the slide belongs to (unset for a bookmark slideshow)',
      },
      scheduleItemIndex: { type: 'integer' },
    },
  },
  PresentTemporaryBibleInput: {
    type: 'object',
    required: [
      'verseId',
      'reference',
      'text',
      'translationAbbreviation',
      'bookName',
      'translationId',
      'bookId',
      'bookCode',
      'chapter',
      'currentVerseIndex',
    ],
    properties: {
      verseId: { type: 'integer' },
      reference: { type: 'string' },
      text: { type: 'string' },
      translationAbbreviation: { type: 'string' },
      bookName: { type: 'string' },
      translationId: { type: 'integer' },
      bookId: { type: 'integer' },
      bookCode: { type: 'string' },
      chapter: { type: 'integer' },
      currentVerseIndex: { type: 'integer' },
      secondaryText: { type: 'string', nullable: true },
      secondaryBookName: { type: 'string', nullable: true },
      secondaryTranslationAbbreviation: { type: 'string', nullable: true },
    },
  },
  PresentTemporarySongInput: {
    type: 'object',
    required: ['songId'],
    properties: {
      songId: { type: 'integer' },
      slideIndex: {
        type: 'integer',
        description: 'Optional: start from specific slide (0-based)',
        nullable: true,
      },
    },
  },
  NavigateTemporaryInput: {
    type: 'object',
    required: ['direction', 'requestTimestamp'],
    properties: {
      direction: { type: 'string', enum: ['next', 'prev'] },
      requestTimestamp: { type: 'integer' },
    },
  },
  TextStyleRange: {
    type: 'object',
    description:
      'One run of styling over the slide text, as character offsets into it',
    required: ['id', 'start', 'end'],
    properties: {
      id: { type: 'string', description: 'Client-generated UUID' },
      start: { type: 'integer', description: 'Character offset, inclusive' },
      end: { type: 'integer', description: 'Character offset, exclusive' },
      highlight: { type: 'string', example: '#FFFF00' },
      bold: { type: 'boolean' },
      italic: { type: 'boolean' },
      underline: { type: 'boolean' },
      fontScale: { type: 'number' },
    },
  },
}
