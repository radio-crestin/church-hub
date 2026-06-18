const successResponse = {
  '200': {
    description: 'Success',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: { success: { type: 'boolean', example: true } },
        },
      },
    },
  },
}

export const liveTranslationPaths = {
  '/api/live-translation/state': {
    get: {
      tags: ['Live Translation'],
      summary: 'Get the current live-translation state',
      responses: {
        '200': {
          description: 'Current translation state',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LiveTranslationState' },
            },
          },
        },
      },
    },
  },
  '/api/live-translation/start': {
    post: {
      tags: ['Live Translation'],
      summary: 'Start a live-translation session',
      description:
        'Starts capturing the microphone and translating it into each target language with the Gemini 3.5 Live Translate model. Unset fields fall back to the persisted settings.',
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/LiveTranslationSettings' },
          },
        },
      },
      responses: {
        ...successResponse,
        '400': { $ref: '#/components/responses/BadRequest' },
      },
    },
  },
  '/api/live-translation/stop': {
    post: {
      tags: ['Live Translation'],
      summary: 'Stop the live-translation session',
      responses: successResponse,
    },
  },
  '/api/live-translation/clear': {
    post: {
      tags: ['Live Translation'],
      summary: 'Clear the current transcription history',
      responses: successResponse,
    },
  },
  '/api/live-translation/devices': {
    get: {
      tags: ['Live Translation'],
      summary: 'List available audio input/output devices',
      responses: {
        '200': {
          description: 'Audio devices and the system defaults',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  devices: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/AudioDevice' },
                  },
                  defaultInputId: { type: 'integer' },
                  defaultOutputId: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
  },
  '/api/live-translation/settings': {
    get: {
      tags: ['Live Translation'],
      summary: 'Get the persisted live-translation settings',
      responses: {
        '200': {
          description: 'Persisted settings',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LiveTranslationSettings' },
            },
          },
        },
      },
    },
    put: {
      tags: ['Live Translation'],
      summary: 'Save the live-translation settings',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/LiveTranslationSettings' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Saved settings',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  settings: {
                    $ref: '#/components/schemas/LiveTranslationSettings',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  '/api/live-translation/stream-secret': {
    get: {
      tags: ['Live Translation'],
      summary: 'Get the current listener-stream secret',
      responses: {
        '200': {
          description: 'Stream secret',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { secret: { type: 'string' } },
              },
            },
          },
        },
      },
    },
  },
  '/api/live-translation/stream-secret/reset': {
    post: {
      tags: ['Live Translation'],
      summary: 'Reset the listener-stream secret (invalidates the old link)',
      responses: {
        '200': {
          description: 'New stream secret',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { secret: { type: 'string' } },
              },
            },
          },
        },
      },
    },
  },
  '/api/live-translation/stream-info': {
    get: {
      tags: ['Live Translation'],
      summary: 'Get listener counts for the active stream',
      responses: {
        '200': {
          description: 'Listener counts',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  listeners: { type: 'integer' },
                  countsByTarget: {
                    type: 'object',
                    additionalProperties: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
}
