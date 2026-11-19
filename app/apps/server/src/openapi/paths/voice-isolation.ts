const inworldStatus = {
  type: 'object',
  properties: {
    python: {
      type: 'string',
      nullable: true,
      description:
        'The system Python 3.10+ the helper venv is made from; null when none was found',
    },
    installed: {
      type: 'boolean',
      description: 'inworld-voice-isolation (with PyTorch) is in the venv',
    },
    modelReady: {
      type: 'boolean',
      description:
        'Installed, weights downloaded and benchmarked: live sessions can use it',
    },
    device: {
      type: 'string',
      description: 'Where the model runs: cuda, mps or cpu',
    },
    realTimeFactor: {
      type: 'number',
      description:
        'Seconds of compute per second of audio in the last benchmark; below 1 keeps up live',
    },
    setup: {
      type: 'object',
      nullable: true,
      description: 'The setup step running now, null when none',
      properties: {
        step: {
          type: 'string',
          enum: ['venv', 'install', 'download', 'benchmark'],
        },
        received: { type: 'integer', description: 'Weight bytes received' },
        total: { type: 'integer', description: 'Weight bytes expected' },
      },
    },
    error: { type: 'string', description: 'Why the last setup failed' },
  },
}

export const voiceIsolationPaths = {
  '/api/live-translation/voice-isolation/inworld': {
    get: {
      tags: ['Live Translation'],
      summary: 'Inworld Voice Isolator status on this machine',
      description:
        'Whether the optional Inworld Voice Isolator helper (a Python venv with inworld-voice-isolation and its realtime weights) is set up, where it runs and how fast. Poll it while a setup runs.',
      responses: {
        '200': {
          description: 'The status',
          content: { 'application/json': { schema: inworldStatus } },
        },
      },
    },
  },
  '/api/live-translation/voice-isolation/inworld/setup': {
    post: {
      tags: ['Live Translation'],
      summary: 'Set up Inworld Voice Isolator',
      description:
        'Starts (or joins) the setup in the background: creates the venv from the system Python, installs inworld-voice-isolation with PyTorch, downloads the realtime weights (~230 MB, checksum-verified) and benchmarks the real-time factor. Steps already done are skipped.',
      responses: {
        '202': {
          description: 'Setup started; the status as it is now',
          content: { 'application/json': { schema: inworldStatus } },
        },
      },
    },
  },
  '/api/live-translation/voice-isolation/isolate': {
    post: {
      tags: ['Live Translation'],
      summary: 'Run a recording through voice isolation',
      description:
        'Passes a 48 kHz mono 16-bit WAV through the same filter as the live preacher microphone and returns what the translation engines would receive. Unlike a live session, it waits for the isolator to load instead of passing raw audio meanwhile.',
      parameters: [
        {
          name: 'isolation',
          in: 'query',
          required: true,
          schema: { type: 'string', enum: ['off', 'inworld'] },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'audio/wav': { schema: { type: 'string', format: 'binary' } },
        },
      },
      responses: {
        '200': {
          description: 'The isolated recording, 48 kHz mono 16-bit WAV',
          content: {
            'audio/wav': { schema: { type: 'string', format: 'binary' } },
          },
        },
        '400': {
          description: 'Not a 48 kHz mono 16-bit WAV, or bad isolation',
        },
        '409': { description: 'The isolator is not set up or failed' },
      },
    },
  },
}
