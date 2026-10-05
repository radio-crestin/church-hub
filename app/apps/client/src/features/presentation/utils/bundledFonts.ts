/**
 * Fonts shipped inside the app, so slides look the same on macOS, Windows and
 * Linux whatever the machine has installed. Each comes in subsets loaded on
 * use; the latin-ext subset carries the Romanian diacritics (ă ș ț).
 * Importing this module registers their @font-face rules; `getFontFamilyStack`
 * puts these families first for the stored names.
 *
 * Fira Sans is the text font: its line box is 1.2em in every metric table, so
 * at the slides' 1.3 line height no engine draws a line past its text box.
 *
 * Licences (OFL-1.1): public/licenses/third-party-fonts.txt ships in the app;
 * update it when a font is added here.
 */
import '@fontsource/fira-sans/400.css'
import '@fontsource/fira-sans/400-italic.css'
import '@fontsource/fira-sans/700.css'
import '@fontsource/fira-sans/700-italic.css'
import '@fontsource-variable/montserrat/wght.css'
import '@fontsource-variable/montserrat/wght-italic.css'
import '@fontsource-variable/lora/wght.css'
import '@fontsource-variable/lora/wght-italic.css'
