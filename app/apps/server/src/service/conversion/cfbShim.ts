/**
 * Static-import shim for `cfb` and `codepage` so they survive
 * `bun build --compile`.
 *
 * `ppt-to-text` resolves both deps lazily with `require('cf'+'b')` /
 * `require('code'+'page')` to dodge static analyzers. Bun's bundler
 * honors that by NOT bundling them, so the compiled standalone binary
 * crashes on first PPT read with `ReferenceError: CFB is not defined`
 * (and then `cptable is not defined`).
 *
 * This file imports them statically (the bundler sees them) and exposes
 * them on `globalThis`, where the `typeof X === 'undefined'` checks in
 * ppt-to-text find them and skip the runtime require.
 */
// @ts-expect-error - cfb has no published types
import * as CFB from 'cfb'
// @ts-expect-error - codepage has no published types
import * as cptable from 'codepage'

const g = globalThis as { CFB?: unknown; cptable?: unknown }
g.CFB = CFB
g.cptable = cptable
