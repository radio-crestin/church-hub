# TODO - New Issues (Feb-Mar 2026)

> **Workflow for each task:** For bugs, first write a Playwright test (or unit test) that reproduces the problem and confirms it fails. Then write a test that defines the expected behavior. Only after both tests are in place, start implementing the fix until all tests pass. For features, write tests that define the expected behavior first, then implement until they pass.

## Bugs

### Search & Scoring (major)
- [x] **Fix song search scoring system** - Display the score in results. Fix scoring so that songs with a key line get higher priority. Completely ignore diacritics (replace with normal characters). Match title first, then slide content. Add shown/played count into the scoring formula. Do all scoring efficiently at SQL level. Covers: song #034 not found, "cand Isus Hristos m-a mantuit" not found, "l-am cautat si l-am gasit" not found *(Fixed: search.ts implements diacritics removal, title/content weighting, key line boost, presentation count boost; SongCard.tsx displays score)*
- [ ] **Clear search filters on new search** - When opening a new search, the previous filters should be cleared automatically
- [ ] **Bible search freezes the app** - Searching in the Bible blocks/freezes the entire application

### Songs Page Navigation
- [ ] **Remember last songs page selection** - Keep the last selection in memory. If a song is currently displayed/presented, always navigate to that song's page. Otherwise, restore the last visited songs page state. Persist across tab switches (e.g. going to another page and coming back)

### Presentation / Display
- [x] **PPTX import dialog missing i18n translations** - When importing a PPTX, the import dialog doesn't have translated strings *(Fixed: translations in both EN and RO songs.json under pptxImport key)*
- [ ] **Bible chapter transition bugs** - When pressing down to navigate to the next chapter, the left sidebar doesn't update and the presentation slides start flickering/switching randomly between the two chapter states. Fix the entire Bible chapter transition flow so the presentation slide works 100% correctly
- [x] **Hide animation flicker** - When hiding a song, there's a flicker/glitch (jumps too quickly to the first slide) *(Fixed: AnimatedElement.tsx eliminates gap between exit/enter animations)*

### PPTX Import
- [x] **Fix PPTX import slide comparison** - Currently only checks by title. Must also compare all slide content and notify if the content differs from the existing song. When importing a song with a duplicate title, auto-number it with (2), (3), etc. to ensure unique titles *(Fixed: PptxImportDialog.tsx compares content + auto-numbers duplicate titles)*

### Music Player
- [ ] **Music player stuck on Windows** - On Windows, the player gets stuck after pausing or when controlled remotely from another device. ~~Also: persist player settings (volume, shuffle/random, etc.) across app restarts so the user gets the exact same state~~ *(Settings persistence fixed: mpv-player.ts persists volume, shuffle, currentIndex to DB and restores on startup)*

### Other Bugs
- [ ] **WhatsApp links don't open** - Links shared via WhatsApp embed don't open (probably a webview/embed bug)

## Features

### Search Improvements
- [ ] **Add search in bookmarks and Bible history** - Add search functionality to both the song bookmarks list (by title and content) and the Bible history (by reference and verse content)

### Slide Designer (generic system)
- [ ] **Generic slide designer based on type/monitor/scene** - Create a system in the slide designer where you can design/override a slide's appearance based on 3 axes: slide type (song, Bible, announcement, etc.), monitor type (main, stage, livestream), and OBS scene. This allows custom overrides per combination

### Song Editing
- [ ] **Inline slide editing from preview** - Add an edit button on any song page that allows changing the slide content directly from the preview. When saving a change, do NOT trigger animations — just bypass and display the updated content immediately
- [ ] **Edit key line from schedule page** - Allow changing a song's key line directly from the schedule/program page

### Songs
- [ ] **Bookmarked songs list** - Add a "Bookmarked Songs" view where the user manually adds songs to a list. Group entries by day. Allow: deleting all bookmarks at once, reordering items via drag & drop, copying song text. This replaces the old "history" concept — it's user-curated, not automatic
- [ ] **Add key/scale to generated PPTs** - Include the musical key in exported PowerPoint files, and maximize font size
- [ ] **Add sorting options for songs** - Sort by: last played, most played, etc.
- [ ] **Show category for duplicate titles** - When two songs have the same title, show the category in parentheses to differentiate
- [ ] **Show notification for "last played songs"** - Add an indicator that the displayed songs are the most recently played

### Schedule/Program
- [x] **Collapse all button in schedule** - Add a button to collapse all items in the schedule, and persist the collapsed state when switching tabs *(Fixed: SchedulePresenter.tsx with collapseAllTrigger + state persistence)*
- [ ] **Smarter "add to schedule" flow** - If no schedule exists for today, show dialog to create one. If one already exists, just add directly (no confirmation dialog). Show an "edit" tooltip in bottom-right that stays for 5 seconds

### UI/UX
- [ ] **Mobile: make filter smaller, search bigger** - On the mobile song search page, reduce the filter size and increase the search input size
- [ ] **Mobile: add back button on songs page** - No back button on mobile when viewing songs
- [ ] **Preload assets for first slide** - Optimize first slide presentation by preloading assets

### Audio / Mixer
- [ ] **Post-fader audio routing fix** - Post-fader signal reaching room speakers. Needs to be addressed in the audio mixer automation configuration
- [ ] **OBS error: av_interleaved_write_frame_failed** - Investigate and fix the I/O error during streaming (likely mixer/OBS related)

### Hardware / Non-Software (out of scope)
- ~~Buy 2 HDMI splitters + pulpit lamp~~ *(hardware purchase)*
- ~~Buy OnePlus Dash charger~~ *(hardware purchase)*
- ~~Add keyboard feet for Bible station~~ *(physical setup)*
