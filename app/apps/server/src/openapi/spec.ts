/**
 * OpenAPI 3.1 Specification for Church Hub API
 */

import { responses, securitySchemes } from './components'
import {
  analyticsPaths,
  authPaths,
  backgroundMediaPaths,
  backupPaths,
  bibleBookmarksPaths,
  biblePaths,
  bibleTopicsPaths,
  categoriesPaths,
  cloudBackupPaths,
  conversionPaths,
  databasePaths,
  devicesPaths,
  healthPaths,
  livestreamYouTubePaths,
  liveTranslationPaths,
  logsPaths,
  musicPaths,
  notificationsPaths,
  presentationHighlightsPaths,
  presentationPaths,
  remoteAccessPaths,
  scheduleItemsPaths,
  schedulesPaths,
  screenLinkPaths,
  screenSharePaths,
  screensPaths,
  secretStorePaths,
  settingsPaths,
  slideTemplatesPaths,
  songBookmarksPaths,
  songGroupsPaths,
  songHistoryPaths,
  songLibraryPaths,
  songLinkPaths,
  songSourcesPaths,
  songsPaths,
  syncOwnerPaths,
  syncPaths,
  usersPaths,
} from './paths'
import {
  backgroundMediaSchemas,
  bibleSchemas,
  commonSchemas,
  deviceSchemas,
  musicSchemas,
  presentationSchemas,
  scheduleSchemas,
  screenSchemas,
  slidesDeckSchemas,
  songHistorySchemas,
  songSchemas,
  songSourceSchemas,
  userSchemas,
} from './schemas'

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Church Hub API',
    version: '1.0.0',
    description:
      'API for Church Hub application - manage songs, schedules, presentations, and device access.\n\n' +
      'Every API response carries `X-Church-Hub-Database`: a short, stable id of the database that answered. ' +
      'It stays the same across restarts and differs between Church Hub apps (installed app, dev server, review builds). ' +
      'A client that sees it change is talking to another app, whose ids are not the ones it shows.\n\n' +
      "Cross-origin calls: the server answers with CORS only the app's own origins (the desktop and phone webviews " +
      '`tauri://localhost` and `http(s)://tauri.localhost`, pages on this machine, the server itself as the request reached it) ' +
      'and the origins listed in the `trusted_origins` app setting (comma or space separated). Any other `Origin` is refused with 403, ' +
      'and so is a write without `Origin` that the browser marks cross-site, or a form-encoded or text/plain write without ' +
      'one of `X-User-Auth`, `Authorization` or `X-Requested-With`. Clients that are not browsers send no `Origin` and are not affected.',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Installed app',
    },
    {
      url: 'http://localhost:3001',
      description: 'Development server (bun dev)',
    },
  ],
  tags: [
    { name: 'Health', description: 'Health check endpoints' },
    { name: 'Settings', description: 'Application and user settings' },
    {
      name: 'Live Translation',
      description: 'The listener link of live translation',
    },
    { name: 'Database', description: 'Database management and backup' },
    {
      name: 'Backup',
      description: 'Google Drive backup and restore',
    },
    {
      name: 'Sync',
      description: 'Real-time library sync via Google Drive',
    },
    { name: 'Devices', description: 'Device management and authorization' },
    { name: 'Authentication', description: 'Device and user authentication' },
    { name: 'Users', description: 'User accounts and permissions' },
    { name: 'Songs', description: 'Song management' },
    { name: 'Song Slides', description: 'Song slide management' },
    {
      name: 'Song History',
      description: 'Who edited a song and when, with restore',
    },
    {
      name: 'Song Sources',
      description: 'Where Song discovery imports songs from',
    },
    { name: 'Categories', description: 'Song categories' },
    { name: 'Bible', description: 'Bible translations and verse management' },
    { name: 'Schedules', description: 'Schedule management' },
    {
      name: 'Screens',
      description: 'Screen configuration and rendering settings',
    },
    {
      name: 'Remote Access',
      description:
        'Phones reaching this computer from anywhere: a WebRTC tunnel through the signaling relay',
    },
    {
      name: 'Screen Links',
      description:
        "Another device showing one of the church's screens over WebRTC, through the phone or PC that made the link",
    },
    {
      name: 'Screen Share',
      description:
        'Native screen sharing: start/stop, frame ingest, MJPEG stream for the screens',
    },
    {
      name: 'Background Media',
      description: 'Uploaded background images and videos for screens',
    },
    { name: 'Presentation', description: 'Presentation state control' },
    {
      name: 'Music',
      description: "The music library, playlists and the audio player's status",
    },
    { name: 'Conversion', description: 'File format conversion utilities' },
    {
      name: 'Analytics',
      description: 'Anonymous usage data: on/off and the install id',
    },
    { name: 'Logs', description: 'Application logs access' },
    {
      name: 'Livestream',
      description: 'YouTube broadcasts and the settings they are created with',
    },
    {
      name: 'Bible Topics',
      description:
        'Bible verses by topic (OpenBible.info topical data, CC BY 4.0)',
    },
    {
      name: 'Notifications',
      description: 'The notifications history: song syncs and app updates',
    },
    {
      name: 'Secret Store',
      description:
        'Saved passwords, API keys and tokens are sealed with a key kept outside the database',
    },
  ],
  paths: {
    ...healthPaths,
    ...logsPaths,
    ...livestreamYouTubePaths,
    ...settingsPaths,
    ...databasePaths,
    ...backupPaths,
    ...cloudBackupPaths,
    ...syncPaths,
    ...syncOwnerPaths,
    ...songLibraryPaths,
    ...songLinkPaths,
    ...devicesPaths,
    ...authPaths,
    ...remoteAccessPaths,
    ...screenLinkPaths,
    ...liveTranslationPaths,
    ...usersPaths,
    ...songsPaths,
    ...songGroupsPaths,
    ...songHistoryPaths,
    ...songSourcesPaths,
    ...songBookmarksPaths,
    ...categoriesPaths,
    ...biblePaths,
    ...bibleBookmarksPaths,
    ...bibleTopicsPaths,
    ...scheduleItemsPaths,
    ...schedulesPaths,
    ...screenSharePaths,
    ...screensPaths,
    ...slideTemplatesPaths,
    ...backgroundMediaPaths,
    ...presentationPaths,
    ...presentationHighlightsPaths,
    ...musicPaths,
    ...conversionPaths,
    ...analyticsPaths,
    ...notificationsPaths,
    ...secretStorePaths,
  },
  components: {
    securitySchemes,
    schemas: {
      ...commonSchemas,
      ...deviceSchemas,
      ...songSchemas,
      ...songHistorySchemas,
      ...songSourceSchemas,
      ...bibleSchemas,
      ...scheduleSchemas,
      ...slidesDeckSchemas,
      ...screenSchemas,
      ...backgroundMediaSchemas,
      ...presentationSchemas,
      ...musicSchemas,
      ...userSchemas,
    },
    responses,
  },
}
