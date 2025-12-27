export const screenSchemas = {
  ScreenType: {
    type: 'string',
    enum: ['primary', 'stage', 'livestream', 'kiosk'],
    description:
      'Type of screen - primary (audience), stage (performers), livestream (overlay), or kiosk (single fullscreen display)',
  },
  ContentType: {
    type: 'string',
    enum: [
      'song',
      'bible',
      'bible_passage',
      'announcement',
      'versete_tineri',
      'empty',
    ],
    description: 'Type of content being rendered',
  },
  ScreenBackgroundType: {
    type: 'string',
    enum: ['transparent', 'color', 'image', 'video'],
    description: 'Type of screen background',
  },
  DisplayOpenMode: {
    type: 'string',
    enum: ['browser', 'native'],
    description: 'How the screen opens - browser tab or native window',
  },
  Position: {
    type: 'object',
    properties: {
      x: { type: 'number' },
      y: { type: 'number' },
      unit: { type: 'string', enum: ['px', '%'] },
    },
  },
  Size: {
    type: 'object',
    properties: {
      width: { type: 'number' },
      height: { type: 'number' },
      unit: { type: 'string', enum: ['px', '%'] },
    },
  },
  TextStyle: {
    type: 'object',
    properties: {
      fontFamily: { type: 'string' },
      maxFontSize: { type: 'number' },
      autoScale: { type: 'boolean' },
      color: { type: 'string' },
      bold: { type: 'boolean' },
      italic: { type: 'boolean' },
      underline: { type: 'boolean' },
      alignment: { type: 'string', enum: ['left', 'center', 'right'] },
      lineHeight: { type: 'number' },
      shadow: { type: 'boolean' },
    },
  },
  ScreenBackgroundConfig: {
    type: 'object',
    properties: {
      type: { $ref: '#/components/schemas/ScreenBackgroundType' },
      color: { type: 'string' },
      imageUrl: { type: 'string' },
      videoUrl: { type: 'string' },
      opacity: { type: 'number' },
    },
  },
  ClockElementConfig: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean' },
      position: { $ref: '#/components/schemas/Position' },
      style: { $ref: '#/components/schemas/TextStyle' },
      format: { type: 'string', enum: ['12h', '24h'] },
      showSeconds: { type: 'boolean' },
    },
  },
  ScreenGlobalSettings: {
    type: 'object',
    properties: {
      defaultBackground: {
        $ref: '#/components/schemas/ScreenBackgroundConfig',
      },
      clockEnabled: { type: 'boolean' },
      clockConfig: { $ref: '#/components/schemas/ClockElementConfig' },
    },
  },
  NextSlideSectionConfig: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean' },
      position: { $ref: '#/components/schemas/Position' },
      size: { $ref: '#/components/schemas/Size' },
      labelText: { type: 'string' },
      labelStyle: { $ref: '#/components/schemas/TextStyle' },
      contentStyle: { $ref: '#/components/schemas/TextStyle' },
      background: { $ref: '#/components/schemas/ScreenBackgroundConfig' },
    },
  },
  Screen: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      type: { $ref: '#/components/schemas/ScreenType' },
      isActive: { type: 'boolean' },
      openMode: { $ref: '#/components/schemas/DisplayOpenMode' },
      isFullscreen: { type: 'boolean' },
      width: { type: 'integer', description: 'Screen width in pixels' },
      height: { type: 'integer', description: 'Screen height in pixels' },
      globalSettings: { $ref: '#/components/schemas/ScreenGlobalSettings' },
      sortOrder: { type: 'integer' },
      createdAt: { type: 'integer', description: 'Unix timestamp' },
      updatedAt: { type: 'integer', description: 'Unix timestamp' },
    },
  },
  ScreenWithConfigs: {
    allOf: [
      { $ref: '#/components/schemas/Screen' },
      {
        type: 'object',
        properties: {
          contentConfigs: {
            type: 'object',
            description: 'Map of content type to its configuration',
          },
          nextSlideConfig: {
            $ref: '#/components/schemas/NextSlideSectionConfig',
          },
        },
      },
    ],
  },
  UpsertScreenInput: {
    type: 'object',
    required: ['name', 'type'],
    properties: {
      id: {
        type: 'integer',
        description: 'If provided, updates existing screen',
      },
      name: { type: 'string' },
      type: { $ref: '#/components/schemas/ScreenType' },
      isActive: { type: 'boolean' },
      openMode: { $ref: '#/components/schemas/DisplayOpenMode' },
      isFullscreen: { type: 'boolean' },
      width: { type: 'integer' },
      height: { type: 'integer' },
      globalSettings: { $ref: '#/components/schemas/ScreenGlobalSettings' },
      sortOrder: { type: 'integer' },
    },
  },
}
