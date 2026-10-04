export const scheduleSchemas = {
  Schedule: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      title: { type: 'string' },
      description: { type: 'string', nullable: true },
      itemCount: { type: 'integer' },
      songCount: { type: 'integer' },
      createdAt: { type: 'integer', description: 'Unix timestamp' },
      updatedAt: { type: 'integer', description: 'Unix timestamp' },
    },
  },
  ScheduleItem: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      scheduleId: { type: 'integer' },
      itemType: { $ref: '#/components/schemas/QueueItemType' },
      songId: { type: 'integer', nullable: true },
      song: {
        type: 'object',
        nullable: true,
        properties: {
          id: { type: 'integer' },
          title: { type: 'string' },
          categoryName: { type: 'string', nullable: true },
          tagNames: { type: 'array', items: { type: 'string' } },
        },
      },
      slides: {
        type: 'array',
        items: { $ref: '#/components/schemas/SongSlide' },
      },
      keyLine: { type: 'string', nullable: true },
      isSung: {
        type: 'boolean',
        description: 'Manual "already sung" marker, scoped to this schedule',
      },
      sungAt: {
        type: 'integer',
        nullable: true,
        description: 'Unix timestamp in ms when marked sung, null otherwise',
      },
      slideType: { $ref: '#/components/schemas/SlideTemplate' },
      slideContent: { type: 'string', nullable: true },
      sortOrder: { type: 'integer' },
      createdAt: { type: 'integer', description: 'Unix timestamp' },
      updatedAt: { type: 'integer', description: 'Unix timestamp' },
    },
  },
  ScheduleWithItems: {
    allOf: [
      { $ref: '#/components/schemas/Schedule' },
      {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/ScheduleItem' },
          },
        },
      },
    ],
  },
  ScheduleSearchResult: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      title: { type: 'string' },
      description: { type: 'string', nullable: true },
      itemCount: { type: 'integer' },
      matchedContent: { type: 'string' },
    },
  },
  UpsertScheduleInput: {
    type: 'object',
    required: ['title'],
    properties: {
      id: {
        type: 'integer',
        description: 'If provided, updates existing schedule',
      },
      title: { type: 'string' },
      description: { type: 'string', nullable: true },
    },
  },
  AddToScheduleInput: {
    type: 'object',
    required: ['scheduleId'],
    properties: {
      scheduleId: { type: 'integer' },
      songId: {
        type: 'integer',
        description: 'Add a song to the schedule',
      },
      slideType: { $ref: '#/components/schemas/SlideTemplate' },
      slideContent: {
        type: 'string',
        description: 'Content for standalone slide',
      },
      afterItemId: {
        type: 'integer',
        description: 'Insert after this item ID',
      },
    },
  },
  UpdateScheduleSlideInput: {
    type: 'object',
    required: ['id', 'slideType', 'slideContent'],
    properties: {
      id: { type: 'integer' },
      slideType: { $ref: '#/components/schemas/SlideTemplate' },
      slideContent: { type: 'string' },
    },
  },
  VerseSegment: {
    type: 'object',
    required: ['startVerse', 'endVerse'],
    description: 'A run of verses inside one chapter, both ends included',
    properties: {
      startVerse: { type: 'integer' },
      endVerse: { type: 'integer' },
    },
  },
  BibleReadingInput: {
    type: 'object',
    required: [
      'translationId',
      'bookCode',
      'bookName',
      'startChapter',
      'startVerse',
      'endChapter',
      'endVerse',
    ],
    description:
      'One reading of a "Versete Biblice" slide. For a comma verse list with a gap ("Ioan 3:16-18,20") send verseSegments; startVerse/endVerse are then the outer bounds.',
    properties: {
      personName: { type: 'string', description: 'Who reads it (optional)' },
      translationId: { type: 'integer' },
      bookCode: { type: 'string', example: 'JHN' },
      bookName: { type: 'string', example: 'Ioan' },
      startChapter: { type: 'integer', example: 3 },
      startVerse: { type: 'integer', example: 16 },
      endChapter: { type: 'integer', example: 3 },
      endVerse: { type: 'integer', example: 20 },
      verseSegments: {
        type: 'array',
        items: { $ref: '#/components/schemas/VerseSegment' },
        description:
          'Only inside startChapter. Example for 3:16-18,20: [{startVerse:16,endVerse:18},{startVerse:20,endVerse:20}]',
      },
    },
  },
  BiblePassageInput: {
    allOf: [
      { $ref: '#/components/schemas/BibleReadingInput' },
      {
        type: 'object',
        required: ['translationAbbreviation'],
        properties: { translationAbbreviation: { type: 'string' } },
      },
    ],
    description:
      'A passage picked from the Bible; stored as one "Versete Biblice" slide with no person',
  },
  ReorderScheduleItemsInput: {
    type: 'object',
    required: ['itemIds'],
    properties: {
      itemIds: {
        type: 'array',
        items: { type: 'integer' },
        description: 'Ordered array of schedule item IDs',
      },
    },
  },
}
