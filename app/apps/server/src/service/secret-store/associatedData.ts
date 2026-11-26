import { describePlace, type SecretPlace } from './secretPlace'

/** What a value is sealed to: the app, the format version and its place. */
export const associatedData = (place: SecretPlace) =>
  Buffer.from(`church-hub:v1:${describePlace(place)}`, 'utf8')
