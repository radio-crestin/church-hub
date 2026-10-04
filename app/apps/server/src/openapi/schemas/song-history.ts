export const songHistorySchemas = {
  SongHistorySlide: {
    type: 'object',
    properties: {
      content: { type: 'string' },
      sortOrder: { type: 'integer' },
      label: { type: 'string', nullable: true },
      notes: { type: 'string', nullable: true },
      chords: { type: 'array', nullable: true, items: { type: 'object' } },
      styleOverrides: { type: 'object', nullable: true },
    },
  },
  SongSnapshot: {
    type: 'object',
    description: 'A song as it was at one point: its title and its slides',
    properties: {
      title: { type: 'string' },
      slides: {
        type: 'array',
        items: { $ref: '#/components/schemas/SongHistorySlide' },
      },
    },
  },
  SongHistoryChanges: {
    type: 'object',
    properties: {
      titleChanged: { type: 'boolean' },
      slidesAdded: { type: 'integer' },
      slidesRemoved: { type: 'integer' },
      slidesChanged: { type: 'integer' },
    },
  },
  SongHistoryEntrySummary: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      songId: { type: 'integer' },
      kind: { type: 'string', enum: ['created', 'edited', 'restored'] },
      editedByUserId: { type: 'integer', nullable: true },
      editedByName: {
        type: 'string',
        description:
          'Name of who saved the change ("System" for the system token)',
      },
      restoredFromId: {
        type: 'integer',
        nullable: true,
        description: 'For restores: the history entry that was put back',
      },
      createdAt: { type: 'integer', description: 'Unix timestamp' },
      titleBefore: { type: 'string', nullable: true },
      titleAfter: { type: 'string' },
      changes: { $ref: '#/components/schemas/SongHistoryChanges' },
    },
  },
  SongHistoryEntry: {
    allOf: [
      { $ref: '#/components/schemas/SongHistoryEntrySummary' },
      {
        type: 'object',
        properties: {
          before: {
            nullable: true,
            $ref: '#/components/schemas/SongSnapshot',
          },
          after: { $ref: '#/components/schemas/SongSnapshot' },
        },
      },
    ],
  },
}
