import { SourceDiscovery } from './SourceDiscovery'
import { SourcePicker } from './SourcePicker'
import { useSongDiscovery } from '../context/SongDiscoveryContext'
import { useSongSources } from '../hooks/useSongSources'
import { useOpenedSongFileSources } from '../opened-files/openedSongFiles'

interface SongDiscoveryScreenProps {
  /** The source to show; the first one when missing or unknown. */
  sourceId?: string
  onSourceChange: (sourceId: string) => void
  onBack?: () => void
}

/**
 * Song discovery: pick a source, then review and import its songs the
 * library lacks. Each source gets a fresh staging list (keyed by its id).
 */
export function SongDiscoveryScreen({
  sourceId,
  onSourceChange,
  onBack,
}: SongDiscoveryScreenProps) {
  const { data: serverSources = [] } = useSongSources()
  const openedFiles = useOpenedSongFileSources()
  const { sourceUpdates, isChecking, checkNow } = useSongDiscovery()
  const updates = new Map(sourceUpdates.map((u) => [u.id, u]))
  const sources = [...serverSources, ...openedFiles]
  const source = sources.find((s) => s.id === sourceId) ?? sources[0]
  if (!source) return null

  return (
    <SourceDiscovery
      key={source.id}
      source={source}
      onBack={onBack}
      sourcePicker={
        <SourcePicker
          sources={sources}
          selectedId={source.id}
          onSelect={onSourceChange}
          updates={updates}
          isChecking={isChecking}
          onCheckAll={() => void checkNow({ force: true })}
        />
      }
    />
  )
}
