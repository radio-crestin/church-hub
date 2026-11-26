/**
 * The ports one e2e test server uses, as offsets from its own port: one row
 * each, so two features never take the same port (T-206: the LAN stand-in and
 * the fake audio server both took +1, and music.spec failed with EADDRINUSE).
 * Server n starts at TEST_PORT + n × PORTS_PER_SERVER; a task worktree's port
 * block holds two servers (app/scripts/worktree-common.ts).
 */
export const PORT_OFFSETS = {
  // The server's LAN stand-in (see apps/server/src/utils/testLanListener.ts).
  lan: 1,
  // The desktop app's audio server stand-in (fake-audio-server.ts).
  fakeAudio: 2,
  // The church's signaling relay, churchhub-backend's app (signaling-relay.ts).
  signalingRelay: 3,
  // The self-hosted cloud sync service (sync-service.ts, T-171).
  syncService: 4,
  // The public web app, built and served statically (public-app.ts, T-168).
  publicApp: 5,
} as const

export const PORTS_PER_SERVER = Math.max(...Object.values(PORT_OFFSETS)) + 1
