import { File as NodeFile } from 'node:buffer'

/**
 * A File whose bytes can be read: jsdom's File has no `arrayBuffer()` (every
 * browser has), Node's does.
 */
export function makeReadableFile(
  parts: (Uint8Array | string)[],
  name: string,
  type: string,
): File {
  return new NodeFile(parts, name, { type }) as unknown as File
}
