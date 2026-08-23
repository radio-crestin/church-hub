export const feedbackPaths = {
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
