export const schedulesPaths = {
  '/api/schedules/automation': {
    get: {
      tags: ['Schedules'],
      summary: 'Presentation runner state',
      description:
        'Whether a presentation is running by itself, at which step, and when the next one goes up',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': {
          description: 'The runner state',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    $ref: '#/components/schemas/ScheduleAutomationState',
                  },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/api/schedules/automation/stop': {
    post: {
      tags: ['Schedules'],
      summary: 'Stop the running presentation',
      description:
        'Stops the presentation running by itself and takes its content off the screens. Needs control_room.control',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': {
          description: 'The runner state',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    $ref: '#/components/schemas/ScheduleAutomationState',
                  },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
      },
    },
  },
  '/api/schedules/{id}/run': {
    post: {
      tags: ['Schedules'],
      summary: 'Run a presentation',
      description:
        'Presents the first step of the presentation. With autoplay on, the server then moves it on by itself, each step after its own time (the item advanceSeconds, else autoplaySeconds, longer for more text with autoplayByText), looping if set, until it is stopped, ends, or an operator presents something else. Sets the music volume first when the presentation has one. Needs control_room.control',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
        },
      ],
      responses: {
        '200': {
          description: 'The runner state',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    $ref: '#/components/schemas/ScheduleAutomationState',
                  },
                },
              },
            },
          },
        },
        '400': {
          description: 'The presentation has nothing to show',
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '404': { description: 'Presentation not found' },
      },
    },
  },
  '/api/schedules/search': {
    get: {
      tags: ['Schedules'],
      summary: 'Search schedules',
      description: 'Search schedules by title or song content',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'q',
          in: 'query',
          required: true,
          schema: { type: 'string' },
          description: 'Search query',
        },
      ],
      responses: {
        '200': {
          description: 'Search results',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/ScheduleSearchResult',
                    },
                  },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/api/schedules': {
    get: {
      tags: ['Schedules'],
      summary: 'List all schedules',
      description: 'Returns all schedules',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': {
          description: 'List of schedules',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Schedule' },
                  },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
    post: {
      tags: ['Schedules'],
      summary: 'Create or update schedule',
      description: 'Creates a new schedule or updates an existing one',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UpsertScheduleInput' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Schedule created/updated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/Schedule' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/api/schedules/{id}': {
    get: {
      tags: ['Schedules'],
      summary: 'Get schedule by ID',
      description: 'Returns a schedule with all its items and slides',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Schedule ID',
        },
      ],
      responses: {
        '200': {
          description: 'Schedule with items',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/ScheduleWithItems' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
    delete: {
      tags: ['Schedules'],
      summary: 'Delete schedule',
      description: 'Delete a schedule and all its items',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
        },
      ],
      responses: {
        '200': {
          description: 'Schedule deleted',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/OperationResult' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/schedules/{id}/items': {
    post: {
      tags: ['Schedules'],
      summary: 'Add item to schedule',
      description: 'Add a song or standalone slide to a schedule',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Schedule ID',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                songId: { type: 'integer', description: 'Song ID to add' },
                slideType: { $ref: '#/components/schemas/SlideTemplate' },
                slideContent: { type: 'string' },
                afterItemId: { type: 'integer' },
                biblePassage: {
                  $ref: '#/components/schemas/BiblePassageInput',
                },
                verseteTineriEntries: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/BibleReadingInput' },
                  description: 'Readings of a "Versete Biblice" slide',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Item added',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/ScheduleItem' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/schedules/{id}/items/{itemId}': {
    put: {
      tags: ['Schedules'],
      summary: 'Update slide in schedule',
      description: 'Update a standalone slide item in the schedule',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Schedule ID',
        },
        {
          name: 'itemId',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Schedule item ID',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                slideType: { $ref: '#/components/schemas/SlideTemplate' },
                slideContent: { type: 'string' },
                verseteTineriEntries: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/BibleReadingInput' },
                  description:
                    'Replaces the readings of a "Versete Biblice" slide',
                },
                biblePassage: {
                  $ref: '#/components/schemas/BiblePassageInput',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Item updated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/ScheduleItem' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
    delete: {
      tags: ['Schedules'],
      summary: 'Remove item from schedule',
      description: 'Remove an item from the schedule',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Schedule ID',
        },
        {
          name: 'itemId',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Schedule item ID',
        },
      ],
      responses: {
        '200': {
          description: 'Item removed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/OperationResult' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/schedules/{id}/items/{itemId}/advance': {
    put: {
      tags: ['Schedules'],
      summary: 'Set how long each slide of an item stays up',
      description:
        "Like PowerPoint's 'advance after': while the presentation runs by itself, each slide of this item stays up advanceSeconds (1-3600). null gives the item back the presentation's timing. Needs programs.edit",
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Presentation ID',
        },
        {
          name: 'itemId',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Presentation item ID',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['advanceSeconds'],
              properties: {
                advanceSeconds: {
                  type: 'integer',
                  nullable: true,
                  minimum: 1,
                  maximum: 3600,
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Timing saved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/OperationResult' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/schedules/{id}/items/{itemId}/sung': {
    put: {
      tags: ['Schedules'],
      summary: 'Toggle the "already sung" marker on a schedule item',
      description:
        'Marks a schedule song as sung (or not) within this schedule only. The same song can be pending in one program and sung in another.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Schedule ID',
        },
        {
          name: 'itemId',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Schedule item ID',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['isSung'],
              properties: {
                isSung: {
                  type: 'boolean',
                  description: 'New "already sung" state',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Marker updated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/OperationResult' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/schedules/{id}/items/reorder': {
    put: {
      tags: ['Schedules'],
      summary: 'Reorder schedule items',
      description: 'Reorder items in a schedule by providing ordered item IDs',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Schedule ID',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ReorderScheduleItemsInput',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Items reordered',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/OperationResult' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/schedules/{id}/import-to-queue': {
    post: {
      tags: ['Schedules'],
      summary: 'Import schedule to queue',
      description:
        'Import all items from a schedule into the presentation queue',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Schedule ID',
        },
      ],
      responses: {
        '200': {
          description: 'Schedule imported to queue',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      itemsImported: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/schedules/{id}/items/{itemId}/midi': {
    put: {
      tags: ['Schedules'],
      summary: 'Attach a MIDI file to a song item',
      description:
        'The raw .mid file is the body (up to 5 MB). When the running presentation reaches the item, the MIDI plays through the music player and each slide goes up at its time: split evenly until synced (verse-times). Rendering to audio starts at once and is cached. Replacing the file clears synced times. Needs programs.edit',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Presentation ID',
        },
        {
          name: 'itemId',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Song item ID',
        },
        {
          name: 'name',
          in: 'query',
          required: false,
          schema: { type: 'string' },
          description: 'The file name shown for it',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'audio/midi': { schema: { type: 'string', format: 'binary' } },
        },
      },
      responses: {
        '200': {
          description: "The item's MIDI file",
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/ScheduleItemMidi' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
    delete: {
      tags: ['Schedules'],
      summary: "Remove a song item's MIDI file",
      description: 'Stops its music if it is playing. Needs programs.edit',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Presentation ID',
        },
        {
          name: 'itemId',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Song item ID',
        },
      ],
      responses: {
        '200': { description: 'Removed' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/schedules/{id}/items/{itemId}/midi/verse-times': {
    put: {
      tags: ['Schedules'],
      summary: 'Save when each slide starts in the MIDI music',
      description:
        'verseTimes: the second each slide (choruses expanded) starts at, rising; null splits the song evenly again. Needs programs.edit',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Presentation ID',
        },
        {
          name: 'itemId',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Song item ID',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['verseTimes'],
              properties: {
                verseTimes: {
                  type: 'array',
                  items: { type: 'number', minimum: 0 },
                  nullable: true,
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: "The item's MIDI file",
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/ScheduleItemMidi' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/schedules/{id}/items/{itemId}/midi/play': {
    post: {
      tags: ['Schedules'],
      summary: "Play a song item's MIDI music (from a given second)",
      description:
        'Through the music player, to sync its slides by hand; audible is false with no audio server. Needs programs.edit',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Presentation ID',
        },
        {
          name: 'itemId',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Song item ID',
        },
      ],
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                fromSeconds: {
                  type: 'number',
                  minimum: 0,
                  description: 'Where to start; 0 by default',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Playing',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: { audible: { type: 'boolean' } },
                  },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/schedules/{id}/items/{itemId}/midi/stop': {
    post: {
      tags: ['Schedules'],
      summary: "Stop a song item's MIDI music",
      description:
        "Only when the player plays this item's MIDI. Needs programs.edit",
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Presentation ID',
        },
        {
          name: 'itemId',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Song item ID',
        },
      ],
      responses: {
        '200': { description: 'Stopped' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },
}
