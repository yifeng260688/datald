import type { IStorage } from "./storage";
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

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private documents: Map<string, Document> = new Map();
  private favorites: Map<string, Favorite> = new Map();
  private tags: Map<string, Tag> = new Map();
  private documentTags: Map<string, DocumentTag> = new Map();
  private userUploads: Map<string, UserUpload> = new Map();
  private adminUploads: Map<string, AdminUpload> = new Map();
  private usedPostIds: Set<string> = new Set();
  private categories: Map<string, ICategory> = new Map();
  private conversations: Map<string, IChatConversation> = new Map();
  private messages: Map<string, IChatMessage> = new Map();

  constructor() {
    console.log("⚠️  Using IN-MEMORY storage - data will be lost on restart!");
    console.log("⚠️  Fix MongoDB Atlas IP whitelist to enable persistent storage");
  }

  private generateUniquePostId(): string {
    let attempts = 0;
    const maxAttempts = 100;
    
    while (attempts < maxAttempts) {
      const postId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
      if (!this.usedPostIds.has(postId)) {
        this.usedPostIds.add(postId);
        return postId;
      }
      attempts++;
    }
    throw new Error("Failed to generate unique post ID");
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(user: Partial<User> & { id: string }): Promise<User> {
    const existing = this.users.get(user.id);
    const updated: User = {
      ...existing,
      ...user,
      id: user.id,
      role: user.role || existing?.role || "user",
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    } as User;
    this.users.set(user.id, updated);
    return updated;
  }

  // Document operations
  async getAllDocuments(userId?: string): Promise<DocumentWithFavorite[]> {
    const docs = Array.from(this.documents.values());
    return docs.map(doc => this.addFavoriteFlag(doc, userId));
  }

  async getDocumentById(id: string, userId?: string): Promise<DocumentWithFavorite | undefined> {
    const doc = this.documents.get(id);
    return doc ? this.addFavoriteFlag(doc, userId) : undefined;
  }

  async getRelatedDocuments(documentId: string, userId?: string): Promise<DocumentWithFavorite[]> {
    const doc = this.documents.get(documentId);
    if (!doc) return [];
    
    const related = Array.from(this.documents.values())
      .filter(d => d.id !== documentId && d.category === doc.category)
      .slice(0, 4);
    
    return related.map(d => this.addFavoriteFlag(d, userId));
  }

  async createDocument(document: Partial<Document>): Promise<Document> {
    const id = this.generateId();
    const postId = this.generateUniquePostId();
    const newDoc: Document = {
      id,
      postId,
      title: document.title || "",
      description: document.description || "",
      category: document.category || "",
      pageCount: document.pageCount || 0,
      coverImageUrl: document.coverImageUrl || "",
      imageUrls: (document as any).imageUrls || null,
      viewCount: 0,
      favoriteCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.documents.set(id, newDoc);
    return newDoc;
  }

  async updateDocument(id: string, document: Partial<Document>): Promise<Document | undefined> {
    const existing = this.documents.get(id);
    if (!existing) return undefined;
    
    const updated: Document = {
      ...existing,
      ...document,
      id,
      updatedAt: new Date(),
    };
    this.documents.set(id, updated);
    return updated;
  }

  async deleteDocument(id: string): Promise<boolean> {
    return this.documents.delete(id);
  }

  async incrementViewCount(id: string): Promise<void> {
    const doc = this.documents.get(id);
    if (doc) {
      doc.viewCount++;
      this.documents.set(id, doc);
    }
  }

  // Favorite operations
  async addFavorite(favorite: Partial<Favorite>): Promise<Favorite> {
    const id = this.generateId();
    const newFav: Favorite = {
      id,
      userId: favorite.userId!,
      documentId: favorite.documentId!,
      createdAt: new Date(),
    };
    this.favorites.set(id, newFav);
    
    // Update favorite count
    const doc = this.documents.get(newFav.documentId);
    if (doc) {
      doc.favoriteCount++;
      this.documents.set(doc.id, doc);
    }
    
    return newFav;
  }

  async removeFavorite(userId: string, documentId: string): Promise<boolean> {
    const fav = Array.from(this.favorites.values()).find(
      f => f.userId === userId && f.documentId === documentId
    );
    
    if (!fav) return false;
    
    this.favorites.delete(fav.id);
    
    // Update favorite count
    const doc = this.documents.get(documentId);
    if (doc && doc.favoriteCount > 0) {
      doc.favoriteCount--;
      this.documents.set(doc.id, doc);
    }
    
    return true;
  }

  async getUserFavorites(userId: string): Promise<string[]> {
    return Array.from(this.favorites.values())
      .filter(f => f.userId === userId)
      .map(f => f.documentId);
  }

  // Tag operations
  async getAllTags(): Promise<Tag[]> {
    return Array.from(this.tags.values());
  }

  async createTag(tag: Partial<Tag>): Promise<Tag> {
    const id = this.generateId();
    const newTag: Tag = {
      id,
      name: tag.name!,
      createdAt: new Date(),
    };
    this.tags.set(id, newTag);
    return newTag;
  }

  async deleteTag(id: string): Promise<boolean> {
    return this.tags.delete(id);
  }

  async getDocumentTags(documentId: string): Promise<Tag[]> {
    const docTagIds = Array.from(this.documentTags.values())
      .filter(dt => dt.documentId === documentId)
      .map(dt => dt.tagId);
    
    return Array.from(this.tags.values())
      .filter(tag => docTagIds.includes(tag.id));
  }

  async setDocumentTags(documentId: string, tagIds: string[]): Promise<void> {
    // Remove existing tags for this document
    const existingDocTags = Array.from(this.documentTags.values())
      .filter(dt => dt.documentId === documentId);
    existingDocTags.forEach(dt => this.documentTags.delete(dt.id));
    
    // Add new tags
    tagIds.forEach(tagId => {
      const id = this.generateId();
      const docTag: DocumentTag = {
        id,
        documentId,
        tagId,
        createdAt: new Date(),
      };
      this.documentTags.set(id, docTag);
    });
  }

  // Admin operations
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getRecentUsers(limit: number): Promise<User[]> {
    return Array.from(this.users.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async updateUserRole(userId: string, role: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    user.role = role as "admin" | "user";
    user.updatedAt = new Date();
    this.users.set(userId, user);
    return user;
  }

  async getAllDocumentsForAdmin(): Promise<Document[]> {
    return Array.from(this.documents.values());
  }

  async getDocumentByIdForAdmin(id: string): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async getRecentDocuments(limit: number): Promise<Document[]> {
    return Array.from(this.documents.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async getAdminStats(): Promise<{
    totalDocuments: number;
    totalUsers: number;
    totalFavorites: number;
    totalViews: number;
  }> {
    const docs = Array.from(this.documents.values());
    return {
      totalDocuments: docs.length,
      totalUsers: this.users.size,
      totalFavorites: this.favorites.size,
      totalViews: docs.reduce((sum, doc) => sum + doc.viewCount, 0),
    };
  }

  // User upload operations
  async getUserUploads(userId: string): Promise<UserUpload[]> {
    return Array.from(this.userUploads.values())
      .filter(u => u.userId === userId);
  }

  async getUserUploadCount(userId: string): Promise<number> {
    return Array.from(this.userUploads.values())
      .filter(u => u.userId === userId)
      .length;
  }

  async findAvailableSlot(userId: string): Promise<number | null> {
    const uploads = await this.getUserUploads(userId);
    const usedSlots = uploads.map(u => u.slot);
    
    // User can upload up to 10 files (slots 1-10)
    for (let slot = 1; slot <= 10; slot++) {
      if (!usedSlots.includes(slot)) return slot;
    }
    return null;
  }

  async createUserUpload(upload: Partial<UserUpload>): Promise<UserUpload> {
    const id = this.generateId();
    const newUpload: UserUpload = {
      id,
      userId: upload.userId!,
      slot: upload.slot!,
      fileName: upload.fileName!,
      fileType: upload.fileType!,
      filePath: upload.filePath!,
      fileSize: upload.fileSize!,
      approvalStatus: "pending",
      reviewedBy: null,
      reviewedAt: null,
      approvedCategory: null,
      pipelineStatus: "not_started",
      pipelineStartedAt: null,
      pipelineCompletedAt: null,
      aiStatus: "pending",
      aiGeneratedTitle: null,
      aiGeneratedDescription: null,
      aiGeneratedCategory: null,
      aiGeneratedAt: null,
      aiError: null,
      uploadedAt: new Date(),
    };
    this.userUploads.set(id, newUpload);
    return newUpload;
  }

  async deleteUserUpload(id: string, userId: string): Promise<boolean> {
    const upload = this.userUploads.get(id);
    if (!upload || upload.userId !== userId) return false;
    return this.userUploads.delete(id);
  }

  // Admin upload operations
  async getAdminUploads(): Promise<AdminUpload[]> {
    return Array.from(this.adminUploads.values())
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }

  async createAdminUpload(upload: Partial<AdminUpload>): Promise<AdminUpload> {
    const id = this.generateId();
    const newUpload: AdminUpload = {
      id,
      uploadedBy: upload.uploadedBy!,
      fileName: upload.fileName!,
      fileType: upload.fileType!,
      filePath: upload.filePath!,
      fileSize: upload.fileSize!,
      category: upload.category || null,
      pipelineStatus: "not_started",
      pipelineStartedAt: null,
      pipelineCompletedAt: null,
      aiStatus: "pending",
      aiGeneratedTitle: null,
      aiGeneratedDescription: null,
      aiGeneratedCategory: null,
      aiGeneratedAt: null,
      aiError: null,
      uploadedAt: new Date(),
    };
    this.adminUploads.set(id, newUpload);
    return newUpload;
  }

  async deleteAdminUpload(id: string): Promise<boolean> {
    return this.adminUploads.delete(id);
  }

  async updatePipelineStatus(
    id: string,
    status: string,
    startedAt?: Date,
    completedAt?: Date
  ): Promise<AdminUpload | undefined> {
    const upload = this.adminUploads.get(id);
    if (!upload) return undefined;
    
    upload.pipelineStatus = status as any;
    if (startedAt) upload.pipelineStartedAt = startedAt;
    if (completedAt) upload.pipelineCompletedAt = completedAt;
    
    this.adminUploads.set(id, upload);
    return upload;
  }

  // User upload approval operations
  async getAllUserUploads(): Promise<(UserUpload & { userName: string; userEmail: string })[]> {
    const uploads = Array.from(this.userUploads.values());
    return uploads.map(upload => {
      const user = this.users.get(upload.userId);
      return {
        ...upload,
        userName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "Unknown",
        userEmail: user?.email || "unknown",
      };
    });
  }

  async approveUserUpload(id: string, adminId: string, category: string): Promise<UserUpload | undefined> {
    const upload = this.userUploads.get(id);
    if (!upload) return undefined;
    
    upload.approvalStatus = "approved";
    upload.reviewedBy = adminId;
    upload.reviewedAt = new Date();
    upload.approvedCategory = category;
    
    this.userUploads.set(id, upload);
    return upload;
  }

  async rejectUserUpload(id: string, adminId: string): Promise<UserUpload | undefined> {
    const upload = this.userUploads.get(id);
    if (!upload) return undefined;
    
    upload.approvalStatus = "rejected";
    upload.reviewedBy = adminId;
    upload.reviewedAt = new Date();
    
    this.userUploads.set(id, upload);
    return upload;
  }

  async updateUserUploadPipelineStatus(
    id: string,
    status: string,
    startedAt?: Date,
    completedAt?: Date
  ): Promise<UserUpload | undefined> {
    const upload = this.userUploads.get(id);
    if (!upload) return undefined;
    
    upload.pipelineStatus = status as any;
    if (startedAt) upload.pipelineStartedAt = startedAt;
    if (completedAt) upload.pipelineCompletedAt = completedAt;
    
    this.userUploads.set(id, upload);
    return upload;
  }

  // Duplicate file detection
  async checkDuplicateFileHash(fileHash: string): Promise<{ isDuplicate: boolean; existingFileName?: string; existingUploadType?: 'admin' | 'user' }> {
    for (const upload of this.adminUploads.values()) {
      if ((upload as any).fileHash === fileHash) {
        return { isDuplicate: true, existingFileName: upload.fileName, existingUploadType: 'admin' };
      }
    }
    for (const upload of this.userUploads.values()) {
      if ((upload as any).fileHash === fileHash) {
        return { isDuplicate: true, existingFileName: upload.fileName, existingUploadType: 'user' };
      }
    }
    return { isDuplicate: false };
  }

  async deleteAllDuplicateRecords(): Promise<{ adminDeleted: number; userDeleted: number; details: string[] }> {
    return { adminDeleted: 0, userDeleted: 0, details: [] };
  }

  async clearAllUploads(): Promise<{ adminCleared: number; userCleared: number }> {
    const adminCleared = this.adminUploads.size;
    const userCleared = this.userUploads.size;
    this.adminUploads.clear();
    this.userUploads.clear();
    return { adminCleared, userCleared };
  }

  async getAdminUploadById(id: string): Promise<AdminUpload | undefined> {
    return this.adminUploads.get(id);
  }

  async getUserUploadById(id: string): Promise<UserUpload | undefined> {
    return this.userUploads.get(id);
  }

  // Category operations
  async getAllCategories(): Promise<ICategory[]> {
    return Array.from(this.categories.values()).sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  async getCategoryById(id: string): Promise<ICategory | undefined> {
    return this.categories.get(id);
  }

  async createCategory(category: Partial<ICategory>): Promise<ICategory> {
    const id = this.generateId();
    const newCategory: ICategory = {
      _id: id,
      name: category.name || "",
      order: category.order || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ICategory;
    this.categories.set(id, newCategory);
    return newCategory;
  }

  async updateCategory(id: string, category: Partial<ICategory>): Promise<ICategory | undefined> {
    const existing = this.categories.get(id);
    if (!existing) return undefined;
    
    const updated: ICategory = {
      ...existing,
      ...category,
      updatedAt: new Date(),
    } as ICategory;
    this.categories.set(id, updated);
    return updated;
  }

  async deleteCategory(id: string): Promise<boolean> {
    return this.categories.delete(id);
  }

  // Chat support operations
  async getOrCreateConversation(userId?: string, guestId?: string, guestName?: string, guestEmail?: string): Promise<IChatConversation> {
    if (userId) {
      const existing = Array.from(this.conversations.values()).find(c => c.userId === userId);
      if (existing) return existing;
    }
    if (guestId) {
      const existing = Array.from(this.conversations.values()).find(c => c.guestId === guestId);
      if (existing) return existing;
    }
    
    const id = this.generateId();
    const conversation: IChatConversation = {
      _id: id,
      userId: userId || null,
      guestId: guestId || null,
      guestName: guestName || null,
      guestEmail: guestEmail || null,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as IChatConversation;
    this.conversations.set(id, conversation);
    return conversation;
  }

  async getConversationById(id: string): Promise<IChatConversation | undefined> {
    return this.conversations.get(id);
  }

  async getConversationByUserId(userId: string): Promise<IChatConversation | undefined> {
    return Array.from(this.conversations.values()).find(c => c.userId === userId);
  }

  async getConversationByGuestId(guestId: string): Promise<IChatConversation | undefined> {
    return Array.from(this.conversations.values()).find(c => c.guestId === guestId);
  }

  async getAllConversations(): Promise<IChatConversation[]> {
    return Array.from(this.conversations.values());
  }

  async updateConversationStatus(id: string, status: "active" | "closed"): Promise<IChatConversation | undefined> {
    const conversation = this.conversations.get(id);
    if (!conversation) return undefined;
    
    conversation.status = status;
    conversation.updatedAt = new Date();
    this.conversations.set(id, conversation);
    return conversation;
  }

  // Chat message operations
  async getMessagesByConversationId(conversationId: string): Promise<IChatMessage[]> {
    return Array.from(this.messages.values())
      .filter(m => m.conversationId?.toString() === conversationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createMessage(message: Partial<IChatMessage>): Promise<IChatMessage> {
    const id = this.generateId();
    const newMessage: IChatMessage = {
      _id: id,
      conversationId: message.conversationId!,
      senderType: message.senderType!,
      senderId: message.senderId || null,
      content: message.content || "",
      isRead: false,
      createdAt: new Date(),
    } as IChatMessage;
    this.messages.set(id, newMessage);
    return newMessage;
  }

  async markMessagesAsRead(conversationId: string, senderType: "user" | "admin"): Promise<void> {
    for (const [id, message] of this.messages.entries()) {
      if (message.conversationId?.toString() === conversationId && message.senderType !== senderType) {
        message.isRead = true;
        this.messages.set(id, message);
      }
    }
  }

  // Helper methods
  private addFavoriteFlag(doc: Document, userId?: string): DocumentWithFavorite {
    const isFavorited = userId
      ? Array.from(this.favorites.values()).some(
          f => f.userId === userId && f.documentId === doc.id
        )
      : false;
    
    return { ...doc, isFavorited };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
