export const liveTranslationPaths = {
  '/api/live-translation/stream-secret': {
    get: {
      tags: ['Live Translation'],
      summary: 'Get the listener link’s room id',
      description:
        'The id in the listener link (https://churchub-backend.radiocrestin.ro/listen/<secret>): a hosted room\'s id ("h1" + 43 characters). The host key it comes from stays on the server.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': {
          description: 'The room id, and whether to show the one-time notice',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  secret: { type: 'string', pattern: '^h1[A-Za-z0-9_-]{43}$' },
                  linkChanged: {
                    type: 'boolean',
                    description:
                      'The listener link of an earlier version stopped with the update; the dashboard says so until dismissed',
                  },
                },
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
      summary: 'Make a new listener link',
      description:
        'A new host key and room id; the link shared before stops and connected listeners are disconnected.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': {
          description: 'The new room id',
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
  '/api/live-translation/link-changed': {
    delete: {
      tags: ['Live Translation'],
      summary: 'Dismiss the "listener link changed" notice',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': {
          description: 'Dismissed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { success: { type: 'boolean' } },
              },
            },
          },
        },
      },
    },
  },
}
