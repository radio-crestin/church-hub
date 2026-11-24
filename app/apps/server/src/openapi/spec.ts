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
  categoriesPaths,
  conversionPaths,
  databasePaths,
  devicesPaths,
  feedbackPaths,
  healthPaths,
  livestreamYouTubePaths,
  logsPaths,
  musicPaths,
  notificationsPaths,
  presentationHighlightsPaths,
  presentationPaths,
  remoteAccessPaths,
  schedulesPaths,
  screenSharePaths,
  screensPaths,
  settingsPaths,
  songBookmarksPaths,
  songGroupsPaths,
  songHistoryPaths,
  songSourcesPaths,
  songsPaths,
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
      'A client that sees it change is talking to another app, whose ids are not the ones it shows.',
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
      name: 'Feedback',
      description: 'Feature requests and user feedback submission',
    },
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
      name: 'Notifications',
      description: 'The notifications history: song syncs and app updates',
    },
  ],
  paths: {
    ...healthPaths,
    ...logsPaths,
    ...livestreamYouTubePaths,
    ...settingsPaths,
    ...databasePaths,
    ...backupPaths,
    ...syncPaths,
    ...devicesPaths,
    ...authPaths,
    ...remoteAccessPaths,
    ...usersPaths,
    ...songsPaths,
    ...songGroupsPaths,
    ...songHistoryPaths,
    ...songSourcesPaths,
    ...songBookmarksPaths,
    ...categoriesPaths,
    ...biblePaths,
    ...bibleBookmarksPaths,
    ...schedulesPaths,
    ...screenSharePaths,
    ...screensPaths,
    ...backgroundMediaPaths,
    ...presentationPaths,
    ...presentationHighlightsPaths,
    ...musicPaths,
    ...conversionPaths,
    ...feedbackPaths,
    ...analyticsPaths,
    ...notificationsPaths,
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
      ...screenSchemas,
      ...backgroundMediaSchemas,
      ...presentationSchemas,
      ...musicSchemas,
      ...userSchemas,
    },
    responses,
  },
}
