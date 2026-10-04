export const feedbackPaths = {
  '/api/feature-requests': {
    post: {
      tags: ['Feedback'],
      summary: 'Request a feature (creates a public GitHub issue)',
      description:
        'Relays an in-app "Request a feature" report to the Church Hub Cloudflare worker. The worker commits the screenshot to the `feature-request-screenshots` branch of the repo, opens a **public** GitHub issue in radio-crestin/church-hub that embeds it (title, notes, picked element, annotated screenshot, app context — never the email) and sends the maintainer a WhatsApp message that includes the email. Returns the created issue URL, which the app opens.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['title', 'notes', 'email', 'osVersion', 'appVersion'],
              properties: {
                title: { type: 'string', maxLength: 120 },
                notes: { type: 'string', maxLength: 5000 },
                email: {
                  type: 'string',
                  format: 'email',
                  description:
                    'Private: sent only to the maintainer over WhatsApp',
                },
                route: { type: 'string', example: '/songs' },
                viewport: { type: 'string', example: '1280x800' },
                osVersion: { type: 'string' },
                appVersion: { type: 'string' },
                element: {
                  type: 'object',
                  description: 'The element picked with the screenshot tool',
                  required: ['selector', 'path'],
                  properties: {
                    selector: {
                      type: 'string',
                      description: 'Unique CSS selector of the element',
                    },
                    path: {
                      type: 'string',
                      description:
                        'Readable DOM path with ids, test ids and classes',
                    },
                    label: { type: 'string' },
                  },
                },
                supportId: {
                  type: 'string',
                  description:
                    'PostHog distinct id the log tails are stored under (see /api/feedback/attach-logs). Private: WhatsApp only',
                },
                screenshot: {
                  type: 'string',
                  description:
                    'Annotated screenshot as a base64 data URL (image/jpeg, image/png or image/webp, max 5 MB)',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Issue created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  issueUrl: {
                    type: 'string',
                    example:
                      'https://github.com/radio-crestin/church-hub/issues/42',
                  },
                  issueNumber: { type: 'integer', example: 42 },
                  whatsAppSent: { type: 'boolean' },
                },
              },
            },
          },
        },
        '400': {
          description:
            'Invalid request (missing title, notes or email, bad screenshot)',
        },
        '401': { description: 'Not authenticated' },
        '413': { description: 'Screenshot too large' },
        '429': {
          description:
            'Too many requests from this network: 3 a minute or 50 in 24 hours (code `rate_limited`)',
        },
        '502': { description: 'The Church Hub backend could not be reached' },
      },
    },
  },
  '/api/feedback/attach-logs': {
    post: {
      tags: ['Feedback'],
      summary: "Attach server + Tauri logs to the user's support id in PostHog",
      description:
        "When the user sends a feature request, this endpoint uploads the most recent server and Tauri log tails to PostHog under the user's support id (PostHog distinct id, sent as ticketId). The same id goes privately to the maintainer with the request, so the logs can be found as a `$feedback_report` event keyed by it.",
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['ticketId'],
              properties: {
                ticketId: {
                  type: 'string',
                  description: "The user's support id (PostHog distinct id)",
                },
                osVersion: { type: 'string' },
                appVersion: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description:
            'Logs attached (best-effort; always returns 200 unless the request is malformed)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  ticketId: { type: 'string' },
                },
              },
            },
          },
        },
        '400': {
          description: 'Missing or invalid ticketId',
        },
      },
    },
  },
}
