import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { useChurchSongs } from './useChurchSongs'
import type { PcLink } from './usePcLink'
import { loadPcSongPage, searchPcSongs } from '../service/pcSongs'
import type { SongRow } from '../service/types'
import { matchesSearch } from '../utils/matchesSearch'

export interface SongRows {
  rows: SongRow[] | undefined
  /** Every song the church has. */
  total: number
  isLoading: boolean
  isError: boolean
}

/**
 * The songs the list shows for a search: live from the PC (its page by
 * title, or its own search) while it is reached, else the whole cloud
 * library, filtered here.
 */
export function useSongRows(
  readUrl: string,
  link: PcLink,
  query: string,
): SongRows {
  const live = link === 'live'
  const search = query.trim()
  const cloud = useChurchSongs(readUrl, !live)
  const page = useQuery({
    queryKey: ['pc-songs', 'page'],
    queryFn: loadPcSongPage,
    enabled: live,
  })
  const found = useQuery({
    queryKey: ['pc-songs', 'search', search],
    queryFn: () => searchPcSongs(search),
    enabled: live && !!search,
    placeholderData: keepPreviousData,
  })
  const cloudRows = useMemo(
    () =>
      cloud.data
        ?.filter((song) => matchesSearch(song, query))
        .map(({ uuid, title, author }) => ({ key: uuid, title, author })),
    [cloud.data, query],
  )

  if (!live) {
    return {
      rows: cloudRows,
      total: cloud.data?.length ?? 0,
      isLoading: cloud.isLoading,
      isError: cloud.isError,
    }
  }
  const current = search ? found : page
  return {
    rows: search ? found.data : page.data?.rows,
    total: page.data?.total ?? 0,
    isLoading: current.isLoading,
    isError: current.isError,
  }
}
