export const scheduleSchemas = {
  ScheduleAutomationSettings: {
    type: 'object',
    description: 'How a presentation runs by itself',
    properties: {
      autoplaySeconds: {
        type: 'integer',
        nullable: true,
        minimum: 1,
        maximum: 3600,
        description: 'Seconds each step stays up while it runs; null = manual',
      },
      loop: {
        type: 'boolean',
        description: 'Past the last step, start again from the first',
      },
      musicVolume: {
        type: 'integer',
        nullable: true,
        minimum: 0,
        maximum: 100,
        description: 'Music player volume set when it starts; null = unchanged',
      },
      startOnAppStart: {
        type: 'boolean',
        description:
          'Started by itself when Church Hub starts. Setting it on one presentation turns it off on the others',
      },
    },
  },
  ScheduleAutomationState: {
    type: 'object',
    description:
      'What the presentation runner is doing. Also sent over the WebSocket as `schedule_automation`',
    required: ['running'],
    properties: {
      running: { type: 'boolean' },
      scheduleId: { type: 'integer' },
      title: { type: 'string' },
      stepIndex: {
        type: 'integer',
        description: 'Position of the step on screen in the running order',
      },
      stepCount: { type: 'integer' },
      autoplaySeconds: { type: 'integer' },
      loop: { type: 'boolean' },
      nextStepAt: {
        type: 'integer',
        description: 'When the next step goes up (epoch ms)',
      },
    },
  },
  Schedule: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      title: { type: 'string' },
      description: { type: 'string', nullable: true },
      automation: { $ref: '#/components/schemas/ScheduleAutomationSettings' },
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
      automation: {
        allOf: [{ $ref: '#/components/schemas/ScheduleAutomationSettings' }],
        description: 'Only the settings given change',
      },
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
