// Reference: javascript_database blueprint
// Drizzle ORM schema for PostgreSQL
import { pgTable, varchar, integer, timestamp, text, boolean } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: varchar("email", { length: 255 }),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  profileImageUrl: text("profile_image_url"),
  role: varchar("role", { length: 20 }).$type<"admin" | "user">().notNull().default("user"),
  points: integer("points").notNull().default(0),
  isBlocked: boolean("is_blocked").notNull().default(false),
  blockedReason: text("blocked_reason"),
  blockedAt: timestamp("blocked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Documents table
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  postId: varchar("post_id", { length: 10 }).notNull().unique(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  subcategory: varchar("subcategory", { length: 100 }),
  pageCount: integer("page_count").notNull().default(0),
  pointsCost: integer("points_cost").notNull().default(0),
  coverImageUrl: text("cover_image_url").notNull(),
  imageUrls: text("image_urls"),
  viewCount: integer("view_count").notNull().default(0),
  favoriteCount: integer("favorite_count").notNull().default(0),
  originalFileName: varchar("original_file_name", { length: 500 }),
  parentPostId: varchar("parent_post_id", { length: 10 }),
  postIndex: integer("post_index"),
  totalParts: integer("total_parts"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// DocumentImage interface for imageUrls array
export interface DocumentImage {
  sheet: string;
  page: number;
  url: string;
  isBlurred?: boolean;
}

// Favorites table
export const favorites = pgTable("favorites", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  documentId: varchar("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Tags table
export const tags = pgTable("tags", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Document tags junction table
export const documentTags = pgTable("document_tags", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  documentId: varchar("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  tagId: varchar("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// User uploads table
export const userUploads = pgTable("user_uploads", {
  // ... các trường cũ ...
  fileHash: text("file_hash"),
  // --- THÊM DÒNG NÀY ---
  category: text("category"), // Lưu danh mục user chọn
  // ---------------------
  createdAt: timestamp("created_at").defaultNow(),
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  slot: integer("slot").notNull(),
  fileName: varchar("file_name", { length: 500 }).notNull(),
  fileType: varchar("file_type", { length: 150 }).notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  approvalStatus: varchar("approval_status", { length: 20 }).$type<"pending" | "approved" | "rejected">().notNull().default("pending"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  approvedCategory: varchar("approved_category", { length: 100 }),
  approvedSubcategory: varchar("approved_subcategory", { length: 100 }),
  pipelineStatus: varchar("pipeline_status", { length: 20 }).$type<"not_started" | "processing" | "completed" | "failed" | "skipped">(),
  pipelineStartedAt: timestamp("pipeline_started_at"),
  pipelineCompletedAt: timestamp("pipeline_completed_at"),
  aiStatus: varchar("ai_status", { length: 20 }).$type<"pending" | "processing" | "completed" | "failed">(),
  aiGeneratedTitle: varchar("ai_generated_title", { length: 500 }),
  aiGeneratedDescription: text("ai_generated_description"),
  aiGeneratedCategory: varchar("ai_generated_category", { length: 100 }),
  aiGeneratedAt: timestamp("ai_generated_at"),
  aiError: text("ai_error"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

// Admin uploads table
export const adminUploads = pgTable("admin_uploads", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 500 }).notNull(),
  fileType: varchar("file_type", { length: 150 }).notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  category: varchar("category", { length: 100 }),
  subcategory: varchar("subcategory", { length: 100 }),
  pipelineStatus: varchar("pipeline_status", { length: 20 }).$type<"not_started" | "processing" | "completed" | "failed" | "skipped">().notNull().default("not_started"),
  pipelineError: text("pipeline_error"),
  pipelineStartedAt: timestamp("pipeline_started_at"),
  pipelineCompletedAt: timestamp("pipeline_completed_at"),
  aiStatus: varchar("ai_status", { length: 20 }).$type<"pending" | "processing" | "completed" | "failed">(),
  aiGeneratedTitle: varchar("ai_generated_title", { length: 500 }),
  aiGeneratedDescription: text("ai_generated_description"),
  aiGeneratedCategory: varchar("ai_generated_category", { length: 100 }),
  aiGeneratedAt: timestamp("ai_generated_at"),
  aiError: text("ai_error"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  favorites: many(favorites),
  userUploads: many(userUploads),
  adminUploads: many(adminUploads),
}));

export const documentsRelations = relations(documents, ({ many }) => ({
  favorites: many(favorites),
  documentTags: many(documentTags),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, {
    fields: [favorites.userId],
    references: [users.id],
  }),
  document: one(documents, {
    fields: [favorites.documentId],
    references: [documents.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  documentTags: many(documentTags),
}));

export const documentTagsRelations = relations(documentTags, ({ one }) => ({
  document: one(documents, {
    fields: [documentTags.documentId],
    references: [documents.id],
  }),
  tag: one(tags, {
    fields: [documentTags.tagId],
    references: [tags.id],
  }),
}));

export const userUploadsRelations = relations(userUploads, ({ one }) => ({
  user: one(users, {
    fields: [userUploads.userId],
    references: [users.id],
  }),
}));

export const adminUploadsRelations = relations(adminUploads, ({ one }) => ({
  user: one(users, {
    fields: [adminUploads.uploadedBy],
    references: [users.id],
  }),
}));

// TypeScript types inferred from Drizzle tables
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = typeof favorites.$inferInsert;

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

export type DocumentTag = typeof documentTags.$inferSelect;
export type InsertDocumentTag = typeof documentTags.$inferInsert;

export type UserUpload = typeof userUploads.$inferSelect;
export type InsertUserUpload = typeof userUploads.$inferInsert;

export type AdminUpload = typeof adminUploads.$inferSelect;
export type InsertAdminUpload = typeof adminUploads.$inferInsert;

// Extended types for API responses
export interface DocumentWithFavorite extends Document {
  isFavorited: boolean;
}

export interface DocumentWithTags extends Document {
  tags: Tag[];
}

export interface UserUploadWithUser extends UserUpload {
  user?: {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  };
}

// Zod validation schemas using drizzle-zod
export const insertDocumentSchema = createInsertSchema(documents, {
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  pageCount: z.number().int().positive("Page count must be positive"),
  coverImageUrl: z.string().min(1, "Cover image is required"),
  imageUrls: z.string().optional(),
}).omit({
  id: true,
  viewCount: true,
  favoriteCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFavoriteSchema = createInsertSchema(favorites).omit({
  id: true,
  createdAt: true,
});

export const insertTagSchema = createInsertSchema(tags, {
  name: z.string().min(1, "Tag name is required").max(50, "Tag name too long"),
}).omit({
  id: true,
  createdAt: true,
});

export const insertUserUploadSchema = createInsertSchema(userUploads, {
  slot: z.number().int().min(1).max(10, "Slot must be between 1 and 10"),
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  filePath: z.string().min(1),
  fileSize: z.number().int().positive(),
}).omit({
  id: true,
  approvalStatus: true,
  reviewedBy: true,
  reviewedAt: true,
  pipelineStatus: true,
  pipelineStartedAt: true,
  pipelineCompletedAt: true,
  aiStatus: true,
  aiGeneratedTitle: true,
  aiGeneratedDescription: true,
  aiGeneratedCategory: true,
  aiGeneratedAt: true,
  aiError: true,
  uploadedAt: true,
});
