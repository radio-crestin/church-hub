/**
 * Fonts shipped inside the app, so slides look the same on macOS, Windows and
 * Linux whatever the machine has installed. Variable fonts: one file per
 * subset covers every weight; the latin-ext subset carries the Romanian
 * diacritics (ă â î ș ț). Importing this module registers their faces;
 * `getFontFamilyStack` puts these families first for the stored names.
 */
import '@fontsource-variable/montserrat/wght.css'
import '@fontsource-variable/montserrat/wght-italic.css'
import '@fontsource-variable/lora/wght.css'
import '@fontsource-variable/lora/wght-italic.css'

import { registerSourceSans3 } from './registerSourceSans3'

registerSourceSans3()
