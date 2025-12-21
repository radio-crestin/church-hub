export const presentationSchemas = {
  PresentationState: {
    type: 'object',
    properties: {
      currentQueueItemId: { type: 'integer', nullable: true },
      currentSongSlideId: { type: 'integer', nullable: true },
      lastSongSlideId: { type: 'integer', nullable: true },
      isPresenting: { type: 'boolean' },
      isHidden: { type: 'boolean' },
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
}
