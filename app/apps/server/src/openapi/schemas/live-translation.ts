export const liveTranslationSchemas = {
  TranslationTarget: {
    type: 'object',
    description: 'A single target language for the translation session',
    properties: {
      id: { type: 'string', description: 'Stable target identifier' },
      targetLanguage: {
        type: 'string',
        description: 'Target language code (e.g. en, de, pt)',
        example: 'en',
      },
    },
    required: ['id', 'targetLanguage'],
  },
  TranscriptionEntry: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      text: { type: 'string' },
      type: { type: 'string', enum: ['source', 'translation'] },
      targetId: { type: 'string' },
      targetLanguage: { type: 'string' },
      timestamp: { type: 'number' },
    },
    required: ['id', 'text', 'type', 'timestamp'],
  },
  TargetState: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      targetLanguage: { type: 'string' },
      outputAudioLevel: { type: 'number' },
      listenerCount: { type: 'integer' },
    },
  },
  LiveTranslationState: {
    type: 'object',
    description: 'Current state of the live-translation session',
    properties: {
      isActive: { type: 'boolean' },
      sourceLanguage: { type: 'string', example: 'ro' },
      inputAudioLevel: { type: 'number' },
      outputAudioLevel: { type: 'number' },
      transcription: {
        type: 'array',
        items: { $ref: '#/components/schemas/TranscriptionEntry' },
      },
      targets: {
        type: 'array',
        items: { $ref: '#/components/schemas/TargetState' },
      },
      primaryTargetId: { type: 'string' },
      error: { type: 'string' },
      startedAt: { type: 'number', nullable: true },
    },
  },
  LiveTranslationSettings: {
    type: 'object',
    description:
      'Persisted live-translation settings. Translation runs on the Gemini 3.5 Live Translate model.',
    properties: {
      sourceLanguage: { type: 'string', example: 'ro' },
      targets: {
        type: 'array',
        items: { $ref: '#/components/schemas/TranslationTarget' },
      },
      primaryTargetId: {
        type: 'string',
        description:
          'Target whose translated audio is played on the local speaker',
      },
      geminiApiKey: {
        type: 'string',
        description: 'Google Gemini API key (stored on the server)',
      },
      inputDeviceId: { type: 'integer', nullable: true },
      outputDeviceId: { type: 'integer', nullable: true },
      outputMode: {
        type: 'string',
        enum: ['device', 'webrtc', 'both'],
        description:
          'Where translated audio is played locally (listeners always receive their language via the shared link)',
      },
    },
  },
  AudioDevice: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      inputChannels: { type: 'integer' },
      outputChannels: { type: 'integer' },
      isDefaultInput: { type: 'boolean' },
      isDefaultOutput: { type: 'boolean' },
      sampleRates: { type: 'array', items: { type: 'integer' } },
    },
  },
}
