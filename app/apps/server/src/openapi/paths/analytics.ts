const analyticsConfigSchema = {
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      description: 'Whether anonymous usage data may be sent to PostHog',
    },
    installId: {
      type: 'string',
      format: 'uuid',
      description: 'Random id of this install, tied to nothing personal',
    },
  },
}

const analyticsResponse = {
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: { data: analyticsConfigSchema },
      },
    },
  },
}

export const analyticsPaths = {
  '/api/analytics': {
    get: {
      tags: ['Analytics'],
      summary: 'Whether anonymous usage data is shared (public)',
      description:
        'Public, so the client knows before any login whether to start PostHog. See docs/privacy-policy.md for what is collected.',
      security: [],
      responses: {
        '200': { description: 'The current choice', ...analyticsResponse },
      },
    },
    put: {
      tags: ['Analytics'],
      summary: 'Turn anonymous usage data on or off',
      description:
        'When off, neither the server nor the clients send events, errors or session replays to PostHog.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['enabled'],
              properties: { enabled: { type: 'boolean' } },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Saved', ...analyticsResponse },
        '400': { description: '`enabled` is not a boolean' },
        '401': { description: 'Not authenticated' },
        '403': { description: 'Needs settings.edit' },
      },
    },
  },
}
