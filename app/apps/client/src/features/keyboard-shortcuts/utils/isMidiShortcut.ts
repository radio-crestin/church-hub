/**
 * A MIDI binding (e.g. "midi:note_on:40") is run by the MIDI listener, never
 * by the keyboard: it is not a key the desktop shell or a page can hold.
 */
export function isMidiShortcut(shortcut: string): boolean {
  return shortcut.startsWith('midi:')
}
