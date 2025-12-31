export const presentationSchemas = {
  PresentationState: {
    type: 'object',
    properties: {
      currentQueueItemId: { type: 'integer', nullable: true },
      currentSongSlideId: { type: 'integer', nullable: true },
      lastSongSlideId: { type: 'integer', nullable: true },
      currentBiblePassageVerseId: { type: 'integer', nullable: true },
      currentVerseteTineriEntryId: { type: 'integer', nullable: true },
      isPresenting: { type: 'boolean' },
      isHidden: { type: 'boolean' },
      temporaryContent: {
        $ref: '#/components/schemas/TemporaryContent',
        nullable: true,
      },
      updatedAt: { type: 'integer', description: 'Unix timestamp' },
    },
  },
  UpdatePresentationStateInput: {
    type: 'object',
    properties: {
      currentQueueItemId: { type: 'integer', nullable: true },
      currentSongSlideId: { type: 'integer', nullable: true },
      lastSongSlideId: { type: 'integer', nullable: true },
      isPresenting: { type: 'boolean' },
      isHidden: { type: 'boolean' },
    },
  },
  TemporaryContent: {
    type: 'object',
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
}
