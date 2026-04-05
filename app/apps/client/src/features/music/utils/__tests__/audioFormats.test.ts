import { describe, expect, it } from 'vitest'

import {
  getAudioFormat,
  isAudioFile,
  SUPPORTED_AUDIO_EXTENSIONS,
} from '../audioFormats'

describe('music/utils/audioFormats', () => {
  describe('SUPPORTED_AUDIO_EXTENSIONS', () => {
    it('contains the expected formats', () => {
      expect(SUPPORTED_AUDIO_EXTENSIONS).toEqual([
        'mp3',
        'wav',
        'ogg',
        'm4a',
        'flac',
      ])
    })
  })

  describe('isAudioFile', () => {
    it.each([
      'song.mp3',
      'track.wav',
      'audio.ogg',
      'file.m4a',
      'lossless.flac',
    ])('returns true for %s', (filename) => {
      expect(isAudioFile(filename)).toBe(true)
    })

    it.each([
      'song.MP3',
      'track.WAV',
      'audio.OGG',
      'file.M4A',
      'lossless.FLAC',
    ])('returns true for uppercase extension %s', (filename) => {
      expect(isAudioFile(filename)).toBe(true)
    })

    it.each([
      'image.png',
      'doc.pdf',
      'video.mp4',
      'data.json',
      'script.js',
    ])('returns false for non-audio file %s', (filename) => {
      expect(isAudioFile(filename)).toBe(false)
    })

    it('returns false for files with no extension', () => {
      expect(isAudioFile('noextension')).toBe(false)
    })

    it('handles files with multiple dots', () => {
      expect(isAudioFile('my.song.file.mp3')).toBe(true)
      expect(isAudioFile('my.song.file.txt')).toBe(false)
    })

    it('returns false for empty string', () => {
      expect(isAudioFile('')).toBe(false)
    })
  })

  describe('getAudioFormat', () => {
    it.each([
      ['song.mp3', 'mp3'],
      ['track.wav', 'wav'],
      ['audio.ogg', 'ogg'],
      ['file.m4a', 'm4a'],
      ['lossless.flac', 'flac'],
    ])('returns "%s" format for %s', (filename, expected) => {
      expect(getAudioFormat(filename)).toBe(expected)
    })

    it('returns the format in lowercase', () => {
      expect(getAudioFormat('song.MP3')).toBe('mp3')
    })

    it('returns null for non-audio files', () => {
      expect(getAudioFormat('image.png')).toBeNull()
    })

    it('returns null for files with no extension', () => {
      expect(getAudioFormat('noextension')).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(getAudioFormat('')).toBeNull()
    })
  })
})
