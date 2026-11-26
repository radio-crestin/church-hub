# Church Hub design system

The visual rules every screen of the client follows: tokens, type, components and states.
Open this before building or restyling any UI. The reference screens are on the design canvas: https://claude.ai/artifact/8PwuVT7h6U9rZFSCsEECYp

## Direction

This is a quiet, near-monochrome tool UI in the spirit of the Framer editor, built for an operator running a live service, often in a dim room.

- **Restyle only.** The layout and features stay as they are: songs on the left, the preview in the middle, Bookmarks / History / Programs on the right, and the Bible search flow. A new screen follows the same structure.
- **Colour has a job, or it isn't there.** There are only five hues:
  - blue for the primary action and focus
  - red for what is on the projector now
  - gold for the musical key (gamă)
  - yellow for a bookmark
  - green for a healthy connection

  Everything else is grey.
- **No decoration:**
  - no gradients, glows or fades
  - no coloured icon tiles
  - no pulsing dots
  - no entrance animations
  - no "Live" label on the current slide, because the red outline says it
- **Selection is a grey fill,** never a coloured one.

## Tokens

Both themes use the same names. The light values are darker so that every text role passes WCAG AA on its own surface.

| Token | Dark | Light | Use |
|---|---|---|---|
| `bg-app` | `#111111` | `#f1f1f1` | Window background, page header |
| `bg-panel` | `#161616` | `#ffffff` | Panels, sidebar, popovers |
| `bg-field` | `#232323` | `#f1f1f1` | Inputs, segmented controls, secondary buttons |
| `bg-raised` | `#242424` | `#ffffff` | Header secondary buttons (filled, outlined) |
| `bg-selected` | `#2b2b2b` | `#e6e6e6` | Selected row or tab |
| `bg-hover` | `#262626` | `#ececec` | Row and icon-button hover |
| `border` | `#262626` | `#e3e3e3` | Panel outlines, dividers (1px) |
| `border-strong` | `#3d3d3d` | `#cccccc` | Outline-only buttons such as "⋯" |
| `text` | `#ffffff` | `#111111` | Titles, active labels |
| `text-body` | `#e6e6e6` | `#222222` | Lyrics, verses, resting list titles |
| `text-label` | `#a6a6a6` | `#444444` | Nav labels, icons, secondary labels |
| `text-hint` | `#999999` | `#5e5e5e` | Counts, categories, placeholders, timestamps |
| `primary` | `#0070dd` | `#0070dd` | Primary button (white text), links in light |
| `focus` | `#0099ff` | `#0070dd` | Focus ring |
| `live` | `#eb5757` | `#ce2c31` | Outline, number and dot of what is on screen |
| `live-tint` | `rgba(235,87,87,0.06)` | `rgba(206,44,49,0.05)` | Fill behind the live row |
| `key` | `#f0c040` | `#7d5c00` | Musical key text ("Do major") |
| `bookmark` | `#f5c041` | `#a67c00` | Filled bookmark icon |
| `ok` | `#30d158` | `#1f9d55` | Connected or active status dot |
| `keycap-bg` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.05)` | Shortcut keycaps |
| `keycap-ring` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.12)` | Keycap outline (inset 1px) |
| `scrollbar` | `#333333`, hover `#4a4a4a` | `#c4c4c4`, hover `#a8a8a8` | Thin scrollbar thumb |
| `slide` | `#000000` | `#000000` | Projector preview, the same in both themes |
| `shadow-popover` | `0 12px 32px rgba(0,0,0,0.55)` | `0 12px 32px rgba(0,0,0,0.12)` | Popovers, menus, modals, tooltips |

Never use a raw hex or a palette class (`bg-zinc-800`, `text-purple-500`) in a component. Add or reuse a token instead.

## Type

- **UI:** Inter (bundled, works offline), on one scale:
  - 14px/20px (`text-sm`): rows, labels, buttons and desktop inputs; the body size.
  - 12px/16px (`text-xs`): meta such as counts, categories and timestamps.
  - 13px weight 500, `text-fg`: sidebar group titles.
  - 16px/24px (`text-base`): section and modal titles, and every input on a phone, so iOS never zooms.
  - 18px/28px weight 600 (`text-lg`): page titles.
  - 11px weight 500: keycaps only, the floor.
  - Nothing smaller, and no all-caps.
- **Slides:** Fira Sans 600. It appears only inside the black projector preview and its thumbnails.
- **Numbers:** counts, positions ("2 / 6") and times use `font-variant-numeric: tabular-nums`.
- **Capitals:** never use all-caps labels or eyebrow text above headings. Use sentence case everywhere.

## Shape, spacing, icons

