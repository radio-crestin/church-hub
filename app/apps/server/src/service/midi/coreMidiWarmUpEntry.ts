import { COREMIDI_WARM_UP_FLAG } from './coreMidiWarmUpFlag'
import { createCoreMidiClient } from './createCoreMidiClient'

// Runs only in the short-lived helper started by warmUpCoreMidi. It is the
// first import of the server entry, so it exits before the rest of the
// server loads (no port, no database). Exit 0: CoreMIDI gave a client.
if (process.argv.includes(COREMIDI_WARM_UP_FLAG)) {
  process.exit(createCoreMidiClient() === 0 ? 0 : 2)
}
