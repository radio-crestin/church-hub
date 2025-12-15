import { invoke } from '@tauri-apps/api/core'

export async function getServerConfig() {
  return await invoke<{
    serverPort: number
  }>('get_server_config')
}
