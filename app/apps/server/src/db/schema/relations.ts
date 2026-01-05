import { relations } from 'drizzle-orm'

import { rolePermissions, roles, userPermissions, users } from './auth'
import { bibleBooks, bibleTranslations, bibleVerses } from './bible'
import { presentationState } from './presentation'
import { scheduleItems, schedules } from './schedules'
import { songCategories, songSlides, songs } from './songs'

// Auth relations
export const rolesRelations = relations(roles, ({ many }) => ({
  permissions: many(rolePermissions),
  users: many(users),
}))

export const rolePermissionsRelations = relations(
  rolePermissions,
  ({ one }) => ({
    role: one(roles, {
      fields: [rolePermissions.roleId],
      references: [roles.id],
    }),
  }),
)

export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, { fields: [users.roleId], references: [roles.id] }),
  permissions: many(userPermissions),
}))

export const userPermissionsRelations = relations(
  userPermissions,
  ({ one }) => ({
    user: one(users, {
      fields: [userPermissions.userId],
      references: [users.id],
    }),
  }),
)

// Songs relations
export const songCategoriesRelations = relations(
  songCategories,
  ({ many }) => ({
    songs: many(songs),
  }),
)

export const songsRelations = relations(songs, ({ one, many }) => ({
  category: one(songCategories, {
    fields: [songs.categoryId],
    references: [songCategories.id],
  }),
  slides: many(songSlides),
  scheduleItems: many(scheduleItems),
}))

export const songSlidesRelations = relations(songSlides, ({ one }) => ({
  song: one(songs, { fields: [songSlides.songId], references: [songs.id] }),
}))

// Schedule relations
export const schedulesRelations = relations(schedules, ({ many }) => ({
  items: many(scheduleItems),
}))

export const scheduleItemsRelations = relations(scheduleItems, ({ one }) => ({
  schedule: one(schedules, {
    fields: [scheduleItems.scheduleId],
    references: [schedules.id],
  }),
  song: one(songs, { fields: [scheduleItems.songId], references: [songs.id] }),
}))

// Presentation relations
export const presentationStateRelations = relations(
  presentationState,
  ({ one }) => ({
    currentSongSlide: one(songSlides, {
      fields: [presentationState.currentSongSlideId],
      references: [songSlides.id],
      relationName: 'currentSlide',
    }),
    lastSongSlide: one(songSlides, {
      fields: [presentationState.lastSongSlideId],
      references: [songSlides.id],
      relationName: 'lastSlide',
    }),
  }),
)

// Bible relations
export const bibleTranslationsRelations = relations(
  bibleTranslations,
  ({ many }) => ({
    books: many(bibleBooks),
    verses: many(bibleVerses),
  }),
)

export const bibleBooksRelations = relations(bibleBooks, ({ one, many }) => ({
  translation: one(bibleTranslations, {
    fields: [bibleBooks.translationId],
    references: [bibleTranslations.id],
  }),
  verses: many(bibleVerses),
}))

export const bibleVersesRelations = relations(bibleVerses, ({ one }) => ({
  translation: one(bibleTranslations, {
    fields: [bibleVerses.translationId],
    references: [bibleTranslations.id],
  }),
  book: one(bibleBooks, {
    fields: [bibleVerses.bookId],
    references: [bibleBooks.id],
  }),
}))
