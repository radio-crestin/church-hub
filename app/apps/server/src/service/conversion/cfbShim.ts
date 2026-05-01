/**
 * Deferred shim for `cfb` and `codepage` so they survive
 * `bun build --compile` without slowing server boot.
 *
 * `ppt-to-text` resolves both deps lazily with `require('cf'+'b')` /
 * `require('code'+'page')` to dodge static analyzers. Bun's bundler honors
 * that by NOT bundling them, so the compiled standalone binary crashes on
 * first PPT read with `ReferenceError: CFB is not defined`.
 *
 * Loading `codepage` eagerly costs ~3s (200+ submodules), so we use a
 * dynamic import that only fires on first PPT parse. Bun's bundler still
 * includes the modules because the import paths are string literals.
 *
 * Call `await installCfbGlobals()` BEFORE loading `ppt-to-text`, since
 * its module-level code reads `cptable` immediately on evaluation.
 */
let installPromise: Promise<void> | undefined

export async function installCfbGlobals(): Promise<void> {
  if (!installPromise) {
    installPromise = (async () => {
      const [CFB, cptable] = await Promise.all([
        // @ts-expect-error - cfb has no published types
        import('cfb'),
        // @ts-expect-error - codepage has no published types
        import('codepage'),
      ])
      const g = globalThis as { CFB?: unknown; cptable?: unknown }
      g.CFB = CFB
      g.cptable = cptable
    })()
  }
  return installPromise
}
