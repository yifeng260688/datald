// Storage interface - defines contract for database operations
// Implementation: server/mongo-storage.ts (MongoDB/Mongoose)
// Note: This file only contains interface definitions, no implementation

import type {
  User,
  Document,
  Favorite,
  Tag,
  DocumentTag,
  DocumentWithFavorite,
  UserUpload,
  AdminUpload,
} from "@shared/schema";
import type { ICategory, IChatConversation, IChatMessage } from "./models";

export interface IStorage {
  // User operations (REQUIRED for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: Partial<User> & { id: string }): Promise<User>;

  // Document operations
  getAllDocuments(userId?: string): Promise<DocumentWithFavorite[]>;
  getDocumentById(id: string, userId?: string): Promise<DocumentWithFavorite | undefined>;
  getDocumentByIdRaw(id: string): Promise<{ coverImageUrl: string | null; imageUrls: any[] } | undefined>;
  getRelatedDocuments(documentId: string, userId?: string): Promise<DocumentWithFavorite[]>;
  createDocument(document: Partial<Document>): Promise<Document>;
  updateDocument(id: string, document: Partial<Document>): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<boolean>;
  incrementViewCount(id: string): Promise<void>;

  // Favorite operations
  addFavorite(favorite: Partial<Favorite>): Promise<Favorite>;
  removeFavorite(userId: string, documentId: string): Promise<boolean>;
  getUserFavorites(userId: string): Promise<string[]>;

  // Tag operations
  getAllTags(): Promise<Tag[]>;
  createTag(tag: Partial<Tag>): Promise<Tag>;
  deleteTag(id: string): Promise<boolean>;
  getDocumentTags(documentId: string): Promise<Tag[]>;
  setDocumentTags(documentId: string, tagIds: string[]): Promise<void>;

  // Admin operations
  getAllUsers(): Promise<User[]>;
  getRecentUsers(limit: number): Promise<User[]>;
  updateUserRole(userId: string, role: string): Promise<User | undefined>;
  updateUserPoints(userId: string, points: number): Promise<User | undefined>;
  getAllDocumentsForAdmin(): Promise<Document[]>;
  getDocumentByIdForAdmin(id: string): Promise<Document | undefined>;
  getRecentDocuments(limit: number): Promise<Document[]>;
  getAdminStats(): Promise<{
    totalDocuments: number;
    totalUsers: number;
    totalFavorites: number;
    totalViews: number;
  }>;

  // User upload operations
  getUserUploads(userId: string): Promise<UserUpload[]>;
  getUserUploadCount(userId: string): Promise<number>;
  findAvailableSlot(userId: string): Promise<number | null>;
  createUserUpload(upload: Partial<UserUpload>): Promise<UserUpload>;
  deleteUserUpload(id: string, userId: string): Promise<boolean>;
  
  // Admin upload operations
  getAdminUploads(): Promise<AdminUpload[]>;
  getAdminUploadById(id: string): Promise<AdminUpload | undefined>;
  createAdminUpload(upload: Partial<AdminUpload>): Promise<AdminUpload>;
  deleteAdminUpload(id: string): Promise<boolean>;
  updatePipelineStatus(id: string, status: string, startedAt?: Date, completedAt?: Date): Promise<AdminUpload | undefined>;
  
  // Duplicate file detection
  checkDuplicateFileHash(fileHash: string): Promise<{ isDuplicate: boolean; existingFileName?: string; existingUploadType?: 'admin' | 'user' }>;
  deleteAllDuplicateRecords(): Promise<{ adminDeleted: number; userDeleted: number; details: string[] }>;
  clearAllUploads(): Promise<{ adminCleared: number; userCleared: number }>;
  
  // User upload approval operations
  getAllUserUploads(): Promise<(UserUpload & { userName: string; userEmail: string })[]>;
  getUserUploadById(id: string): Promise<UserUpload | undefined>;
  approveUserUpload(id: string, adminId: string, category: string): Promise<UserUpload | undefined>;
  rejectUserUpload(id: string, adminId: string): Promise<UserUpload | undefined>;
  updateUserUploadPipelineStatus(id: string, status: string, startedAt?: Date, completedAt?: Date): Promise<UserUpload | undefined>;
  
  // Category operations
  getAllCategories(): Promise<ICategory[]>;
  getCategoryById(id: string): Promise<ICategory | undefined>;
  createCategory(category: Partial<ICategory>): Promise<ICategory>;
  updateCategory(id: string, category: Partial<ICategory>): Promise<ICategory | undefined>;
  deleteCategory(id: string): Promise<boolean>;

  // Chat support operations
  getOrCreateConversation(userId?: string, guestId?: string, guestName?: string, guestEmail?: string): Promise<IChatConversation>;
  getConversationById(id: string): Promise<IChatConversation | undefined>;
  getConversationByUserId(userId: string): Promise<IChatConversation | undefined>;
  getConversationByGuestId(guestId: string): Promise<IChatConversation | undefined>;
  getAllConversations(): Promise<IChatConversation[]>;
  updateConversationStatus(id: string, status: "active" | "closed"): Promise<IChatConversation | undefined>;
  
  // Chat message operations
  getMessagesByConversationId(conversationId: string): Promise<IChatMessage[]>;
  createMessage(message: Partial<IChatMessage>): Promise<IChatMessage>;
  markMessagesAsRead(conversationId: string, senderType: "user" | "admin"): Promise<void>;
}
