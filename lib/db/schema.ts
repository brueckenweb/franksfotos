/**
 * FranksFotos – Drizzle ORM Schema für MariaDB
 * Vollständiges Datenbankschema für die Fotogalerie-CMS
 */

import {
  mysqlTable,
  varchar,
  text,
  int,
  bigint,
  boolean,
  timestamp,
  json,
  index,
  primaryKey,
  uniqueIndex,
  type AnyMySqlColumn,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

// ============================================================
// BENUTZER & RECHTE
// ============================================================

/**
 * Benutzer
 */
export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  avatar: varchar("avatar", { length: 500 }),
  isActive: boolean("is_active").default(true).notNull(),
  isMainAdmin: boolean("is_main_admin").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  emailIdx: uniqueIndex("users_email_idx").on(table.email),
}));

/**
 * Gruppen (Admin, User, Familie, Öffentlich)
 */
export const groups = mysqlTable("groups", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  description: text("description"),
  isSystem: boolean("is_system").default(false).notNull(), // Systemgruppen können nicht gelöscht werden
  sortOrder: int("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * User ↔ Gruppen (many-to-many)
 */
export const userGroups = mysqlTable("user_groups", {
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  groupId: int("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  assignedBy: int("assigned_by").references(() => users.id),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.groupId] }),
}));

/**
 * Rechte/Berechtigungen
 */
export const permissions = mysqlTable("permissions", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull().unique(), // z.B. "upload_photos"
  label: varchar("label", { length: 150 }).notNull(),        // z.B. "Fotos hochladen"
  description: text("description"),
  category: varchar("category", { length: 50 }).notNull(),   // z.B. "media", "admin", "social"
});

/**
 * Gruppen-Rechte (welche Gruppe hat welches Recht)
 */
export const groupPermissions = mysqlTable("group_permissions", {
  groupId: int("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  permissionId: int("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.groupId, table.permissionId] }),
}));

/**
 * User-Rechte (individuelle Overrides)
 * is_granted=true  → User hat das Recht (auch wenn Gruppe es nicht hat)
 * is_granted=false → User hat das Recht NICHT (auch wenn Gruppe es hat)
 */
export const userPermissions = mysqlTable("user_permissions", {
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  permissionId: int("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
  isGranted: boolean("is_granted").notNull().default(true),
  grantedBy: int("granted_by").references(() => users.id),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.permissionId] }),
}));

// ============================================================
// ALBEN (hierarchisch, unbegrenzte Tiefe)
// ============================================================

/**
 * Alben – Self-Referencing für beliebige Hierarchietiefe
 */
export const albums = mysqlTable("albums", {
  id: int("id").primaryKey().autoincrement(),
  parentId: int("parent_id").references((): AnyMySqlColumn => albums.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 300 }).notNull(),
  description: text("description"),
  coverPhotoId: int("cover_photo_id"),    // wird nach photos/videos gesetzt
  coverVideoId: int("cover_video_id"),
  sortOrder: int("sort_order").default(0).notNull(),
  childSortMode: varchar("child_sort_mode", { length: 10 }).default("order").notNull(), // 'order' | 'alpha'
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: int("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  parentIdx: index("albums_parent_idx").on(table.parentId),
  slugIdx: index("albums_slug_idx").on(table.slug),
}));

/**
 * Album-Sichtbarkeit: Welche Gruppen können dieses Album sehen
 */
export const albumVisibility = mysqlTable("album_visibility", {
  albumId: int("album_id").notNull().references(() => albums.id, { onDelete: "cascade" }),
  groupId: int("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.albumId, table.groupId] }),
}));

// ============================================================
// FOTOS
// ============================================================

/**
 * Fotos
 */
