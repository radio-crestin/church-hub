import { getSignalingBaseUrl } from '../signaling/signalingBaseUrl'

/**
 * The link listeners open: the listener page of the relay this computer is
 * on, so it finds the room wherever the relay lives.
 */
export const listenerLink = (secret: string) =>
  `${getSignalingBaseUrl()}/listen/${secret}`
