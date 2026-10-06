/**
 * App settings that may ship as fixtures. An allow-list: a new
 * setting stays out of default-settings.json until it is added here, so a
 * token, password or per-install secret can't slip in by accident.
 * Secret fields inside these values are still set to null on dump.
 * Left out on purpose, as one machine's own setup: global_keyboard_shortcuts
 * (its keyboard and MIDI mappings) and the kiosk settings.
 */
export const SAFE_SETTING_KEYS = new Set([
  'ai_search_config',
  'bible_ai_search_config',
  'songs_ai_search_config',
  'debug_mode',
  'language',
  'live_translation_settings',
  'music_player_current_index',
  'music_player_shuffle',
  'music_player_volume',
  'search_synonyms',
  'selected_bible_translations',
  'sidebar_configuration',
  'theme',
  // Migration markers: a fresh install from these fixtures needs no rerun.
  'add_last_presented_at_v1',
  'drop_song_key_column_v1',
  'extract_keylines_from_slides_v1',
  'migrate_shortcuts_cleanup_v1',
  'migrate_shortcuts_cleanup_v2',
  'migrate_song_titles_ascii_v3',
])