- **Radii:** 8px for buttons, rows and fields; 10px for inputs, popovers and the program picker; 12px for panels; 5px for keycaps.
- **Heights:** rows are 32px (nav), 40–48px (lists) and 44px (mobile touch). Buttons are 32px in headers and 36px for Previous / Next.
- **Spacing:** a 4px base. Use 16px page gutters, 12px between panels and 8–10px inside panels.
- **Elevation:** declare it once. A panel is `bg-panel` with a 1px `border`, and no shadow. Only popovers get a shadow (`0 12px 32px rgba(0,0,0,0.55)` dark, `0.12` light).
- **Icons:**
  - Lucide, line only.
  - The stroke scales with size so every icon renders about 1px thick: 1.5 at 16px, 1.75 at 14px, 2 at 12px, 2.4 at 10px.
  - The Songs icon is a document with a note.

## Components

- **Logo:** the app mark (a blue `#0070dd` rounded square, radius 6/24, with a white open book) followed by "Church Hub" in Inter 600 14px. It is not a dropdown.
- **Sidebar:**
  - 248px wide, on `bg-panel`.
  - Pages are grouped under white 13px titles: Live / În desfășurare (Control Room), Library / Resurse (Songs, Bible, Presentations, Music, Gallery) and Tools / Instrumente (everything else, custom pages too), with a hairline between groups.
  - Rows are 36px tall, with an 18px line icon, a 14px label and the F-key keycap. The selected row is `bg-selected`.
  - The footer holds Feedback and Settings rows, then the user row: a 32px avatar with the name above the role.
- **Live card:**
  - Sits in the sidebar footer, above Feedback and Settings.
  - Shows the live slide at full sidebar width with the `live` outline, then the title and "Chorus 2 / 6", then two equal buttons: gray Previous and blue Next.
  - Appears on every page that has no preview of its own. Song view, Bible, the Schedule presenter and Control Room have their own preview and hide it.
- **Live row:** what is on the projector gets a `live-tint` fill, a 1px inset `live` outline, and a `live`-coloured number. It never gets a "Live" text badge.
- **The big preview never gets a red frame.** The operator rejected it. The outline marks the row in the list. Only the small sidebar live-card thumbnail carries it.
- **Preview controls:**
  - `[← keycap] Previous`: `bg-field`.
  - `Next [→ keycap]`: `primary`. It reads only "Next"; never put the next slide's name in it.
  - Hide sits next to the preview with an `esc` keycap.
- **Keycaps:** 18px tall, at least 20px wide, 11px/500, `keycap-bg` with an inset `keycap-ring`. Arrows are drawn as icons, not glyphs.
- **Header buttons:**
  - Secondary actions ("Download songs", "Load from file") use `bg-raised` with an inset `border`.
  - "⋯ More actions" is outline-only: transparent, with an inset `border-strong`, and the icon in `text`.
  - The primary action is `primary`.
- **Key and category:**
  - On the same baseline, category first in `text-hint`, then the key in `key` 500.
  - The key is never blue or light blue.
- **Bookmark:** outline icon in `text-label`; filled in `bookmark` when set.
- **Preview panel:** the live preview fits its panel in both directions, through a size container plus `--preview-reserve` for the controls. It sits centred with Previous / Next, so a tall panel never leaves dead space under the buttons. The buttons never dim while a slide change is in flight; extra presses are ignored instead.
- **Column toggle:** the hide/show button on a column divider sits at the top, level with the panel headers.
- **Start-up screen:** a static skeleton of the page being opened, in the theme's colours (three columns for Songs, Bible and Presentations; a stage for Control Room; a nav and panel for Settings). The status sits in a small card at the bottom. No full-screen spinner.
- **App icons:** the favicon, Apple touch icon and PWA icons are the app mark. The theme colour is `#0070dd`.
- **Scrollbars:** thin (10px track, 3px transparent border, radius 8) in the `scrollbar` token.
- **Focus:** a visible 1px inset `focus` ring on inputs. Keyboard focus on controls uses the same colour.

## Layout

- **Wide screens:** on screens 1360px and wider, the window never scrolls. Panels fill the height, and their lists scroll inside.
- **Narrower screens:** panels wrap.
- **Phones:** bottom tabs (Songs, Bible, Schedule, Live), a live mini-player above them, and the side panels in a bottom sheet.

## Light and dark

- **Matched features:** every screen exists in both themes, with identical features.
- **Token swaps only:** the light theme is a token swap, never a separate layout.
- **Light-mode contrast:** check light mode for contrast whenever a colour changes:
  - 4.5:1 for text
  - 3:1 for icons, outlines and keycaps
