import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface ChordDiagramProps {
  chord: string
  onClose: () => void
}

// Guitar chord fingerings: [E, A, D, G, B, e] strings, -1 = muted, 0 = open
const GUITAR_CHORDS: Record<string, number[]> = {
  C: [-1, 3, 2, 0, 1, 0],
  D: [-1, -1, 0, 2, 3, 2],
  E: [0, 2, 2, 1, 0, 0],
  F: [1, 3, 3, 2, 1, 1],
  G: [3, 2, 0, 0, 0, 3],
  A: [-1, 0, 2, 2, 2, 0],
  B: [-1, 2, 4, 4, 4, 2],
  Am: [-1, 0, 2, 2, 1, 0],
  Bm: [-1, 2, 4, 4, 3, 2],
  Cm: [-1, 3, 5, 5, 4, 3],
  Dm: [-1, -1, 0, 2, 3, 1],
  Em: [0, 2, 2, 0, 0, 0],
  Fm: [1, 3, 3, 1, 1, 1],
  Gm: [3, 5, 5, 3, 3, 3],
  'C#': [-1, 4, 3, 1, 2, 1],
  'D#': [-1, -1, 1, 3, 4, 3],
  'F#': [2, 4, 4, 3, 2, 2],
  'G#': [4, 6, 6, 5, 4, 4],
  'A#': [-1, 1, 3, 3, 3, 1],
  Db: [-1, 4, 3, 1, 2, 1],
  Eb: [-1, -1, 1, 3, 4, 3],
  Gb: [2, 4, 4, 3, 2, 2],
  Ab: [4, 6, 6, 5, 4, 4],
  Bb: [-1, 1, 3, 3, 3, 1],
  'C#m': [-1, 4, 6, 6, 5, 4],
  'D#m': [-1, -1, 1, 3, 4, 2],
  'F#m': [2, 4, 4, 2, 2, 2],
  'G#m': [4, 6, 6, 4, 4, 4],
  'A#m': [-1, 1, 3, 3, 2, 1],
  Dbm: [-1, 4, 6, 6, 5, 4],
  Ebm: [-1, -1, 1, 3, 4, 2],
  Gbm: [2, 4, 4, 2, 2, 2],
  Abm: [4, 6, 6, 4, 4, 4],
  Bbm: [-1, 1, 3, 3, 2, 1],
  C7: [-1, 3, 2, 3, 1, 0],
  D7: [-1, -1, 0, 2, 1, 2],
  E7: [0, 2, 0, 1, 0, 0],
  F7: [1, 3, 1, 2, 1, 1],
  G7: [3, 2, 0, 0, 0, 1],
  A7: [-1, 0, 2, 0, 2, 0],
  B7: [-1, 2, 1, 2, 0, 2],
  Am7: [-1, 0, 2, 0, 1, 0],
  Bm7: [-1, 2, 0, 2, 0, 2],
  Dm7: [-1, -1, 0, 2, 1, 1],
  Em7: [0, 2, 0, 0, 0, 0],
  Gm7: [3, 5, 3, 3, 3, 3],
  Csus2: [-1, 3, 0, 0, 1, 0],
  Dsus2: [-1, -1, 0, 2, 3, 0],
  Gsus2: [3, 0, 0, 0, 3, 3],
  Asus2: [-1, 0, 2, 2, 0, 0],
  Csus4: [-1, 3, 3, 0, 1, 1],
  Dsus4: [-1, -1, 0, 2, 3, 3],
  Gsus4: [3, 5, 5, 0, 0, 3],
  Asus4: [-1, 0, 2, 2, 3, 0],
}

