/**
 * What a phone and this computer say over the tunnel's data channel
 * (mirrored in the server's service/remote-access/tunnelProtocol.ts).
 * Phone → computer: an HTTP request, or opening, writing to and closing a
 * WebSocket on the server. Computer → phone: the response, and the socket's
 * events. Bodies travel as base64.
 */
export type PhoneMessage =
  | {
      type: 'http'
      id: number
      method: string
      path: string
      headers: Array<[string, string]>
      body?: string
    }
  | { type: 'ws-open'; id: number; path: string }
  | { type: 'ws-send'; id: number; data: string }
  | { type: 'ws-close'; id: number }

export type ComputerMessage =
  | {
      type: 'http'
      id: number
      status: number
      headers: Array<[string, string]>
      body: string
    }
  | { type: 'ws-open'; id: number }
  | { type: 'ws-message'; id: number; data: string }
  | { type: 'ws-close'; id: number }
