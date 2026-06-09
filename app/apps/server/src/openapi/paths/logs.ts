export const logsPaths = {
  '/api/logs/open': {
    post: {
      tags: ['Logs'],
      summary: 'Open the logs folder in the OS file manager',
      description:
        "Reveals the application logs folder in the user's native file manager (Finder on macOS, Explorer on Windows, xdg-open on Linux). Localhost only — opening windows on a non-host machine makes no sense.",
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
  '/api/client-errors': {
    post: {
      tags: ['Logs'],
      summary: 'Ingest client-side errors into the local log + PostHog',
      description:
        "Accepts a batch of browser/client errors and writes them to the same on-disk log (`server-YYYY-MM-DD.log`, category `client`) the user can attach to a bug report — the webview can't write to disk itself. Also emits a lightweight `client_error` event to PostHog as redundancy (the browser SDK already sends `$exception`, but it may be blocked/offline and is disabled on /screen/* routes). Public and pre-auth on purpose, since client errors can occur before login. At most 50 errors per request; messages/stacks are truncated.",
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['errors'],
              properties: {
                errors: {
                  type: 'array',
                  maxItems: 50,
                  items: {
                    type: 'object',
                    required: ['message'],
                    properties: {
                      message: { type: 'string' },
                      stack: { type: 'string' },
                      level: { type: 'string', enum: ['error', 'warning'] },
                      source: {
                        type: 'string',
                        description:
                          'Where the error came from (e.g. error-boundary, window.onerror, feature:bible)',
                      },
                      context: {
                        type: 'object',
                        additionalProperties: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Errors recorded',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: { received: { type: 'integer' } },
                  },
                },
              },
            },
          },
        },
        '400': {
          description: 'Invalid client error body',
        },
      },
    },
  },
  '/api/client-activity': {
    post: {
      tags: ['Logs'],
      summary: 'Ingest client-side user activity into the local log',
      description:
        'Accepts a batch of user activity events (navigation, login/logout, key actions) and writes them to the on-disk log under the `activity` category, so the Logs viewer shows what the operator did. Public and pre-auth on purpose. At most 100 events per request; fields are truncated.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['events'],
              properties: {
                events: {
                  type: 'array',
                  maxItems: 100,
                  items: {
                    type: 'object',
                    properties: {
                      action: { type: 'string' },
                      message: { type: 'string' },
                      source: { type: 'string' },
                      context: { type: 'object', additionalProperties: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Activity recorded',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: { received: { type: 'integer' } },
                  },
                },
              },
            },
          },
        },
        '400': { description: 'Invalid activity body' },
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
  '/api/logs/content': {
    get: {
      tags: ['Logs'],
      summary: 'Read recent application logs',
      description:
        'Returns the tail of the recent server and Tauri log files for the in-app Logs viewer. Requires the `logs.view` permission.',
      parameters: [
        {
          name: 'days',
          in: 'query',
          required: false,
          schema: { type: 'integer', minimum: 1, maximum: 14, default: 3 },
          description: 'How many days back to include (clamped to 1–14).',
        },
        {
          name: 'maxBytes',
          in: 'query',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 1048576,
            default: 262144,
          },
          description:
            'Maximum bytes read per file per day (clamped to ≤ 1 MiB).',
        },
      ],
      responses: {
        '200': {
          description: 'Recent log tails',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      serverTail: { type: 'string' },
                      tauriTail: { type: 'string' },
                      logsDir: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        '403': { description: 'Missing logs.view permission' },
      },
    },
  },
  '/api/logs/clear': {
    post: {
      tags: ['Logs'],
      summary: 'Clear application logs',
      description:
        'Empties every local `.log` file (server + Tauri daily logs). Requires the `logs.clear` permission.',
      responses: {
        '200': {
          description: 'Logs cleared',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      cleared: {
                        type: 'integer',
                        description: 'Number of log files emptied',
                      },
                      logsDir: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        '403': { description: 'Missing logs.clear permission' },
      },
    },
  },
}
