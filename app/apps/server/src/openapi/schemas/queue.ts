export const queueSchemas = {
  SlideTemplate: {
    type: 'string',
    enum: ['announcement', 'versete_tineri'],
    description: 'Type of standalone slide template',
  },
  QueueItemType: {
    type: 'string',
    enum: ['song', 'slide'],
    description: 'Type of queue item',
  },
  QueueItem: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
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
      isExpanded: { type: 'boolean' },
      createdAt: { type: 'integer', description: 'Unix timestamp' },
      updatedAt: { type: 'integer', description: 'Unix timestamp' },
    },
  },
  AddToQueueInput: {
    type: 'object',
    required: ['songId'],
    properties: {
      songId: { type: 'integer' },
      presentNow: {
        type: 'boolean',
        description: 'Whether to start presenting immediately',
      },
      afterItemId: {
        type: 'integer',
        description: 'Insert after this queue item ID',
      },
    },
  },
  InsertSlideInput: {
    type: 'object',
    required: ['slideType', 'slideContent'],
    properties: {
      slideType: { $ref: '#/components/schemas/SlideTemplate' },
      slideContent: { type: 'string' },
      afterItemId: {
        type: 'integer',
        description: 'Insert after this queue item ID',
      },
    },
  },
  UpdateSlideInput: {
    type: 'object',
    required: ['id', 'slideType', 'slideContent'],
    properties: {
      id: { type: 'integer' },
      slideType: { $ref: '#/components/schemas/SlideTemplate' },
      slideContent: { type: 'string' },
    },
  },
  ReorderQueueInput: {
    type: 'object',
    required: ['itemIds'],
    properties: {
      itemIds: {
        type: 'array',
        items: { type: 'integer' },
        description: 'Ordered array of queue item IDs',
      },
    },
  },
}
