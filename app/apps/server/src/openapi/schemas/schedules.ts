export const scheduleSchemas = {
  AutomationTrigger: {
    type: 'object',
    description: 'Something in OBS that starts or stops a presentation',
    required: ['event'],
    properties: {
      event: {
        type: 'string',
        enum: [
          'scene_selected',
          'stream_started',
          'stream_stopped',
          'recording_started',
          'recording_stopped',
        ],
        description:
          'An OBS scene is selected (in OBS or Church Hub), or the livestream or recording starts or stops',
      },
      sceneName: {
        type: 'string',
        nullable: true,
        description: 'The scene that fires it; required for scene_selected',
      },
    },
  },
  ScheduleAutomationSettings: {
    type: 'object',
    description: 'How a presentation runs by itself',
    properties: {
      autoplaySeconds: {
        type: 'integer',
        nullable: true,
        minimum: 1,
        maximum: 3600,
        description:
          "Seconds each slide stays up while it runs; null = manual. An item's own advanceSeconds wins over it",
      },
      autoplayByText: {
        type: 'boolean',
        description:
          'A slide with more text stays up longer than autoplaySeconds, so it can be read',
      },
      loop: {
        type: 'boolean',
        description: 'Past the last step, start again from the first',
      },
      musicVolume: {
        type: 'integer',
        nullable: true,
        minimum: 0,
        maximum: 100,
        description: 'Music player volume set when it starts; null = unchanged',
      },
      startOnAppStart: {
        type: 'boolean',
        description:
          'Started by itself when Church Hub starts. Setting it on one presentation turns it off on the others',
      },
      startTrigger: {
        allOf: [{ $ref: '#/components/schemas/AutomationTrigger' }],
        nullable: true,
        description:
          'Started by itself when this happens in OBS (not again while it is on screen); null = never. When several match, the oldest presentation starts',
      },
      stopTrigger: {
        allOf: [{ $ref: '#/components/schemas/AutomationTrigger' }],
        nullable: true,
        description:
          'Stopped and taken off the screens when this happens while it is on screen; null = never',
      },
    },
  },
  ScheduleAutomationState: {
    type: 'object',
    description:
      'What the presentation runner is doing. Also sent over the WebSocket as `schedule_automation`',
    required: ['running'],
    properties: {
      running: { type: 'boolean' },
      scheduleId: { type: 'integer' },
      title: { type: 'string' },
      stepIndex: {
        type: 'integer',
        description: 'Position of the step on screen in the running order',
      },
      stepCount: { type: 'integer' },
      stepSeconds: {
        type: 'integer',
        description: 'How long the step on screen stays up',
      },
      loop: { type: 'boolean' },
      nextStepAt: {
        type: 'integer',
        description: 'When the next step goes up (epoch ms)',
      },
    },
  },
  Schedule: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      title: { type: 'string' },
      description: { type: 'string', nullable: true },
      automation: { $ref: '#/components/schemas/ScheduleAutomationSettings' },
      itemCount: { type: 'integer' },
      songCount: { type: 'integer' },
      createdAt: { type: 'integer', description: 'Unix timestamp' },
      updatedAt: { type: 'integer', description: 'Unix timestamp' },
    },
  },
  ScheduleItemConfig: {
    type: 'object',
    description:
      "An item's settings. Music: { source: 'folder', folderId } or { source: 'tracks', fileIds }, with shuffle. Video: { source: 'file', mediaId } or { source: 'random' }, with loop (plays again until the step changes) and background (no step of its own: loops behind the steps after it). Verses: { source: 'book', bookCode } or { source: 'topic', topicKey }, with translationId and count (null = all of a topic's passages in order, else that many at random each loop). A Versete Biblice slide: { count }",
    additionalProperties: true,
  },
  ScheduleItem: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      scheduleId: { type: 'integer' },
      itemType: {
        type: 'string',
        enum: ['song', 'slide', 'bible_passage', 'music', 'video', 'verses'],
      },
      itemConfig: {
        allOf: [{ $ref: '#/components/schemas/ScheduleItemConfig' }],
        nullable: true,
      },
      music: {
        type: 'object',
        nullable: true,
        description: "A music item's tracks",
        properties: {
          folderName: { type: 'string', nullable: true },
          trackCount: { type: 'integer' },
        },
      },
      video: {
        type: 'object',
        nullable: true,
        description: 'The video a video item shows this run',
        properties: {
          mediaId: { type: 'string' },
          url: { type: 'string' },
        },
      },
      songId: { type: 'integer', nullable: true },
      song: {
        type: 'object',
        nullable: true,
        properties: {
          id: { type: 'integer' },
          title: { type: 'string' },
          categoryName: { type: 'string', nullable: true },
          tagNames: { type: 'array', items: { type: 'string' } },
        },
      },
      slides: {
        type: 'array',
        items: { $ref: '#/components/schemas/SongSlide' },
      },
      keyLine: { type: 'string', nullable: true },
      advanceSeconds: {
        type: 'integer',
        nullable: true,
        description:
          "Seconds each slide of this item stays up when the presentation runs by itself; null = the presentation's timing",
      },
      midi: {
        allOf: [{ $ref: '#/components/schemas/ScheduleItemMidi' }],
        nullable: true,
        description:
          'A MIDI file played when the running presentation reaches this song item, its slides following the music',
      },
      isSung: {
        type: 'boolean',
        description: 'Manual "already sung" marker, scoped to this schedule',
      },
      sungAt: {
        type: 'integer',
        nullable: true,
        description: 'Unix timestamp in ms when marked sung, null otherwise',
      },
      slideType: { $ref: '#/components/schemas/SlideTemplate' },
      slideContent: { type: 'string', nullable: true },
      sortOrder: { type: 'integer' },
      createdAt: { type: 'integer', description: 'Unix timestamp' },
      updatedAt: { type: 'integer', description: 'Unix timestamp' },
    },
  },
  ScheduleItemMidi: {
    type: 'object',
    description:
      "A song item's MIDI file: rendered with the bundled GeneralUser GS SoundFont and played through the music player; each slide goes up at its time in the music",
    properties: {
      hash: { type: 'string', description: 'SHA-256 of the stored file' },
      fileName: { type: 'string' },
      durationSeconds: { type: 'number' },
      verseTimes: {
        type: 'array',
        items: { type: 'number' },
        nullable: true,
        description:
          'The second each slide (choruses expanded) starts at, as synced; null = the song split evenly across its slides',
      },
    },
  },
  ScheduleWithItems: {
    allOf: [
      { $ref: '#/components/schemas/Schedule' },
      {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/ScheduleItem' },
          },
        },
      },
    ],
  },
  ScheduleSearchResult: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      title: { type: 'string' },
      description: { type: 'string', nullable: true },
      itemCount: { type: 'integer' },
      matchedContent: { type: 'string' },
    },
  },
  UpsertScheduleInput: {
    type: 'object',
    required: ['title'],
    properties: {
      id: {
        type: 'integer',
        description: 'If provided, updates existing schedule',
      },
      title: { type: 'string' },
      description: { type: 'string', nullable: true },
      automation: {
        allOf: [{ $ref: '#/components/schemas/ScheduleAutomationSettings' }],
        description: 'Only the settings given change',
      },
    },
  },
  AddToScheduleInput: {
    type: 'object',
    required: ['scheduleId'],
    properties: {
      scheduleId: { type: 'integer' },
      songId: {
        type: 'integer',
        description: 'Add a song to the schedule',
      },
      slideType: { $ref: '#/components/schemas/SlideTemplate' },
      slideContent: {
        type: 'string',
        description: 'Content for standalone slide',
      },
      afterItemId: {
        type: 'integer',
        description: 'Insert after this item ID',
      },
    },
  },
  UpdateScheduleSlideInput: {
    type: 'object',
    required: ['id', 'slideType', 'slideContent'],
    properties: {
      id: { type: 'integer' },
      slideType: { $ref: '#/components/schemas/SlideTemplate' },
      slideContent: { type: 'string' },
    },
  },
  VerseSegment: {
    type: 'object',
    required: ['startVerse', 'endVerse'],
    description: 'A run of verses inside one chapter, both ends included',
    properties: {
      startVerse: { type: 'integer' },
      endVerse: { type: 'integer' },
    },
  },
  BibleReadingInput: {
    type: 'object',
    required: [
      'translationId',
      'bookCode',
      'bookName',
      'startChapter',
      'startVerse',
      'endChapter',
      'endVerse',
    ],
    description:
      'One reading of a "Versete Biblice" slide. For a comma verse list with a gap ("Ioan 3:16-18,20") send verseSegments; startVerse/endVerse are then the outer bounds.',
    properties: {
      personName: { type: 'string', description: 'Who reads it (optional)' },
      translationId: { type: 'integer' },
      bookCode: { type: 'string', example: 'JHN' },
      bookName: { type: 'string', example: 'Ioan' },
      startChapter: { type: 'integer', example: 3 },
      startVerse: { type: 'integer', example: 16 },
      endChapter: { type: 'integer', example: 3 },
      endVerse: { type: 'integer', example: 20 },
      verseSegments: {
        type: 'array',
        items: { $ref: '#/components/schemas/VerseSegment' },
        description:
          'Only inside startChapter. Example for 3:16-18,20: [{startVerse:16,endVerse:18},{startVerse:20,endVerse:20}]',
      },
    },
  },
  BiblePassageInput: {
    allOf: [
      { $ref: '#/components/schemas/BibleReadingInput' },
      {
        type: 'object',
        required: ['translationAbbreviation'],
        properties: { translationAbbreviation: { type: 'string' } },
      },
    ],
    description:
      'A passage picked from the Bible; stored as one "Versete Biblice" slide with no person',
  },
  ReorderScheduleItemsInput: {
    type: 'object',
    required: ['itemIds'],
    properties: {
      itemIds: {
        type: 'array',
        items: { type: 'integer' },
        description: 'Ordered array of schedule item IDs',
      },
    },
  },
}