// Piano chord notes (MIDI-style, C4 = 60)
// Maps chord name to array of note numbers relative to C (0-11)
const PIANO_CHORDS: Record<string, number[]> = {
  C: [0, 4, 7],
  D: [2, 6, 9],
  E: [4, 8, 11],
  F: [5, 9, 0],
  G: [7, 11, 2],
  A: [9, 1, 4],
  B: [11, 3, 6],
  Am: [9, 0, 4],
  Bm: [11, 2, 6],
  Cm: [0, 3, 7],
  Dm: [2, 5, 9],
  Em: [4, 7, 11],
  Fm: [5, 8, 0],
  Gm: [7, 10, 2],
  'C#': [1, 5, 8],
  'D#': [3, 7, 10],
  'F#': [6, 10, 1],
  'G#': [8, 0, 3],
  'A#': [10, 2, 5],
  Db: [1, 5, 8],
  Eb: [3, 7, 10],
  Gb: [6, 10, 1],
  Ab: [8, 0, 3],
  Bb: [10, 2, 5],
  'C#m': [1, 4, 8],
  'D#m': [3, 6, 10],
  'F#m': [6, 9, 1],
  'G#m': [8, 11, 3],
  'A#m': [10, 1, 5],
  Dbm: [1, 4, 8],
  Ebm: [3, 6, 10],
  Gbm: [6, 9, 1],
  Abm: [8, 11, 3],
  Bbm: [10, 1, 5],
  C7: [0, 4, 7, 10],
  D7: [2, 6, 9, 0],
  E7: [4, 8, 11, 2],
  F7: [5, 9, 0, 3],
  G7: [7, 11, 2, 5],
  A7: [9, 1, 4, 7],
  B7: [11, 3, 6, 9],
  Am7: [9, 0, 4, 7],
  Bm7: [11, 2, 6, 9],
  Dm7: [2, 5, 9, 0],
  Em7: [4, 7, 11, 2],
  Gm7: [7, 10, 2, 5],
  Csus2: [0, 2, 7],
  Dsus2: [2, 4, 9],
  Gsus2: [7, 9, 2],
  Asus2: [9, 11, 4],
  Csus4: [0, 5, 7],
  Dsus4: [2, 7, 9],
  Gsus4: [7, 0, 2],
  Asus4: [9, 2, 4],
}

const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e']
const PIANO_KEY_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
]

function GuitarDiagram({ frets }: { frets: number[] }) {
  const numFrets = 5
  const stringCount = 6
  const width = 160
  const height = 180
  const padTop = 30
  const padLeft = 25
  const padRight = 15
  const fretHeight = (height - padTop - 20) / numFrets
  const stringSpacing = (width - padLeft - padRight) / (stringCount - 1)

  const minFret = Math.min(...frets.filter((f) => f > 0))
  const maxFret = Math.max(...frets.filter((f) => f > 0))
  const startFret = maxFret > numFrets ? Math.max(1, minFret - 1) : 0

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[160px]">
      {/* Nut or fret indicator */}
      {startFret === 0 ? (
        <rect
          x={padLeft - 2}
          y={padTop - 3}
          width={stringSpacing * (stringCount - 1) + 4}
          height={4}
          fill="currentColor"
          rx={1}
        />
      ) : (
        <text
          x={padLeft - 15}
          y={padTop + fretHeight / 2 + 4}
          fontSize="11"
          fill="currentColor"
          textAnchor="middle"
        >
          {startFret + 1}
        </text>
      )}

      {/* Fret lines */}
      {Array.from({ length: numFrets + 1 }, (_, i) => (
        <line
          key={`fret-${i}`}
          x1={padLeft}
          y1={padTop + i * fretHeight}
          x2={padLeft + stringSpacing * (stringCount - 1)}
          y2={padTop + i * fretHeight}
          stroke="currentColor"
          strokeWidth={i === 0 && startFret === 0 ? 0 : 1}
          opacity={0.3}
        />
      ))}

      {/* String lines */}
      {Array.from({ length: stringCount }, (_, i) => (
        <line
          key={`string-${i}`}
          x1={padLeft + i * stringSpacing}
          y1={padTop}
          x2={padLeft + i * stringSpacing}
          y2={padTop + numFrets * fretHeight}
          stroke="currentColor"
          strokeWidth={1}
          opacity={0.4}
        />
      ))}

      {/* Finger positions and muted/open indicators */}
      {frets.map((fret, stringIdx) => {
        const x = padLeft + stringIdx * stringSpacing
        if (fret === -1) {
          // Muted string
          return (
            <text
              key={`m-${stringIdx}`}
              x={x}
              y={padTop - 10}
              fontSize="12"
              fill="currentColor"
              textAnchor="middle"
              opacity={0.5}
            >
              x
            </text>
          )
        }
        if (fret === 0) {
          // Open string
          return (
            <circle
              key={`o-${stringIdx}`}
              cx={x}
              cy={padTop - 12}
              r={5}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              opacity={0.5}
            />
          )
        }
        // Fretted position
        const displayFret = fret - startFret
        const y = padTop + (displayFret - 0.5) * fretHeight
        return (
          <circle key={`f-${stringIdx}`} cx={x} cy={y} r={7} fill="#f59e0b" />
        )
      })}

      {/* String labels */}
      {STRING_NAMES.map((name, i) => (
        <text
          key={`label-${i}`}
          x={padLeft + i * stringSpacing}
          y={height - 2}
          fontSize="10"
          fill="currentColor"
          textAnchor="middle"
          opacity={0.5}
        >
          {name}
        </text>
      ))}
    </svg>
  )
}

