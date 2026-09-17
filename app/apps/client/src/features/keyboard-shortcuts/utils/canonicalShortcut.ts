/**
 * Names the desktop shell's shortcut parser (global-hotkey) accepts for one
 * modifier, all folded to one. A key press in the page cannot tell Command from
 * Control either — `shortcutFromKeyboardEvent` writes both as
 * `CommandOrControl` — so neither can this.
 */
const MODIFIERS: Record<string, string> = {
  OPTION: 'ALT',
  ALT: 'ALT',
  SHIFT: 'SHIFT',
  CONTROL: 'CMDORCTRL',
  CTRL: 'CMDORCTRL',
  COMMAND: 'CMDORCTRL',
  CMD: 'CMDORCTRL',
  SUPER: 'CMDORCTRL',
  META: 'CMDORCTRL',
  COMMANDORCONTROL: 'CMDORCTRL',
  COMMANDORCTRL: 'CMDORCTRL',
  CMDORCTRL: 'CMDORCTRL',
  CMDORCONTROL: 'CMDORCTRL',
}

const MODIFIER_ORDER = ['CMDORCTRL', 'ALT', 'SHIFT']

/** Key names the parser takes as another spelling of a page key's name. */
const KEY_ALIASES: Record<string, string> = {
  UP: 'ARROWUP',
  DOWN: 'ARROWDOWN',
  LEFT: 'ARROWLEFT',
  RIGHT: 'ARROWRIGHT',
  ESC: 'ESCAPE',
  ' ': 'SPACE',
}

function canonicalKey(key: string): string {
  const upper = key.toUpperCase()
  if (KEY_ALIASES[upper]) return KEY_ALIASES[upper]
  // "KeyA" and "Digit1" are the parser's names for "A" and "1".
  const physical = /^(?:KEY([A-Z])|DIGIT([0-9]))$/.exec(upper)
  return physical ? (physical[1] ?? physical[2]) : upper
}

/**
 * One spelling for every way of writing the same shortcut: "Down",
 * "ArrowDown" and "arrowdown" are one key, and "Cmd+Shift+Right" is
 * "CommandOrControl+Shift+ArrowRight". The page writes a key press one way
 * (`shortcutFromKeyboardEvent`), while a stored shortcut may use any name the
 * shell accepts, so the two arrivals of one press are compared through this.
 */
export function canonicalShortcut(shortcut: string): string {
  const modifiers = new Set<string>()
  let key = ''
  for (const token of shortcut.split('+')) {
    // A token of spaces only is the Space key as a page writes it.
    const name = token.trim() || token
    if (!name) continue
    const modifier = MODIFIERS[name.toUpperCase()]
    if (modifier) modifiers.add(modifier)
    else key = canonicalKey(name)
  }
  return [...MODIFIER_ORDER.filter((m) => modifiers.has(m)), key].join('+')
}
