import { SourceDiscovery } from './SourceDiscovery'
import { SourcePicker } from './SourcePicker'
import { useSongSources } from '../hooks/useSongSources'

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
  const { data: sources = [] } = useSongSources()
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
        />
      }
    />
  )
}