function PianoDiagram({ notes }: { notes: number[] }) {
  const noteSet = new Set(notes.map((n) => ((n % 12) + 12) % 12))
  const whiteKeys = [0, 2, 4, 5, 7, 9, 11] // C D E F G A B
  const blackKeys = [1, 3, 6, 8, 10] // C# D# F# G# A#
  const keyWidth = 22
  const keyHeight = 80
  const blackKeyWidth = 14
  const blackKeyHeight = 50
  const totalWidth = whiteKeys.length * keyWidth

  // Black key positions relative to their preceding white key
  const blackKeyOffsets: Record<number, number> = {
    1: 0,
    3: 1,
    6: 3,
    8: 4,
    10: 5,
  }

  return (
    <svg
      viewBox={`0 0 ${totalWidth + 2} ${keyHeight + 20}`}
      className="w-full max-w-[180px]"
    >
      {/* White keys */}
      {whiteKeys.map((note, i) => {
        const isActive = noteSet.has(note)
        return (
          <g key={`w-${note}`}>
            <rect
              x={i * keyWidth + 1}
              y={0}
              width={keyWidth - 1}
              height={keyHeight}
              fill={isActive ? '#f59e0b' : 'white'}
              stroke="currentColor"
              strokeWidth={1}
              rx={2}
              opacity={isActive ? 1 : 0.9}
            />
            <text
              x={i * keyWidth + keyWidth / 2}
              y={keyHeight + 14}
              fontSize="9"
              fill="currentColor"
              textAnchor="middle"
              opacity={0.5}
            >
              {PIANO_KEY_NAMES[note]}
            </text>
          </g>
        )
      })}

      {/* Black keys */}
      {blackKeys.map((note) => {
        const isActive = noteSet.has(note)
        const whiteIndex = blackKeyOffsets[note]
        const x = whiteIndex * keyWidth + keyWidth - blackKeyWidth / 2 + 1
        return (
          <rect
            key={`b-${note}`}
            x={x}
            y={0}
            width={blackKeyWidth}
            height={blackKeyHeight}
            fill={isActive ? '#f59e0b' : '#1f2937'}
            stroke={isActive ? '#d97706' : '#374151'}
            strokeWidth={1}
            rx={2}
          />
        )
      })}
    </svg>
  )
}

export function ChordDiagram({ chord, onClose }: ChordDiagramProps) {
  const { t } = useTranslation('songs')
  const [view, setView] = useState<'guitar' | 'piano'>('guitar')

  const guitarFrets = GUITAR_CHORDS[chord]
  const pianoNotes = PIANO_CHORDS[chord]
  const hasData = guitarFrets || pianoNotes

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 min-w-[220px] max-w-[280px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Chord name */}
        <h3 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-4">
          {chord}
        </h3>

        {/* View toggle */}
        <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 mb-4">
          <button
            type="button"
            onClick={() => setView('guitar')}
            className={`flex-1 px-3 py-1.5 text-sm font-medium transition-colors ${
              view === 'guitar'
                ? 'bg-amber-500 text-white'
                : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
            }`}
          >
            {t('chords.guitar')}
          </button>
          <button
            type="button"
            onClick={() => setView('piano')}
            className={`flex-1 px-3 py-1.5 text-sm font-medium transition-colors ${
              view === 'piano'
                ? 'bg-amber-500 text-white'
                : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
            }`}
          >
            {t('chords.piano')}
          </button>
        </div>

        {/* Diagram */}
        <div className="flex justify-center text-gray-900 dark:text-white">
          {!hasData ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-8">
              {t('chords.noChordData')}
            </p>
          ) : view === 'guitar' && guitarFrets ? (
            <GuitarDiagram frets={guitarFrets} />
          ) : pianoNotes ? (
            <PianoDiagram notes={pianoNotes} />
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-8">
              {t('chords.noChordData')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
