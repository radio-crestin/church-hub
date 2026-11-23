/**
 * The address the server listens on. Every interface by default, so phones
 * and other computers on the church network reach it. The e2e suite sets
 * CHURCH_HUB_LISTEN_HOST=127.0.0.1: a test server never opens a LAN port, so
 * Windows raises no firewall prompt for it (T-193).
 */
export function getListenHost(): string {
  return process.env.CHURCH_HUB_LISTEN_HOST || '0.0.0.0'
}