export const photos = mysqlTable("photos", {
  id: int("id").primaryKey().autoincrement(),
  albumId: int("album_id").references(() => albums.id, { onDelete: "set null" }),
  filename: varchar("filename", { length: 500 }).notNull(),
  title: varchar("title", { length: 255 }),
  description: text("description"),
  fileUrl: varchar("file_url", { length: 1000 }).notNull(),       // https://pics.frank-sellke.de/fotos/...
  thumbnailUrl: varchar("thumbnail_url", { length: 1000 }),        // https://pics.frank-sellke.de/thumbs/...
  width: int("width"),
  height: int("height"),
  fileSize: bigint("file_size", { mode: "number" }),              // Bytes
  exifData: json("exif_data"),                                     // EXIF als JSON
  isPrivate: boolean("is_private").default(false).notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
  bnummer: varchar("bnummer", { length: 50 }),                    // Verknüpfung zur Fotodatenbank
  createdBy: int("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  albumIdx: index("photos_album_idx").on(table.albumId),
  bnummerIdx: index("photos_bnummer_idx").on(table.bnummer),
  privateIdx: index("photos_private_idx").on(table.isPrivate),
}));

/**
 * Foto-Sichtbarkeit: Gruppen die dieses Foto sehen dürfen
 */
export const photoGroupVisibility = mysqlTable("photo_group_visibility", {
  photoId: int("photo_id").notNull().references(() => photos.id, { onDelete: "cascade" }),
  groupId: int("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.photoId, table.groupId] }),
}));

/**
 * Foto-Privatzugriff: Einzelne User die ein privates Foto sehen dürfen
 */
export const photoUserAccess = mysqlTable("photo_user_access", {
  photoId: int("photo_id").notNull().references(() => photos.id, { onDelete: "cascade" }),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  grantedBy: int("granted_by").references(() => users.id),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.photoId, table.userId] }),
}));

// ============================================================
// VIDEOS
// ============================================================

/**
 * Videos
 */
export const videos = mysqlTable("videos", {
  id: int("id").primaryKey().autoincrement(),
  albumId: int("album_id").references(() => albums.id, { onDelete: "set null" }),
  filename: varchar("filename", { length: 500 }).notNull(),
  title: varchar("title", { length: 255 }),
  description: text("description"),
  fileUrl: varchar("file_url", { length: 1000 }).notNull(),       // https://pics.frank-sellke.de/videos/...
  thumbnailUrl: varchar("thumbnail_url", { length: 1000 }),        // Vorschaubild
  duration: int("duration"),                                       // Sekunden
  width: int("width"),
  height: int("height"),
  fileSize: bigint("file_size", { mode: "number" }),
  mimeType: varchar("mime_type", { length: 100 }),
  isPrivate: boolean("is_private").default(false).notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
  bnummer: varchar("bnummer", { length: 50 }),                    // Verknüpfung zur Fotodatenbank
  createdBy: int("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  albumIdx: index("videos_album_idx").on(table.albumId),
  bnummerIdx: index("videos_bnummer_idx").on(table.bnummer),
}));

/**
 * Video-Sichtbarkeit: Gruppen
 */
