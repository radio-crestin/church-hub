import { invoke } from '@tauri-apps/api/core'

export async function getServerConfig() {
  return await invoke<{
    serverPort: number
    /** The bundled server failed to start or has exited. */
    serverStopped?: boolean
  }>('get_server_config')
}

/** Restarts the bundled server; resolves once it answers /ping again. */
export async function restartServer() {
  await invoke('restart_server')
}
