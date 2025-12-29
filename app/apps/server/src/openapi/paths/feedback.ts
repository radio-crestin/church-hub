export const feedbackPaths = {
  '/api/feedback': {
    post: {
      tags: ['Feedback'],
      summary: 'Submit user feedback',
      description:
        'Submits user feedback which creates a GitHub issue in the radio-crestin/church-hub repository',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['message', 'osVersion', 'appVersion'],
              properties: {
                message: {
                  type: 'string',
                  description: 'The feedback message from the user',
                  minLength: 1,
                },
                osVersion: {
                  type: 'string',
                  description: 'Operating system version information',
                },
                appVersion: {
                  type: 'string',
                  description: 'Application version',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Feedback submitted successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: true,
                  },
                  issueUrl: {
                    type: 'string',
                    description: 'URL to the created GitHub issue',
                    example:
                      'https://github.com/radio-crestin/church-hub/issues/123',
                  },
                  issueNumber: {
                    type: 'integer',
                    description: 'The GitHub issue number',
                    example: 123,
                  },
                },
              },
            },
          },
        },
        '400': {
          description: 'Invalid request - missing required fields',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: false,
                  },
                  error: {
                    type: 'string',
                    example: 'Message is required',
                  },
                },
              },
            },
          },
        },
        '500': {
          description: 'Failed to submit feedback',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: false,
                  },
                  error: {
                    type: 'string',
                    example: 'Failed to submit feedback',
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
