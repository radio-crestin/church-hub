import { inspectSecret } from './inspectSecret'
import { describePlace, type SecretPlace } from './secretPlace'
import { createLogger } from '../../utils/logger'

const logger = createLogger('secret-store')

/**
 * The secret stored at `place`, or null when this server can't open it
 * (sealed on another computer, altered, or the data key is locked): the
 * feature then acts as not set up. A value not sealed yet is returned as it
 * is and logged; the next start seals it (sealStoredSecrets).
 */
export function openSecret(stored: string, place: SecretPlace): string | null {
  const seen = inspectSecret(stored, place)
  switch (seen.state) {
    case 'empty':
      return ''
    case 'open':
      return seen.value
    case 'plain':
      logger.warning(`Unsealed secret at ${describePlace(place)}`)
      return seen.value
    case 'no-key':
      logger.warning(
        `Secret at ${describePlace(place)} needs data key ${seen.keyId}, which this server doesn't have`,
      )
      return null
    case 'broken':
      logger.warning(`Secret at ${describePlace(place)} doesn't open`)
      return null
  }
}
