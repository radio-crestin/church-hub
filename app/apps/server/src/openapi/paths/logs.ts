export const logsPaths = {
  '/api/logs/open': {
    post: {
      tags: ['Logs'],
      summary: 'Open the logs folder in the OS file manager',
      description:
        'Reveals the application logs folder in the user\'s native file manager (Finder on macOS, Explorer on Windows, xdg-open on Linux). Localhost only — opening windows on a non-host machine makes no sense.',
      responses: {
        '200': {
          description: 'Folder open command dispatched',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      path: {
                        type: 'string',
                        description:
                          'Absolute path of the logs folder that was opened',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '403': {
          description: 'Not accessible from this origin',
        },
      },
    },
  },
  '/api/logs/path': {
    get: {
      tags: ['Logs'],
      summary: 'Get the logs folder path',
      description:
        'Returns the absolute path to the application logs folder. Useful for displaying it in the UI or for manual access.',
      responses: {
        '200': {
          description: 'Logs folder path',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      path: { type: 'string' },
                    },
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
