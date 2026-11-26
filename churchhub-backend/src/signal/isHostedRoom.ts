import { HOSTED_ROOM_PATTERN } from './constants'

/** Whether the room id is one a host key opens (see hostedRoomId). */
export const isHostedRoom = (secret: string) => HOSTED_ROOM_PATTERN.test(secret)
