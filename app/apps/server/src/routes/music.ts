import type {
  AddFolderInput,
  AddToPlaylistInput,
  GetFilesInput,
  RenameFolderInput,
  ReorderPlaylistItemsInput,
  UpsertPlaylistInput,
} from '../service/music'
import {
  addFolder,
  addToPlaylist,
  deletePlaylist,
  getFileById,
  getFiles,
  getFolderById,
  getFolders,
  getPlaylistById,
  getPlaylists,
  removeFolder,
  removeFromPlaylist,
  renameFolder,
  reorderPlaylistItems,
  syncFolder,
  upsertPlaylist,
} from '../service/music'
import { getAudioStatus } from '../service/music-player'

type HandleCors = (req: Request, res: Response) => Response

export async function handleMusicRoutes(
  req: Request,
  url: URL,
  handleCors: HandleCors,
): Promise<Response | null> {
  // ========== PLAYER STATUS ==========

  // GET /api/music/player/status - Get audio player status
  if (req.method === 'GET' && url.pathname === '/api/music/player/status') {
    const status = getAudioStatus()
    return handleCors(
      req,
      new Response(JSON.stringify({ data: status }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  // ========== FOLDERS ==========

  // GET /api/music/folders - List all folders
  if (req.method === 'GET' && url.pathname === '/api/music/folders') {
    const folders = getFolders()
    return handleCors(
      req,
      new Response(JSON.stringify({ data: folders }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  // POST /api/music/folders - Add a new folder
  if (req.method === 'POST' && url.pathname === '/api/music/folders') {
    try {
      const body = (await req.json()) as AddFolderInput
      if (!body.path) {
        return handleCors(
          req,
          new Response(JSON.stringify({ error: 'Missing path' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      const folder = await addFolder(body)
      if (!folder) {
        return handleCors(
          req,
          new Response(JSON.stringify({ error: 'Failed to add folder' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      return handleCors(
        req,
        new Response(JSON.stringify({ data: folder }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch {
      return handleCors(
        req,
        new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
  }

  // DELETE /api/music/folders/:id - Remove a folder
  const deleteFolderMatch = url.pathname.match(/^\/api\/music\/folders\/(\d+)$/)
  if (req.method === 'DELETE' && deleteFolderMatch?.[1]) {
    const id = parseInt(deleteFolderMatch[1], 10)
    const result = removeFolder(id)
    if (!result.success) {
      return handleCors(
        req,
        new Response(JSON.stringify({ error: result.error }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
    return handleCors(
      req,
      new Response(JSON.stringify({ data: { success: true } }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  // PUT /api/music/folders/:id - Rename a folder
  const renameFolderMatch = url.pathname.match(/^\/api\/music\/folders\/(\d+)$/)
  if (req.method === 'PUT' && renameFolderMatch?.[1]) {
    try {
      const id = parseInt(renameFolderMatch[1], 10)
      const body = (await req.json()) as Omit<RenameFolderInput, 'id'>
      if (!body.name) {
        return handleCors(
          req,
          new Response(JSON.stringify({ error: 'Missing name' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      const result = renameFolder({ id, name: body.name })
      if (!result.success) {
        return handleCors(
          req,
          new Response(JSON.stringify({ error: result.error }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      return handleCors(
        req,
        new Response(JSON.stringify({ data: result.data }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch {
      return handleCors(
        req,
        new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
  }

  // POST /api/music/folders/:id/sync - Sync a folder
  const syncFolderMatch = url.pathname.match(
    /^\/api\/music\/folders\/(\d+)\/sync$/,
  )
  if (req.method === 'POST' && syncFolderMatch?.[1]) {
    const id = parseInt(syncFolderMatch[1], 10)
    const folder = getFolderById(id)
    if (!folder) {
      return handleCors(
        req,
        new Response(JSON.stringify({ error: 'Folder not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
    const result = await syncFolder(id)
    return handleCors(
      req,
      new Response(JSON.stringify({ data: result }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  // ========== FILES ==========

  // GET /api/music/files - List files with optional filtering
  if (req.method === 'GET' && url.pathname === '/api/music/files') {
    const input: GetFilesInput = {}
    const folderId = url.searchParams.get('folderId')
    const search = url.searchParams.get('search')
    const artist = url.searchParams.get('artist')
    const album = url.searchParams.get('album')
    const limit = url.searchParams.get('limit')
    const offset = url.searchParams.get('offset')

    if (folderId) input.folderId = parseInt(folderId, 10)
    if (search) input.search = search
    if (artist) input.artist = artist
    if (album) input.album = album
    if (limit) input.limit = parseInt(limit, 10)
    if (offset) input.offset = parseInt(offset, 10)

    const files = getFiles(input)
    return handleCors(
      req,
      new Response(JSON.stringify({ data: files }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  // GET /api/music/files/:id - Get a single file
  const getFileMatch = url.pathname.match(/^\/api\/music\/files\/(\d+)$/)
  if (req.method === 'GET' && getFileMatch?.[1]) {
    const id = parseInt(getFileMatch[1], 10)
    const file = getFileById(id)
    if (!file) {
      return handleCors(
        req,
        new Response(JSON.stringify({ error: 'File not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
    return handleCors(
      req,
      new Response(JSON.stringify({ data: file }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  // ========== PLAYLISTS ==========

  // GET /api/music/playlists - List all playlists
  if (req.method === 'GET' && url.pathname === '/api/music/playlists') {
    const playlists = getPlaylists()
    return handleCors(
      req,
      new Response(JSON.stringify({ data: playlists }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  // POST /api/music/playlists - Create or update a playlist
  if (req.method === 'POST' && url.pathname === '/api/music/playlists') {
    try {
      const body = (await req.json()) as UpsertPlaylistInput
      if (!body.name) {
        return handleCors(
          req,
          new Response(JSON.stringify({ error: 'Missing name' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      const playlist = upsertPlaylist(body)
      if (!playlist) {
        return handleCors(
          req,
          new Response(JSON.stringify({ error: 'Failed to save playlist' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      return handleCors(
        req,
        new Response(JSON.stringify({ data: playlist }), {
          status: body.id ? 200 : 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch {
      return handleCors(
        req,
        new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
  }

  // GET /api/music/playlists/:id - Get playlist with items
  const getPlaylistMatch = url.pathname.match(
    /^\/api\/music\/playlists\/(\d+)$/,
  )
  if (req.method === 'GET' && getPlaylistMatch?.[1]) {
    const id = parseInt(getPlaylistMatch[1], 10)
    const playlist = getPlaylistById(id)
    if (!playlist) {
      return handleCors(
        req,
        new Response(JSON.stringify({ error: 'Playlist not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
    return handleCors(
      req,
      new Response(JSON.stringify({ data: playlist }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  // DELETE /api/music/playlists/:id - Delete a playlist
  const deletePlaylistMatch = url.pathname.match(
    /^\/api\/music\/playlists\/(\d+)$/,
  )
  if (req.method === 'DELETE' && deletePlaylistMatch?.[1]) {
    const id = parseInt(deletePlaylistMatch[1], 10)
    const result = deletePlaylist(id)
    if (!result.success) {
      return handleCors(
        req,
        new Response(JSON.stringify({ error: result.error }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
    return handleCors(
      req,
      new Response(JSON.stringify({ data: { success: true } }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  // ========== PLAYLIST ITEMS ==========

  // POST /api/music/playlists/:id/items - Add item to playlist
  const addItemMatch = url.pathname.match(
    /^\/api\/music\/playlists\/(\d+)\/items$/,
  )
  if (req.method === 'POST' && addItemMatch?.[1]) {
    try {
      const playlistId = parseInt(addItemMatch[1], 10)
      const body = (await req.json()) as Omit<AddToPlaylistInput, 'playlistId'>
      if (!body.fileId) {
        return handleCors(
          req,
          new Response(JSON.stringify({ error: 'Missing fileId' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      const result = addToPlaylist({ ...body, playlistId })
      if (!result.success) {
        return handleCors(
          req,
          new Response(JSON.stringify({ error: result.error }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      return handleCors(
        req,
        new Response(JSON.stringify({ data: { success: true } }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch {
      return handleCors(
        req,
        new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
  }

  // DELETE /api/music/playlists/:id/items/:itemId - Remove item from playlist
  const removeItemMatch = url.pathname.match(
    /^\/api\/music\/playlists\/(\d+)\/items\/(\d+)$/,
  )
  if (req.method === 'DELETE' && removeItemMatch?.[1] && removeItemMatch?.[2]) {
    const playlistId = parseInt(removeItemMatch[1], 10)
    const itemId = parseInt(removeItemMatch[2], 10)
    const result = removeFromPlaylist(playlistId, itemId)
    if (!result.success) {
      return handleCors(
        req,
        new Response(JSON.stringify({ error: result.error }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
    return handleCors(
      req,
      new Response(JSON.stringify({ data: { success: true } }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  // PUT /api/music/playlists/:id/items/reorder - Reorder playlist items
  const reorderMatch = url.pathname.match(
    /^\/api\/music\/playlists\/(\d+)\/items\/reorder$/,
  )
  if (req.method === 'PUT' && reorderMatch?.[1]) {
    try {
      const playlistId = parseInt(reorderMatch[1], 10)
      const body = (await req.json()) as ReorderPlaylistItemsInput
      if (!body.itemIds || !Array.isArray(body.itemIds)) {
        return handleCors(
          req,
          new Response(JSON.stringify({ error: 'Missing itemIds array' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      const result = reorderPlaylistItems(playlistId, body)
      if (!result.success) {
        return handleCors(
          req,
          new Response(JSON.stringify({ error: result.error }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      return handleCors(
        req,
        new Response(JSON.stringify({ data: { success: true } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch {
      return handleCors(
        req,
        new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
  }

  // No matching route
  return null
}
