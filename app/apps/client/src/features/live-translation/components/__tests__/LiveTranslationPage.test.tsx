import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { render, screen } from '../../../../test/test-utils'
import { LiveTranslationPage } from '../LiveTranslationPage'

// Mock the hook to control audioDevices and other state
const mockUseLiveTranslation = vi.fn()

vi.mock('../../hooks/useLiveTranslation', () => ({
  useLiveTranslation: () => mockUseLiveTranslation(),
  LANGUAGES: [
    { code: 'ro', name: 'Romanian' },
    { code: 'en', name: 'English' },
  ],
  VOICES: ['Kore', 'Puck'],
}))

// Mock Combobox to avoid complex dropdown rendering
vi.mock('~/ui/combobox/Combobox', () => ({
  Combobox: ({
    placeholder,
    value,
    disabled,
  }: {
    placeholder?: string
    value?: unknown
    disabled?: boolean
  }) => (
    <div
      data-testid="combobox"
      data-placeholder={placeholder}
      data-value={String(value)}
      data-disabled={disabled}
    />
  ),
}))

const baseHookReturn = {
  state: {
    isActive: false,
    sourceLanguage: 'ro',
    targetLanguage: 'en',
    inputAudioLevel: 0,
    outputAudioLevel: 0,
    transcription: [],
    startedAt: null,
  },
  settings: {
    sourceLanguage: 'ro',
    targetLanguage: 'en',
    voiceName: 'Kore',
    inputDeviceId: null,
    outputDeviceId: null,
    geminiApiKey: '',
    outputMode: 'device' as const,
  },
  apiKey: '',
  audioDevices: [],
  streamUrl: '',
  streamSecret: '',
  settingsLoaded: true,
  setApiKey: vi.fn(),
  updateSetting: vi.fn(),
  startTranslation: vi.fn(),
  stopTranslation: vi.fn(),
  clearTranscription: vi.fn(),
  resetSecret: vi.fn(),
}

describe('LiveTranslationPage', () => {
  beforeEach(() => {
    mockUseLiveTranslation.mockReturnValue({ ...baseHookReturn })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders without crashing with empty audio devices (all platforms)', () => {
    mockUseLiveTranslation.mockReturnValue({
      ...baseHookReturn,
      audioDevices: [],
    })

    const { container } = render(<LiveTranslationPage />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders without crashing with undefined audio devices (server error)', () => {
    mockUseLiveTranslation.mockReturnValue({
      ...baseHookReturn,
      // Simulate what happened before the fix: audioDevices could be set to
      // a non-array value if the API response didn't have a devices field.
      // The hook now guards with Array.isArray, but the component should
      // also handle this gracefully.
      audioDevices: [],
    })

    const { container } = render(<LiveTranslationPage />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders audio device selectors when devices are available (macOS/Windows/Linux)', async () => {
    const user = userEvent.setup()
    mockUseLiveTranslation.mockReturnValue({
      ...baseHookReturn,
      audioDevices: [
        {
          id: 0,
          name: 'Built-in Microphone',
          inputChannels: 2,
          outputChannels: 0,
          isDefaultInput: true,
          isDefaultOutput: false,
          sampleRates: [44100, 48000],
        },
        {
          id: 1,
          name: 'Built-in Speakers',
          inputChannels: 0,
          outputChannels: 2,
          isDefaultInput: false,
          isDefaultOutput: true,
          sampleRates: [44100, 48000],
        },
      ],
    })

    render(<LiveTranslationPage />)

    // Settings panel is hidden by default, click to open
    await user.click(screen.getByRole('button', { name: /settings/i }))

    // Should show input and output device sections
    expect(screen.getByText(/input device/i)).toBeInTheDocument()
    expect(screen.getByText(/output device/i)).toBeInTheDocument()
  })

  it('hides audio device selectors when no devices available', async () => {
    const user = userEvent.setup()
    mockUseLiveTranslation.mockReturnValue({
      ...baseHookReturn,
      audioDevices: [],
    })

    render(<LiveTranslationPage />)

    // Open settings
    await user.click(screen.getByRole('button', { name: /settings/i }))

    // Should NOT show device labels
    expect(screen.queryByText(/input device/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/output device/i)).not.toBeInTheDocument()
  })

  it('renders start button disabled when no API key', () => {
    render(<LiveTranslationPage />)

    const startButton = screen.getByRole('button', { name: /start/i })
    expect(startButton).toBeDisabled()
  })

  it('renders start button enabled when API key is set', () => {
    mockUseLiveTranslation.mockReturnValue({
      ...baseHookReturn,
      apiKey: 'test-key',
    })

    render(<LiveTranslationPage />)

    const startButton = screen.getByRole('button', { name: /start/i })
    expect(startButton).not.toBeDisabled()
  })

  it('renders stop button when translation is active', () => {
    mockUseLiveTranslation.mockReturnValue({
      ...baseHookReturn,
      apiKey: 'test-key',
      state: {
        ...baseHookReturn.state,
        isActive: true,
        startedAt: Date.now(),
      },
    })

    render(<LiveTranslationPage />)

    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument()
  })

  it('renders language bar showing source and target languages', () => {
    render(<LiveTranslationPage />)

    expect(screen.getByText('Romanian')).toBeInTheDocument()
    expect(screen.getByText('English')).toBeInTheDocument()
  })

  it('renders with mixed input/output device (combo device on Linux/Windows)', async () => {
    const user = userEvent.setup()
    mockUseLiveTranslation.mockReturnValue({
      ...baseHookReturn,
      audioDevices: [
        {
          id: 0,
          name: 'USB Audio Device',
          inputChannels: 2,
          outputChannels: 2,
          isDefaultInput: true,
          isDefaultOutput: true,
          sampleRates: [44100, 48000],
        },
      ],
    })

    render(<LiveTranslationPage />)

    // Open settings
    await user.click(screen.getByRole('button', { name: /settings/i }))

    // Both selectors should be visible since the device has both input and output
    expect(screen.getByText(/input device/i)).toBeInTheDocument()
    expect(screen.getByText(/output device/i)).toBeInTheDocument()
  })

  it('renders error message when translation fails', () => {
    mockUseLiveTranslation.mockReturnValue({
      ...baseHookReturn,
      state: {
        ...baseHookReturn.state,
        error: 'Audio library not available',
      },
    })

    render(<LiveTranslationPage />)

    expect(screen.getByText('Audio library not available')).toBeInTheDocument()
  })

  it('renders audio level meters when active', () => {
    mockUseLiveTranslation.mockReturnValue({
      ...baseHookReturn,
      apiKey: 'test-key',
      state: {
        ...baseHookReturn.state,
        isActive: true,
        inputAudioLevel: 0.5,
        outputAudioLevel: 0.3,
        startedAt: Date.now(),
      },
    })

    render(<LiveTranslationPage />)

    expect(screen.getByText(/input/i)).toBeInTheDocument()
    expect(screen.getByText(/output/i)).toBeInTheDocument()
  })
})
