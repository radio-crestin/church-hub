/**
 * Default ports: the installed app keeps 3000 (phones and remote screens are
 * set up with it); the dev server (`bun dev`) uses 3001, so both can run at
 * once. Each kills whatever holds its port on start, so sharing one port made
 * the older window read the other app's database (T-096).
 */
export const INSTALLED_APP_PORT = 3000
export const DEV_SERVER_PORT = 3001

/** PORT when given (the desktop shell, e2e, review builds), else the default. */
export function getServerPort(): number {
  const fromEnv = Number(process.env['PORT'])
  if (fromEnv) return fromEnv
  return process.env['TAURI_MODE'] === 'true'
    ? INSTALLED_APP_PORT
    : DEV_SERVER_PORT
}
