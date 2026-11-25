/** biome-ignore-all lint/suspicious/noConsole: build script output */
import { $ } from 'bun'

// The RUNPATH linuxdeploy gives every ELF file in the AppImage's usr/bin.
const APPIMAGE_RUNPATH = '$ORIGIN/../lib'

/**
 * Gives the Linux sidecar the RUNPATH the AppImage bundler would set.
 *
 * linuxdeploy (Tauri's AppImage step) sets RUNPATH on every ELF file in
 * usr/bin with the patchelf 0.8 it bundles, which corrupts a Bun-compiled
 * executable: it segfaults on launch, and the bundling stops where ldd runs
 * it (T-196). Set here with the system's patchelf (0.9 or newer), the
 * RUNPATH is already what linuxdeploy wants, and it leaves the file as it is.
 * The sidecar links only libc, so the RUNPATH changes nothing else.
 */
export async function setLinuxRunpath(binary: string) {
  if (!Bun.which('patchelf')) {
    console.warn(
      '\x1b[33mpatchelf not found: an AppImage built from this sidecar will crash. Install patchelf (apt install patchelf) before bundling one; the .deb is not affected.\x1b[0m',
    )
    return
  }
  console.log(
    `\x1b[34mSetting the sidecar's RUNPATH to ${APPIMAGE_RUNPATH}...\x1b[0m`,
  )
  await $`patchelf --set-rpath ${APPIMAGE_RUNPATH} ${binary}`
}
