import soundFont from './assets/GeneralUser-GS.sf3' with { type: 'file' }

/**
 * The General MIDI SoundFont MIDI files are played with: GeneralUser GS
 * v2.0.3 by S. Christian Collins (free to bundle, see
 * assets/GeneralUser-GS-LICENSE.txt), compressed to SF3 (Ogg Vorbis samples)
 * with spessasynth_core's compress_to_sf3 example: 32 MB as SF2, 7 MB here.
 * Embedded in the compiled sidecar; inside it, a `$bunfs` path.
 */
export const SOUND_FONT_PATH: string = soundFont
