/**
 * OpenAPI 3.1 Specification for Church Hub API
 */

import { responses, securitySchemes } from './components'
import {
  authPaths,
  backupPaths,
  biblePaths,
  categoriesPaths,
  conversionPaths,
  databasePaths,
  devicesPaths,
  feedbackPaths,
  healthPaths,
  logsPaths,
  presentationPaths,
  schedulesPaths,
  screensPaths,
  settingsPaths,
  songGroupsPaths,
  songsPaths,
  syncPaths,
  usersPaths,
} from './paths'
import {
  bibleSchemas,
  commonSchemas,
  deviceSchemas,
  presentationSchemas,
  scheduleSchemas,
  screenSchemas,
  songSchemas,
  userSchemas,
} from './schemas'

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Church Hub API',
    version: '1.0.0',
    description:
      'API for Church Hub application - manage songs, schedules, presentations, and device access',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server',
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
    { name: 'Categories', description: 'Song categories' },
    { name: 'Bible', description: 'Bible translations and verse management' },
    { name: 'Schedules', description: 'Schedule management' },
    {
      name: 'Screens',
      description: 'Screen configuration and rendering settings',
    },
    { name: 'Presentation', description: 'Presentation state control' },
    { name: 'Conversion', description: 'File format conversion utilities' },
    { name: 'Feedback', description: 'User feedback submission' },
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
    ...categoriesPaths,
    ...biblePaths,
    ...schedulesPaths,
    ...screensPaths,
    ...presentationPaths,
    ...conversionPaths,
    ...feedbackPaths,
  },
  components: {
    securitySchemes,
    schemas: {
      ...commonSchemas,
      ...deviceSchemas,
      ...songSchemas,
      ...bibleSchemas,
      ...scheduleSchemas,
      ...screenSchemas,
      ...presentationSchemas,
      ...userSchemas,
    },
    responses,
  },
}
