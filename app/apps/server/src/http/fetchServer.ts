import type { Server } from 'bun'

import type { WebSocketData } from '../websocket'

/** What the fetch handler needs of the server: Bun's, or a browser worker's stand-in. */
export type FetchServer = Pick<
  Server<WebSocketData>,
  'upgrade' | 'requestIP' | 'port'
>