export const videoGroupVisibility = mysqlTable("video_group_visibility", {
  videoId: int("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
  groupId: int("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.videoId, table.groupId] }),
}));

/**
 * Video-Privatzugriff: Einzelne User
 */
export const videoUserAccess = mysqlTable("video_user_access", {
  videoId: int("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  grantedBy: int("granted_by").references(() => users.id),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.videoId, table.userId] }),
}));

// ============================================================
// TAGS
// ============================================================

/**
 * Tags
 */
export const tags = mysqlTable("tags", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  groupId: int("group_id").references(() => tagGroups.id, { onDelete: "set null" }),
  createdBy: int("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Tag-Gruppen
 */
export const tagGroups = mysqlTable("tag_groups", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  color: varchar("color", { length: 7 }).notNull().default("#6b7280"), // Hex-Farbe
  createdBy: int("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Foto ↔ Tags
 */
export const photoTags = mysqlTable("photo_tags", {
  photoId: int("photo_id").notNull().references(() => photos.id, { onDelete: "cascade" }),
  tagId: int("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.photoId, table.tagId] }),
}));

/**
 * Video ↔ Tags
 */
export const videoTags = mysqlTable("video_tags", {
  videoId: int("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
  tagId: int("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.videoId, table.tagId] }),
}));

// ============================================================
// KOMMENTARE & LIKES
// ============================================================

/**
 * Kommentare (für Fotos UND Videos)
 */
export const comments = mysqlTable("comments", {
  id: int("id").primaryKey().autoincrement(),
  photoId: int("photo_id").references(() => photos.id, { onDelete: "cascade" }),
  videoId: int("video_id").references(() => videos.id, { onDelete: "cascade" }),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isApproved: boolean("is_approved").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  photoIdx: index("comments_photo_idx").on(table.photoId),
  videoIdx: index("comments_video_idx").on(table.videoId),
}));

/**
 * Likes (für Fotos UND Videos)
 */
export const likes = mysqlTable("likes", {
  id: int("id").primaryKey().autoincrement(),
  photoId: int("photo_id").references(() => photos.id, { onDelete: "cascade" }),
  videoId: int("video_id").references(() => videos.id, { onDelete: "cascade" }),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  photoIdx: index("likes_photo_idx").on(table.photoId),
  videoIdx: index("likes_video_idx").on(table.videoId),
  uniquePhotoLike: uniqueIndex("likes_unique_photo").on(table.photoId, table.userId),
}));

// ============================================================
// RELATIONS
// ============================================================

export const usersRelations = relations(users, ({ many }) => ({
  userGroups: many(userGroups),
  userPermissions: many(userPermissions),
  photos: many(photos),
  videos: many(videos),
  comments: many(comments),
  likes: many(likes),
}));

export const groupsRelations = relations(groups, ({ many }) => ({
  userGroups: many(userGroups),
  groupPermissions: many(groupPermissions),
  albumVisibility: many(albumVisibility),
}));

export const userGroupsRelations = relations(userGroups, ({ one }) => ({
  user: one(users, { fields: [userGroups.userId], references: [users.id] }),
  group: one(groups, { fields: [userGroups.groupId], references: [groups.id] }),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  groupPermissions: many(groupPermissions),
  userPermissions: many(userPermissions),
}));

export const albumsRelations = relations(albums, ({ one, many }) => ({
  parent: one(albums, { fields: [albums.parentId], references: [albums.id], relationName: "albumChildren" }),
  children: many(albums, { relationName: "albumChildren" }),
  photos: many(photos),
  videos: many(videos),
  visibility: many(albumVisibility),
}));

export const photosRelations = relations(photos, ({ one, many }) => ({
  album: one(albums, { fields: [photos.albumId], references: [albums.id] }),
  creator: one(users, { fields: [photos.createdBy], references: [users.id] }),
  tags: many(photoTags),
  comments: many(comments),
  likes: many(likes),
  groupVisibility: many(photoGroupVisibility),
  userAccess: many(photoUserAccess),
}));

export const videosRelations = relations(videos, ({ one, many }) => ({
  album: one(albums, { fields: [videos.albumId], references: [albums.id] }),
  creator: one(users, { fields: [videos.createdBy], references: [users.id] }),
  tags: many(videoTags),
  comments: many(comments),
  likes: many(likes),
  groupVisibility: many(videoGroupVisibility),
  userAccess: many(videoUserAccess),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  photoTags: many(photoTags),
  videoTags: many(videoTags),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  photo: one(photos, { fields: [comments.photoId], references: [photos.id] }),
  video: one(videos, { fields: [comments.videoId], references: [videos.id] }),
  user: one(users, { fields: [comments.userId], references: [users.id] }),
}));

export const likesRelations = relations(likes, ({ one }) => ({
  photo: one(photos, { fields: [likes.photoId], references: [photos.id] }),
  video: one(videos, { fields: [likes.videoId], references: [videos.id] }),
  user: one(users, { fields: [likes.userId], references: [users.id] }),
}));

// ============================================================
// TYPE EXPORTS
// ============================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type Permission = typeof permissions.$inferSelect;
export type Album = typeof albums.$inferSelect;
export type NewAlbum = typeof albums.$inferInsert;
export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type Like = typeof likes.$inferSelect;
