/**
 * OpenAPI 3.1 Specification for Church Hub API
 */

import { responses, securitySchemes } from './components'
import {
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
  logsPaths,
  presentationHighlightsPaths,
  presentationPaths,
  schedulesPaths,
  screensPaths,
  settingsPaths,
  songBookmarksPaths,
  songGroupsPaths,
  songHistoryPaths,
  songsPaths,
  syncPaths,
  usersPaths,
} from './paths'
import {
  backgroundMediaSchemas,
  bibleSchemas,
  commonSchemas,
  deviceSchemas,
  presentationSchemas,
  scheduleSchemas,
  screenSchemas,
  songHistorySchemas,
  songSchemas,
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
    { name: 'Categories', description: 'Song categories' },
    { name: 'Bible', description: 'Bible translations and verse management' },
    { name: 'Schedules', description: 'Schedule management' },
    {
      name: 'Screens',
      description: 'Screen configuration and rendering settings',
    },
    {
      name: 'Background Media',
      description: 'Uploaded background images and videos for screens',
    },
    { name: 'Presentation', description: 'Presentation state control' },
    { name: 'Conversion', description: 'File format conversion utilities' },
    {
      name: 'Feedback',
      description: 'Feature requests and user feedback submission',
    },
    { name: 'Logs', description: 'Application logs access' },
  ],
  paths: {
    ...healthPaths,
    ...logsPaths,
    ...settingsPaths,
    ...databasePaths,
    ...backupPaths,
    ...syncPaths,
    ...devicesPaths,
    ...authPaths,
    ...usersPaths,
    ...songsPaths,
    ...songGroupsPaths,
    ...songHistoryPaths,
    ...songBookmarksPaths,
    ...categoriesPaths,
    ...biblePaths,
    ...bibleBookmarksPaths,
    ...schedulesPaths,
    ...screensPaths,
    ...backgroundMediaPaths,
    ...presentationPaths,
    ...presentationHighlightsPaths,
    ...conversionPaths,
    ...feedbackPaths,
  },
  components: {
    securitySchemes,
    schemas: {
      ...commonSchemas,
      ...deviceSchemas,
      ...songSchemas,
      ...songHistorySchemas,
      ...bibleSchemas,
      ...scheduleSchemas,
      ...screenSchemas,
      ...backgroundMediaSchemas,
      ...presentationSchemas,
      ...userSchemas,
    },
    responses,
  },
}
