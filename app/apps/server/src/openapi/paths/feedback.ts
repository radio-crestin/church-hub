export const feedbackPaths = {
  '/api/feature-requests': {
    post: {
      tags: ['Feedback'],
      summary: 'Request a feature (creates a public GitHub issue)',
      description:
        'Relays an in-app "Request a feature" report to the Church Hub Cloudflare worker. The worker stores the screenshot, opens a **public** GitHub issue in radio-crestin/church-hub (title, notes, picked element, screenshot, app context — never the email) and sends the maintainer a WhatsApp message that includes the email. Returns the created issue URL, which the app opens.',
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
        '429': { description: 'Too many requests from this network' },
        '502': { description: 'The Church Hub backend could not be reached' },
      },
    },
  },
  '/api/feedback/attach-logs': {
    post: {
      tags: ['Feedback'],
      summary: 'Attach server + Tauri logs to a PostHog support ticket',
      description:
        "After `posthog.conversations.sendMessage()` opens a ticket on the client, this endpoint uploads the most recent server and Tauri log tails to PostHog under the same ticket_id. Maintainers triage the ticket in PostHog's conversations view and find the logs attached as a `$feedback_report` event keyed by the ticket_id.",
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
                  description:
                    'The ticket_id returned by posthog.conversations.sendMessage on the client',
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
