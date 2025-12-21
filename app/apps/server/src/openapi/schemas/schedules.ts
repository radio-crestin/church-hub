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
        },
      },
      slides: {
        type: 'array',
        items: { $ref: '#/components/schemas/SongSlide' },
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
