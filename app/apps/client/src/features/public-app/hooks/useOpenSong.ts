import { useQuery } from '@tanstack/react-query'

import { useChurchSongs } from './useChurchSongs'
import type { PcLink } from './usePcLink'
import { loadPcSong } from '../service/pcSongs'
import type { ChurchSong } from '../service/types'

/** The song a row's key opens: as the PC has it now, or from the cloud. */
export function useOpenSong(
  readUrl: string,
  link: PcLink,
  key: string | null,
): ChurchSong | undefined {
  const live = link === 'live'
  const cloud = useChurchSongs(readUrl, !live)
  const pc = useQuery({
    queryKey: ['pc-songs', 'song', key],
    queryFn: () => loadPcSong(key ?? ''),
    enabled: live && key !== null,
  })
  if (key === null) return undefined
  return live ? pc.data : cloud.data?.find((song) => song.uuid === key)
}
