import { randomUUID } from "crypto";
import {
  User,
  DocumentModel,
  Favorite,
  Tag,
  DocumentTag,
  UserUpload,
  AdminUpload,
  Category,
  ChatConversation,
  ChatMessage,
  Notification,
  NotificationRead,
  UserPostView,
  UserRedeemedFile,
} from "./models";
import type { IStorage } from "./storage";
import type {
  User as UserType,
  UpsertUser,
  Document as DocumentType,
  InsertDocument,
  DocumentWithFavorite,
  Favorite as FavoriteType,
  InsertFavorite,
  Tag as TagType,
  InsertTag,
  UserUpload as UserUploadType,
  InsertUserUpload,
  AdminUpload as AdminUploadType,
  InsertAdminUpload,
} from "@shared/schema";

// Helper to convert undefined to null for Drizzle compatibility
function toNull<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

// Helper to serialize imageUrls array to JSON string for schema compatibility
function serializeImageUrls(imageUrls: any[] | undefined | null): string | null {
  if (!imageUrls || imageUrls.length === 0) return null;
  return JSON.stringify(imageUrls);
}

// Helper to clean Mongoose document array (removes internal properties)
function cleanImageArray(imageUrls: any): any[] {
  if (!imageUrls) return [];
  
  // Handle Mongoose subdocument arrays - convert to plain objects
  let arr: any[];
  if (Array.isArray(imageUrls)) {
    arr = imageUrls.map((item: any) => {
      if (item && typeof item.toObject === 'function') {
        return item.toObject();
      }
      if (item && typeof item === 'object') {
        const { __parentArray, __parent, $__, ...cleanItem } = item;
        return cleanItem;
      }
      return item;
    });
  } else if (typeof imageUrls === 'string') {
    try {
      const parsed = JSON.parse(imageUrls);
      arr = Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  } else {
    return [];
  }
  
  return arr;
}

// Helper to convert DO Spaces URLs to proxy URLs (hide storage paths from frontend)
function convertToProxyUrls(docId: string, coverImageUrl: string | null, rawImageUrls: any): { coverImageUrl: string | null; imageUrls: string | null } {
  // Convert cover image to proxy URL
  const proxiedCover = coverImageUrl ? `/api/documents/${docId}/cover` : null;
  
  // Clean and convert gallery images to proxy URLs with index-based references
  const imageUrls = cleanImageArray(rawImageUrls);
  
  if (!imageUrls || imageUrls.length === 0) {
    return { coverImageUrl: proxiedCover, imageUrls: null };
  }
  
  const proxiedImages = imageUrls.map((img: any, index: number) => {
    if (typeof img === 'string') {
      return `/api/documents/${docId}/images/${index}`;
    }
    // Keep sheet/page info but replace url with proxy
    return {
      sheet: img.sheet || 'unknown',
      page: img.page || index + 1,
      url: `/api/documents/${docId}/images/${index}`,
      isBlurred: img.isBlurred || false,
    };
  });
  
  return { 
    coverImageUrl: proxiedCover, 
    imageUrls: JSON.stringify(proxiedImages) 
  };
}

// Helper to deserialize imageUrls from JSON string or array for MongoDB storage
function deserializeImageUrls(imageUrls: any): any[] {
  if (!imageUrls) return [];
  if (Array.isArray(imageUrls)) return imageUrls;
  try {
    const parsed = JSON.parse(imageUrls);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Helper to create a base document object with all standard fields
// Converts DO Spaces URLs to proxy URLs to hide storage paths from frontend
function mapDocumentToBase(doc: any): DocumentType {
  const proxiedUrls = convertToProxyUrls(doc._id, doc.coverImageUrl, doc.imageUrls);
  
  return {
    id: doc._id,
    postId: doc.postId || '',
    title: doc.title,
    description: doc.description,
    category: doc.category,
    subcategory: doc.subcategory || null,
    pageCount: doc.pageCount,
    pointsCost: doc.pointsCost || doc.pageCount || 0,
    coverImageUrl: proxiedUrls.coverImageUrl,
    imageUrls: proxiedUrls.imageUrls,
    viewCount: doc.viewCount,
    favoriteCount: doc.favoriteCount || 0,
    originalFileName: doc.originalFileName || null,
    parentPostId: doc.parentPostId || null,
    postIndex: doc.postIndex || null,
    totalParts: doc.totalParts || null,
    createdAt: toNull(doc.createdAt),
    updatedAt: toNull(doc.updatedAt),
  };
}

// Helper to create a document with favorite status
function mapDocumentWithFavorite(doc: any, isFavorited: boolean): DocumentWithFavorite {
  return {
    ...mapDocumentToBase(doc),
    isFavorited,
  };
}

// Generate unique 10-digit post ID
async function generateUniquePostId(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 100;
  
  while (attempts < maxAttempts) {
    // Generate random 10-digit number (1000000000 to 9999999999)
    const postId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    
    // Check if postId already exists
    const existing = await DocumentModel.findOne({ postId });
    if (!existing) {
      return postId;
    }
    attempts++;
  }
  
  throw new Error("Failed to generate unique post ID after maximum attempts");
}

export class MongoDBStorage implements IStorage {
  // Helper to sort documents keeping multi-part posts grouped together in order
  private sortDocumentsWithPartsGrouped(docs: any[]): any[] {
    // First pass: identify all series and group documents, tracking parent position
    const seriesMap = new Map<string, any[]>(); // seriesId -> [docs in series]
    const seriesParentIdx = new Map<string, number>(); // seriesId -> index of parent (postIndex=1)
    const docInfo: Array<{ doc: any; seriesId: string | null; origIndex: number }> = [];
    
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      
      // Determine series ID: parent's postId or own postId if this is the parent
      let seriesId: string | null = null;
      if (doc.parentPostId) {
        seriesId = doc.parentPostId;
      } else if (doc.postIndex === 1 && doc.totalParts && doc.totalParts > 1) {
        seriesId = doc.postId;
      }
      
      docInfo.push({ doc, seriesId, origIndex: i });
      
      if (seriesId) {
        if (!seriesMap.has(seriesId)) {
          seriesMap.set(seriesId, []);
        }
        seriesMap.get(seriesId)!.push(doc);
        
        // Track parent document position (the one with postIndex=1)
        if (doc.postIndex === 1) {
          seriesParentIdx.set(seriesId, i);
        }
      }
    }
    
    // Sort each series by postIndex
    for (const [seriesId, parts] of seriesMap) {
      parts.sort((a, b) => (a.postIndex || 0) - (b.postIndex || 0));
    }
    
    // Build sorted entries: each entry has an "effective index" for final sorting
    // - For standalone docs: use original index
    // - For series: all parts use parent's position (part 1), sorted internally by postIndex
    const sortableEntries: Array<{ doc: any; sortKey: number; subKey: number }> = [];
    const processedSeries = new Set<string>();
    
    for (const info of docInfo) {
      if (info.seriesId) {
        if (!processedSeries.has(info.seriesId)) {
          // Use parent's original index as the sort key for all parts
          // Fallback to first occurrence if parent not found
          const parentIdx = seriesParentIdx.get(info.seriesId) ?? info.origIndex;
          const parts = seriesMap.get(info.seriesId) || [];
          for (let p = 0; p < parts.length; p++) {
            sortableEntries.push({
              doc: parts[p],
              sortKey: parentIdx,
              subKey: p // Already sorted by postIndex
            });
          }
          processedSeries.add(info.seriesId);
        }
      } else {
        sortableEntries.push({
          doc: info.doc,
          sortKey: info.origIndex,
          subKey: 0
        });
      }
    }
    
    // Sort by sortKey (parent's original position), then subKey (part order within series)
    sortableEntries.sort((a, b) => {
      if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
      return a.subKey - b.subKey;
    });
    
    return sortableEntries.map(e => e.doc);
  }

  // User operations (REQUIRED for Replit Auth)
  async getUser(id: string): Promise<UserType | undefined> {
    const user = await User.findById(id);
    if (!user) return undefined;

    return {
      id: user._id,
      email: toNull(user.email),
      firstName: toNull(user.firstName),
      lastName: toNull(user.lastName),
      profileImageUrl: toNull(user.profileImageUrl),
      role: user.role,
      points: user.points || 0,
      isBlocked: user.isBlocked || false,
      blockedReason: toNull(user.blockedReason),
      blockedAt: toNull(user.blockedAt),
      createdAt: toNull(user.createdAt),
      updatedAt: toNull(user.updatedAt),
    };
  }

  async upsertUser(userData: UpsertUser): Promise<UserType> {
    // First, check if a user with this email already exists (from previous auth system)
    if (userData.email) {
      const existingByEmail = await User.findOne({ email: userData.email });
      if (existingByEmail && existingByEmail._id !== userData.id) {
        // User exists with different ID - update the existing user's ID to match the new auth provider
        await User.findByIdAndDelete(existingByEmail._id);
        console.log(`[Auth] Migrated user ${userData.email} from old ID ${existingByEmail._id} to new ID ${userData.id}`);
      }
    }

    const user = await User.findByIdAndUpdate(
      userData.id,
      {
        $set: {
          _id: userData.id,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
          role: userData.role || "user",
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return {
      id: user._id,
      email: toNull(user.email),
      firstName: toNull(user.firstName),
      lastName: toNull(user.lastName),
      profileImageUrl: toNull(user.profileImageUrl),
      role: user.role,
      points: user.points || 0,
      isBlocked: user.isBlocked || false,
      blockedReason: toNull(user.blockedReason),
      blockedAt: toNull(user.blockedAt),
      createdAt: toNull(user.createdAt),
      updatedAt: toNull(user.updatedAt),
    };
  }

  // Document operations
  async getAllDocuments(userId?: string): Promise<DocumentWithFavorite[]> {
    const docs = await DocumentModel.find().sort({ createdAt: -1 });

    // Group and sort documents: keep related posts together in correct order
    const sortedDocs = this.sortDocumentsWithPartsGrouped(docs);

    if (!userId) {
      return sortedDocs.map(doc => mapDocumentWithFavorite(doc, false));
    }

    // Get user favorites
    const userFavorites = await Favorite.find({ userId }).select('documentId');
    const favoritedIds = new Set(userFavorites.map(f => f.documentId));

    return sortedDocs.map(doc => mapDocumentWithFavorite(doc, favoritedIds.has(doc._id)));
  }

  async getDocumentById(id: string, userId?: string): Promise<DocumentWithFavorite | undefined> {
    const document = await DocumentModel.findById(id);
    
    if (!document) {
      return undefined;
    }

    let isFavorited = false;
    if (userId) {
      const favorite = await Favorite.findOne({ userId, documentId: id });
      isFavorited = !!favorite;
    }

    return mapDocumentWithFavorite(document, isFavorited);
  }

  // Internal method that returns raw DO URLs - used by image proxy endpoints only
  async getDocumentByIdRaw(id: string): Promise<{ coverImageUrl: string | null; imageUrls: any[] } | undefined> {
    const document = await DocumentModel.findById(id);
    
    if (!document) {
      return undefined;
    }

    return {
      coverImageUrl: document.coverImageUrl || null,
      imageUrls: document.imageUrls || [],
    };
  }

  async getRelatedDocuments(documentId: string, userId?: string): Promise<DocumentWithFavorite[]> {
    const currentDoc = await DocumentModel.findById(documentId);
    
    if (!currentDoc) {
      return [];
    }

    // Determine the series ID if this document is part of a multi-part series
    // Series ID is always the postId of the first part (part 1)
    let seriesPostId: string | null = null;
    
    if (currentDoc.parentPostId) {
      // This doc has a parent - use parentPostId as series identifier
      seriesPostId = currentDoc.parentPostId;
    } else if (currentDoc.postIndex === 1 && currentDoc.totalParts && currentDoc.totalParts > 1) {
      // This is the first part - use its own postId as series identifier
      seriesPostId = currentDoc.postId;
    }

    let siblingDocs: any[] = [];
    
    // Get all sibling posts in the series (excluding current document)
    if (seriesPostId) {
      siblingDocs = await DocumentModel.find({
        _id: { $ne: documentId },
        $or: [
          // Other parts that have the same parent
          { parentPostId: seriesPostId },
          // The parent itself (part 1) if we're viewing a child
          { postId: seriesPostId, postIndex: 1, totalParts: { $gt: 1 } }
        ]
      }).sort({ postIndex: 1 });
    }

    // Then get other related documents with same category
    const siblingIds = siblingDocs.map(d => d._id);
    const remainingLimit = Math.max(0, 12 - siblingDocs.length);
    
    const otherRelatedDocs = await DocumentModel.find({
      category: currentDoc.category,
      _id: { $nin: [documentId, ...siblingIds] }
    })
      .sort({ viewCount: -1 })
      .limit(remainingLimit);

    // Combine: siblings first (in order), then other related docs
    const allRelatedDocs = [...siblingDocs, ...otherRelatedDocs];

    if (!userId || allRelatedDocs.length === 0) {
      return allRelatedDocs.map(doc => mapDocumentWithFavorite(doc, false));
    }

    const docIds = allRelatedDocs.map(d => d._id);
    const userFavorites = await Favorite.find({
      userId,
      documentId: { $in: docIds }
    }).select('documentId');

    const favoritedIds = new Set(userFavorites.map(f => f.documentId));

    return allRelatedDocs.map(doc => mapDocumentWithFavorite(doc, favoritedIds.has(doc._id)));
  }

  async createDocument(document: InsertDocument): Promise<DocumentType> {
    const postId = await generateUniquePostId();
    
    const docData: any = document;
    const newDoc = await DocumentModel.create({
      _id: randomUUID(),
      postId,
      title: document.title,
      description: document.description,
      category: document.category,
      subcategory: docData.subcategory || null,
      pageCount: document.pageCount,
      pointsCost: docData.pointsCost || document.pageCount || 0,
      coverImageUrl: document.coverImageUrl,
      imageUrls: deserializeImageUrls((document as any).imageUrls),
      originalFileName: docData.originalFileName || null,
      parentPostId: docData.parentPostId || null,
      postIndex: docData.postIndex || null,
      totalParts: docData.totalParts || null,
    });

    return mapDocumentToBase(newDoc);
  }

  async updateDocument(id: string, document: Partial<InsertDocument>): Promise<DocumentType | undefined> {
    // Prepare update data, deserializing imageUrls if present
    const updateData: any = { ...document, updatedAt: new Date() };
    if ((document as any).imageUrls !== undefined) {
      updateData.imageUrls = deserializeImageUrls((document as any).imageUrls);
    }
    
    const updated = await DocumentModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );
    
    if (!updated) return undefined;

    return mapDocumentToBase(updated);
  }

  async deleteDocument(id: string): Promise<boolean> {
    const result = await DocumentModel.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  async incrementViewCount(id: string): Promise<void> {
    await DocumentModel.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });
  }

  // Favorite operations
  async addFavorite(favorite: InsertFavorite): Promise<FavoriteType> {
    const newFavorite = await Favorite.create({
      _id: randomUUID(),
      ...favorite,
    });
    
    // Increment favorite count on document
    await DocumentModel.findByIdAndUpdate(
      favorite.documentId,
      { $inc: { favoriteCount: 1 } }
    );

    return {
      id: newFavorite._id,
      userId: newFavorite.userId,
      documentId: newFavorite.documentId,
      createdAt: toNull(newFavorite.createdAt),
    };
  }

  async removeFavorite(userId: string, documentId: string): Promise<boolean> {
    const result = await Favorite.deleteOne({ userId, documentId });
    
    if (result.deletedCount > 0) {
      // Decrement favorite count on document
      await DocumentModel.findByIdAndUpdate(
        documentId,
        { $inc: { favoriteCount: -1 } }
      );
      return true;
    }
    return false;
  }

  async getUserFavorites(userId: string): Promise<string[]> {
    const favorites = await Favorite.find({ userId }).select('documentId');
    return favorites.map(f => f.documentId);
  }

  // Tag operations
  async getAllTags(): Promise<TagType[]> {
    const tags = await Tag.find().sort({ name: 1 });
    return tags.map(tag => ({
      id: tag._id,
      name: tag.name,
      createdAt: toNull(tag.createdAt),
    }));
  }

  async createTag(tag: InsertTag): Promise<TagType> {
    const newTag = await Tag.create({
      _id: randomUUID(),
      name: tag.name,
    });
    
    return {
      id: newTag._id,
      name: newTag.name,
      createdAt: toNull(newTag.createdAt),
    };
  }

  async deleteTag(id: string): Promise<boolean> {
    const result = await Tag.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  async getDocumentTags(documentId: string): Promise<TagType[]> {
    const docTags = await DocumentTag.find({ documentId });
    const tags = await Tag.find({
      _id: { $in: docTags.map(dt => dt.tagId) }
    });
    
    return tags.map(tag => ({
      id: tag._id,
      name: tag.name,
      createdAt: toNull(tag.createdAt),
    }));
  }

  async setDocumentTags(documentId: string, tagIds: string[]): Promise<void> {
    // Remove existing tags
    await DocumentTag.deleteMany({ documentId });

    // Add new tags
    if (tagIds.length > 0) {
      await DocumentTag.insertMany(
        tagIds.map(tagId => ({
          _id: randomUUID(),
          documentId,
          tagId,
        }))
      );
    }
  }

  // Admin operations
  async getAllUsers(): Promise<UserType[]> {
    const users = await User.find().sort({ createdAt: -1 });
    return users.map(user => ({
      id: user._id,
      email: toNull(user.email),
      firstName: toNull(user.firstName),
      lastName: toNull(user.lastName),
      profileImageUrl: toNull(user.profileImageUrl),
      role: user.role,
      points: user.points || 0,
      isBlocked: user.isBlocked || false,
      blockedReason: toNull(user.blockedReason),
      blockedAt: toNull(user.blockedAt),
      createdAt: toNull(user.createdAt),
      updatedAt: toNull(user.updatedAt),
    }));
  }

  async getRecentUsers(limit: number): Promise<UserType[]> {
    const users = await User.find().sort({ createdAt: -1 }).limit(limit);
    return users.map(user => ({
      id: user._id,
      email: toNull(user.email),
      firstName: toNull(user.firstName),
      lastName: toNull(user.lastName),
      profileImageUrl: toNull(user.profileImageUrl),
      role: user.role,
      points: user.points || 0,
      isBlocked: user.isBlocked || false,
      blockedReason: toNull(user.blockedReason),
      blockedAt: toNull(user.blockedAt),
      createdAt: toNull(user.createdAt),
      updatedAt: toNull(user.updatedAt),
    }));
  }

  async updateUserRole(userId: string, role: string): Promise<UserType | undefined> {
    const updated = await User.findByIdAndUpdate(
      userId,
      { role, updatedAt: new Date() },
      { new: true }
    );
    
    if (!updated) return undefined;

    return {
      id: updated._id,
      email: toNull(updated.email),
      firstName: toNull(updated.firstName),
      lastName: toNull(updated.lastName),
      profileImageUrl: toNull(updated.profileImageUrl),
      role: updated.role,
      points: updated.points || 0,
      isBlocked: updated.isBlocked || false,
      blockedReason: toNull(updated.blockedReason),
      blockedAt: toNull(updated.blockedAt),
      createdAt: toNull(updated.createdAt),
      updatedAt: toNull(updated.updatedAt),
    };
  }

  async updateUserPoints(userId: string, points: number): Promise<UserType | undefined> {
    const updated = await User.findByIdAndUpdate(
      userId,
      { points, updatedAt: new Date() },
      { new: true }
    );
    
    if (!updated) return undefined;

    return {
      id: updated._id,
      email: toNull(updated.email),
      firstName: toNull(updated.firstName),
      lastName: toNull(updated.lastName),
      profileImageUrl: toNull(updated.profileImageUrl),
      role: updated.role,
      points: updated.points || 0,
      isBlocked: updated.isBlocked || false,
      blockedReason: toNull(updated.blockedReason),
      blockedAt: toNull(updated.blockedAt),
      createdAt: toNull(updated.createdAt),
      updatedAt: toNull(updated.updatedAt),
    };
  }

  async getAllDocumentsForAdmin(): Promise<DocumentType[]> {
    const docs = await DocumentModel.find().sort({ createdAt: -1 });
    return docs.map(doc => mapDocumentToBase(doc));
  }

  async getDocumentByIdForAdmin(id: string): Promise<DocumentType | undefined> {
    const document = await DocumentModel.findById(id);
    if (!document) return undefined;

    return mapDocumentToBase(document);
  }

  async getRecentDocuments(limit: number): Promise<DocumentType[]> {
    const docs = await DocumentModel.find().sort({ createdAt: -1 }).limit(limit);
    return docs.map(doc => mapDocumentToBase(doc));
  }

  async getAdminStats(): Promise<{
    totalDocuments: number;
    totalUsers: number;
    totalFavorites: number;
    totalViews: number;
  }> {
    const [docCount, userCount, favCount, viewSum] = await Promise.all([
      DocumentModel.countDocuments(),
      User.countDocuments(),
      Favorite.countDocuments(),
      DocumentModel.aggregate([
        { $group: { _id: null, total: { $sum: '$viewCount' } } }
      ]).then(result => result[0]?.total || 0),
    ]);

    return {
      totalDocuments: docCount,
      totalUsers: userCount,
      totalFavorites: favCount,
      totalViews: viewSum,
    };
  }

  // User upload operations
  async getUserUploads(userId: string): Promise<UserUploadType[]> {
    const uploads = await UserUpload.find({ userId }).sort({ slot: 1 });
    return uploads.map(upload => ({
      id: upload._id,
      userId: upload.userId,
      slot: upload.slot,
      fileName: upload.fileName,
      fileType: upload.fileType,
      filePath: upload.filePath,
      fileSize: upload.fileSize,
      approvalStatus: upload.approvalStatus,
      reviewedBy: toNull(upload.reviewedBy),
      reviewedAt: toNull(upload.reviewedAt),
      pipelineStatus: toNull(upload.pipelineStatus),
      pipelineStartedAt: toNull(upload.pipelineStartedAt),
      pipelineCompletedAt: toNull(upload.pipelineCompletedAt),
      aiStatus: toNull(upload.aiStatus),
      aiGeneratedTitle: toNull(upload.aiGeneratedTitle),
      aiGeneratedDescription: toNull(upload.aiGeneratedDescription),
      aiGeneratedCategory: toNull(upload.aiGeneratedCategory),
      aiGeneratedAt: toNull(upload.aiGeneratedAt),
      aiError: toNull(upload.aiError),
      uploadedAt: toNull(upload.uploadedAt),
    }));
  }

  async getUserUploadCount(userId: string): Promise<number> {
    return await UserUpload.countDocuments({ userId });
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

  async createUserUpload(upload: InsertUserUpload): Promise<UserUploadType> {
    const newUpload = await UserUpload.create({
      _id: randomUUID(),
      ...upload,
    });
    
    return {
      id: newUpload._id,
      userId: newUpload.userId,
      slot: newUpload.slot,
      fileName: newUpload.fileName,
      fileType: newUpload.fileType,
      filePath: newUpload.filePath,
      fileSize: newUpload.fileSize,
      approvalStatus: newUpload.approvalStatus,
      reviewedBy: toNull(newUpload.reviewedBy),
      reviewedAt: toNull(newUpload.reviewedAt),
      pipelineStatus: toNull(newUpload.pipelineStatus),
      pipelineStartedAt: toNull(newUpload.pipelineStartedAt),
      pipelineCompletedAt: toNull(newUpload.pipelineCompletedAt),
      aiStatus: toNull(newUpload.aiStatus),
      aiGeneratedTitle: toNull(newUpload.aiGeneratedTitle),
      aiGeneratedDescription: toNull(newUpload.aiGeneratedDescription),
      aiGeneratedCategory: toNull(newUpload.aiGeneratedCategory),
      aiGeneratedAt: toNull(newUpload.aiGeneratedAt),
      aiError: toNull(newUpload.aiError),
      uploadedAt: toNull(newUpload.uploadedAt),
    };
  }

  async deleteUserUpload(id: string, userId: string): Promise<boolean> {
    const result = await UserUpload.deleteOne({ _id: id, userId });
    return result.deletedCount > 0;
  }

  // Admin upload operations
  async getAdminUploads(): Promise<AdminUploadType[]> {
    const uploads = await AdminUpload.find().sort({ uploadedAt: -1 });
    return uploads.map(upload => ({
      id: upload._id,
      uploadedBy: upload.uploadedBy,
      fileName: upload.fileName,
      fileType: upload.fileType,
      filePath: upload.filePath,
      fileSize: upload.fileSize,
      category: toNull(upload.category),
      pipelineStatus: upload.pipelineStatus,
      pipelineError: toNull(upload.pipelineError),
      pipelineStartedAt: toNull(upload.pipelineStartedAt),
      pipelineCompletedAt: toNull(upload.pipelineCompletedAt),
      aiStatus: toNull(upload.aiStatus),
      aiGeneratedTitle: toNull(upload.aiGeneratedTitle),
      aiGeneratedDescription: toNull(upload.aiGeneratedDescription),
      aiGeneratedCategory: toNull(upload.aiGeneratedCategory),
      aiGeneratedAt: toNull(upload.aiGeneratedAt),
      aiError: toNull(upload.aiError),
      uploadedAt: toNull(upload.uploadedAt),
    }));
  }

  async getAdminUploadById(id: string): Promise<AdminUploadType | undefined> {
    const upload = await AdminUpload.findById(id);
    if (!upload) return undefined;

    return {
      id: upload._id,
      uploadedBy: upload.uploadedBy,
      fileName: upload.fileName,
      fileType: upload.fileType,
      filePath: upload.filePath,
      fileSize: upload.fileSize,
      category: toNull(upload.category),
      subcategory: toNull(upload.subcategory),
      pipelineStatus: upload.pipelineStatus,
      pipelineError: toNull(upload.pipelineError),
      pipelineStartedAt: toNull(upload.pipelineStartedAt),
      pipelineCompletedAt: toNull(upload.pipelineCompletedAt),
      aiStatus: toNull(upload.aiStatus),
      aiGeneratedTitle: toNull(upload.aiGeneratedTitle),
      aiGeneratedDescription: toNull(upload.aiGeneratedDescription),
      aiGeneratedCategory: toNull(upload.aiGeneratedCategory),
      aiGeneratedAt: toNull(upload.aiGeneratedAt),
      aiError: toNull(upload.aiError),
      uploadedAt: toNull(upload.uploadedAt),
    };
  }

  async createAdminUpload(upload: InsertAdminUpload): Promise<AdminUploadType> {
    const newUpload = await AdminUpload.create({
      _id: randomUUID(),
      ...upload,
    });
    
    return {
      id: newUpload._id,
      uploadedBy: newUpload.uploadedBy,
      fileName: newUpload.fileName,
      fileType: newUpload.fileType,
      filePath: newUpload.filePath,
      fileSize: newUpload.fileSize,
      category: toNull(newUpload.category),
      subcategory: toNull(newUpload.subcategory),
      pipelineStatus: newUpload.pipelineStatus,
      pipelineStartedAt: toNull(newUpload.pipelineStartedAt),
      pipelineCompletedAt: toNull(newUpload.pipelineCompletedAt),
      aiStatus: toNull(newUpload.aiStatus),
      aiGeneratedTitle: toNull(newUpload.aiGeneratedTitle),
      aiGeneratedDescription: toNull(newUpload.aiGeneratedDescription),
      aiGeneratedCategory: toNull(newUpload.aiGeneratedCategory),
      aiGeneratedAt: toNull(newUpload.aiGeneratedAt),
      aiError: toNull(newUpload.aiError),
      uploadedAt: toNull(newUpload.uploadedAt),
    };
  }

  async deleteAdminUpload(id: string): Promise<boolean> {
    const result = await AdminUpload.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  async checkDuplicateFileHash(fileHash: string): Promise<{ isDuplicate: boolean; existingFileName?: string; existingUploadType?: 'admin' | 'user' }> {
    // Check in admin uploads
    const adminDuplicate = await AdminUpload.findOne({ fileHash });
    if (adminDuplicate) {
      return {
        isDuplicate: true,
        existingFileName: adminDuplicate.fileName,
        existingUploadType: 'admin'
      };
    }

    // Check in user uploads
    const userDuplicate = await UserUpload.findOne({ fileHash });
    if (userDuplicate) {
      return {
        isDuplicate: true,
        existingFileName: userDuplicate.fileName,
        existingUploadType: 'user'
      };
    }

    return { isDuplicate: false };
  }

  async deleteAllDuplicateRecords(): Promise<{ adminDeleted: number; userDeleted: number; details: string[] }> {
    const details: string[] = [];
    let adminDeleted = 0;
    let userDeleted = 0;

    // Find duplicates in admin uploads (group by fileHash, keep only the oldest one)
    const adminDuplicates = await AdminUpload.aggregate([
      { $group: { _id: "$fileHash", count: { $sum: 1 }, docs: { $push: { id: "$_id", fileName: "$fileName", uploadedAt: "$uploadedAt" } } } },
      { $match: { count: { $gt: 1 } } }
    ]);

    for (const group of adminDuplicates) {
      if (group.docs && group.docs.length > 1) {
        // Sort by uploadedAt, keep the oldest
        const sorted = group.docs.sort((a: any, b: any) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());
        // Delete all except the first (oldest)
        for (let i = 1; i < sorted.length; i++) {
          await AdminUpload.deleteOne({ _id: sorted[i].id });
          details.push(`Admin: Deleted duplicate "${sorted[i].fileName}"`);
          adminDeleted++;
        }
      }
    }

    // Find duplicates in user uploads (group by fileHash, keep only the oldest one)
    const userDuplicates = await UserUpload.aggregate([
      { $group: { _id: "$fileHash", count: { $sum: 1 }, docs: { $push: { id: "$_id", fileName: "$fileName", uploadedAt: "$uploadedAt" } } } },
      { $match: { count: { $gt: 1 } } }
    ]);

    for (const group of userDuplicates) {
      if (group.docs && group.docs.length > 1) {
        // Sort by uploadedAt, keep the oldest
        const sorted = group.docs.sort((a: any, b: any) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());
        // Delete all except the first (oldest)
        for (let i = 1; i < sorted.length; i++) {
          await UserUpload.deleteOne({ _id: sorted[i].id });
          details.push(`User: Deleted duplicate "${sorted[i].fileName}"`);
          userDeleted++;
        }
      }
    }

    return { adminDeleted, userDeleted, details };
  }

  async clearAllUploads(): Promise<{ adminCleared: number; userCleared: number }> {
    const adminResult = await AdminUpload.deleteMany({});
    const userResult = await UserUpload.deleteMany({});
    return {
      adminCleared: adminResult.deletedCount,
      userCleared: userResult.deletedCount
    };
  }

  async updatePipelineStatus(
    id: string, 
    status: string, 
    startedAt?: Date, 
    completedAt?: Date,
    error?: string
  ): Promise<AdminUploadType | undefined> {
    const updateData: any = { pipelineStatus: status };
    if (startedAt) updateData.pipelineStartedAt = startedAt;
    if (completedAt) updateData.pipelineCompletedAt = completedAt;
    if (error !== undefined) updateData.pipelineError = error;
    if (status === 'completed') updateData.pipelineError = null;

    const updated = await AdminUpload.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );
    
    if (!updated) return undefined;

    return {
      id: updated._id,
      uploadedBy: updated.uploadedBy,
      fileName: updated.fileName,
      fileType: updated.fileType,
      filePath: updated.filePath,
      fileSize: updated.fileSize,
      category: toNull(updated.category),
      pipelineStatus: updated.pipelineStatus,
      pipelineError: toNull(updated.pipelineError),
      pipelineStartedAt: toNull(updated.pipelineStartedAt),
      pipelineCompletedAt: toNull(updated.pipelineCompletedAt),
      aiStatus: toNull(updated.aiStatus),
      aiGeneratedTitle: toNull(updated.aiGeneratedTitle),
      aiGeneratedDescription: toNull(updated.aiGeneratedDescription),
      aiGeneratedCategory: toNull(updated.aiGeneratedCategory),
      aiGeneratedAt: toNull(updated.aiGeneratedAt),
      aiError: toNull(updated.aiError),
      uploadedAt: toNull(updated.uploadedAt),
    };
  }

  // User upload approval operations
  async getAllUserUploads(): Promise<(UserUploadType & { userName: string; userEmail: string })[]> {
    const uploads = await UserUpload.find()
      .sort({ uploadedAt: -1 });
    
    // Fetch user details for each upload
    const result = [];
    for (const upload of uploads) {
      const user = await User.findById(upload.userId);
      result.push({
        id: upload._id,
        userId: upload.userId,
        slot: upload.slot,
        fileName: upload.fileName,
        fileType: upload.fileType,
        filePath: upload.filePath,
        fileSize: upload.fileSize,
        approvalStatus: upload.approvalStatus,
        reviewedBy: toNull(upload.reviewedBy),
        reviewedAt: toNull(upload.reviewedAt),
        pipelineStatus: toNull(upload.pipelineStatus),
        pipelineStartedAt: toNull(upload.pipelineStartedAt),
        pipelineCompletedAt: toNull(upload.pipelineCompletedAt),
        aiStatus: toNull(upload.aiStatus),
        aiGeneratedTitle: toNull(upload.aiGeneratedTitle),
        aiGeneratedDescription: toNull(upload.aiGeneratedDescription),
        aiGeneratedCategory: toNull(upload.aiGeneratedCategory),
        aiGeneratedAt: toNull(upload.aiGeneratedAt),
        aiError: toNull(upload.aiError),
        uploadedAt: toNull(upload.uploadedAt),
        userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown',
        userEmail: user?.email || 'unknown@example.com',
      });
    }
    return result;
  }

  async getUserUploadById(id: string): Promise<UserUploadType | undefined> {
    const upload = await UserUpload.findById(id);
    if (!upload) return undefined;

    return {
      id: upload._id,
      userId: upload.userId,
      slot: upload.slot,
      fileName: upload.fileName,
      fileType: upload.fileType,
      filePath: upload.filePath,
      fileSize: upload.fileSize,
      approvalStatus: upload.approvalStatus,
      reviewedBy: toNull(upload.reviewedBy),
      reviewedAt: toNull(upload.reviewedAt),
      approvedCategory: toNull((upload as any).approvedCategory),
      pipelineStatus: toNull(upload.pipelineStatus),
      pipelineStartedAt: toNull(upload.pipelineStartedAt),
      pipelineCompletedAt: toNull(upload.pipelineCompletedAt),
      aiStatus: toNull(upload.aiStatus),
      aiGeneratedTitle: toNull(upload.aiGeneratedTitle),
      aiGeneratedDescription: toNull(upload.aiGeneratedDescription),
      aiGeneratedCategory: toNull(upload.aiGeneratedCategory),
      aiGeneratedAt: toNull(upload.aiGeneratedAt),
      aiError: toNull(upload.aiError),
      uploadedAt: toNull(upload.uploadedAt),
    };
  }

  async approveUserUpload(id: string, adminId: string, category: string): Promise<UserUploadType | undefined> {
    const updated = await UserUpload.findByIdAndUpdate(
      id,
      {
        approvalStatus: "approved",
        reviewedBy: adminId,
        reviewedAt: new Date(),
        approvedCategory: category,
      },
      { new: true }
    );
    
    if (!updated) return undefined;

    return {
      id: updated._id,
      userId: updated.userId,
      slot: updated.slot,
      fileName: updated.fileName,
      fileType: updated.fileType,
      filePath: updated.filePath,
      fileSize: updated.fileSize,
      approvalStatus: updated.approvalStatus,
      reviewedBy: toNull(updated.reviewedBy),
      reviewedAt: toNull(updated.reviewedAt),
      approvedCategory: toNull((updated as any).approvedCategory),
      pipelineStatus: toNull(updated.pipelineStatus),
      pipelineStartedAt: toNull(updated.pipelineStartedAt),
      pipelineCompletedAt: toNull(updated.pipelineCompletedAt),
      aiStatus: toNull(updated.aiStatus),
      aiGeneratedTitle: toNull(updated.aiGeneratedTitle),
      aiGeneratedDescription: toNull(updated.aiGeneratedDescription),
      aiGeneratedCategory: toNull(updated.aiGeneratedCategory),
      aiGeneratedAt: toNull(updated.aiGeneratedAt),
      aiError: toNull(updated.aiError),
      uploadedAt: toNull(updated.uploadedAt),
    };
  }

  async rejectUserUpload(id: string, adminId: string): Promise<UserUploadType | undefined> {
    const updated = await UserUpload.findByIdAndUpdate(
      id,
      {
        approvalStatus: "rejected",
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
      { new: true }
    );
    
    if (!updated) return undefined;

    return {
      id: updated._id,
      userId: updated.userId,
      slot: updated.slot,
      fileName: updated.fileName,
      fileType: updated.fileType,
      filePath: updated.filePath,
      fileSize: updated.fileSize,
      approvalStatus: updated.approvalStatus,
      reviewedBy: toNull(updated.reviewedBy),
      reviewedAt: toNull(updated.reviewedAt),
      pipelineStatus: toNull(updated.pipelineStatus),
      pipelineStartedAt: toNull(updated.pipelineStartedAt),
      pipelineCompletedAt: toNull(updated.pipelineCompletedAt),
      aiStatus: toNull(updated.aiStatus),
      aiGeneratedTitle: toNull(updated.aiGeneratedTitle),
      aiGeneratedDescription: toNull(updated.aiGeneratedDescription),
      aiGeneratedCategory: toNull(updated.aiGeneratedCategory),
      aiGeneratedAt: toNull(updated.aiGeneratedAt),
      aiError: toNull(updated.aiError),
      uploadedAt: toNull(updated.uploadedAt),
    };
  }

  async updateUserUploadPipelineStatus(
    id: string,
    status: string,
    startedAt?: Date,
    completedAt?: Date
  ): Promise<UserUploadType | undefined> {
    const updateData: any = { pipelineStatus: status };
    if (startedAt) updateData.pipelineStartedAt = startedAt;
    if (completedAt) updateData.pipelineCompletedAt = completedAt;

    const updated = await UserUpload.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );
    
    if (!updated) return undefined;

    return {
      id: updated._id,
      userId: updated.userId,
      slot: updated.slot,
      fileName: updated.fileName,
      fileType: updated.fileType,
      filePath: updated.filePath,
      fileSize: updated.fileSize,
      approvalStatus: updated.approvalStatus,
      reviewedBy: toNull(updated.reviewedBy),
      reviewedAt: toNull(updated.reviewedAt),
      pipelineStatus: toNull(updated.pipelineStatus),
      pipelineStartedAt: toNull(updated.pipelineStartedAt),
      pipelineCompletedAt: toNull(updated.pipelineCompletedAt),
      aiStatus: toNull(updated.aiStatus),
      aiGeneratedTitle: toNull(updated.aiGeneratedTitle),
      aiGeneratedDescription: toNull(updated.aiGeneratedDescription),
      aiGeneratedCategory: toNull(updated.aiGeneratedCategory),
      aiGeneratedAt: toNull(updated.aiGeneratedAt),
      aiError: toNull(updated.aiError),
      uploadedAt: toNull(updated.uploadedAt),
    };
  }

  async updateUserUploadMetadata(
    id: string,
    metadata: { title: string; description: string; category: string }
  ): Promise<void> {
    await UserUpload.findByIdAndUpdate(id, {
      aiStatus: "completed",
      aiGeneratedTitle: metadata.title,
      aiGeneratedDescription: metadata.description,
      aiGeneratedCategory: metadata.category,
      aiGeneratedAt: new Date(),
      aiError: undefined,
    });
  }

  async updateAdminUploadMetadata(
    id: string,
    metadata: { title: string; description: string; category: string }
  ): Promise<void> {
    await AdminUpload.findByIdAndUpdate(id, {
      aiStatus: "completed",
      aiGeneratedTitle: metadata.title,
      aiGeneratedDescription: metadata.description,
      aiGeneratedCategory: metadata.category,
      aiGeneratedAt: new Date(),
      aiError: undefined,
    });
  }

  async updateUserUploadAIError(id: string, error: string): Promise<void> {
    await UserUpload.findByIdAndUpdate(id, {
      aiStatus: "failed",
      aiError: error,
    });
  }

  async updateAdminUploadAIError(id: string, error: string): Promise<void> {
    await AdminUpload.findByIdAndUpdate(id, {
      aiStatus: "failed",
      aiError: error,
    });
  }

  // Category operations
  async getAllCategories() {
    const categories = await Category.find().sort({ order: 1 });
    return categories.map(cat => ({
      _id: cat._id,
      id: cat._id,
      name: cat.name,
      logoUrl: cat.logoUrl,
      order: cat.order,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
    }));
  }

  async getCategoryById(id: string) {
    const category = await Category.findById(id);
    if (!category) return undefined;
    
    return {
      _id: category._id,
      id: category._id,
      name: category.name,
      logoUrl: category.logoUrl,
      order: category.order,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  async createCategory(categoryData: Partial<{ name: string; logoUrl?: string; order: number }>) {
    const category = new Category({
      _id: randomUUID(),
      name: categoryData.name,
      logoUrl: categoryData.logoUrl,
      order: categoryData.order || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    await category.save();
    
    return {
      _id: category._id,
      id: category._id,
      name: category.name,
      logoUrl: category.logoUrl,
      order: category.order,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  async updateCategory(id: string, categoryData: Partial<{ name?: string; logoUrl?: string; order?: number }>) {
    const category = await Category.findByIdAndUpdate(
      id,
      {
        $set: {
          ...categoryData,
          updatedAt: new Date(),
        },
      },
      { new: true }
    );
    
    if (!category) return undefined;
    
    return {
      _id: category._id,
      id: category._id,
      name: category.name,
      logoUrl: category.logoUrl,
      order: category.order,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  async deleteCategory(id: string): Promise<boolean> {
    const result = await Category.findByIdAndDelete(id);
    return !!result;
  }

  // Chat support operations
  async getOrCreateConversation(userId?: string, guestId?: string, guestName?: string, guestEmail?: string) {
    let conversation;
    
    if (userId) {
      conversation = await ChatConversation.findOne({ userId, status: "active" });
    } else if (guestId) {
      conversation = await ChatConversation.findOne({ guestId, status: "active" });
    }

    if (conversation) {
      return {
        _id: conversation._id,
        id: conversation._id,
        userId: conversation.userId,
        guestId: conversation.guestId,
        guestName: conversation.guestName,
        guestEmail: conversation.guestEmail,
        status: conversation.status,
        unreadByAdmin: conversation.unreadByAdmin,
        unreadByUser: conversation.unreadByUser,
        lastMessageAt: conversation.lastMessageAt,
        lastMessagePreview: conversation.lastMessagePreview,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      };
    }

    const newConversation = new ChatConversation({
      _id: randomUUID(),
      userId,
      guestId,
      guestName,
      guestEmail,
      status: "active",
      unreadByAdmin: 0,
      unreadByUser: 0,
      lastMessageAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await newConversation.save();

    return {
      _id: newConversation._id,
      id: newConversation._id,
      userId: newConversation.userId,
      guestId: newConversation.guestId,
      guestName: newConversation.guestName,
      guestEmail: newConversation.guestEmail,
      status: newConversation.status,
      unreadByAdmin: newConversation.unreadByAdmin,
      unreadByUser: newConversation.unreadByUser,
      lastMessageAt: newConversation.lastMessageAt,
      lastMessagePreview: newConversation.lastMessagePreview,
      createdAt: newConversation.createdAt,
      updatedAt: newConversation.updatedAt,
    };
  }

  async getConversationById(id: string) {
    const conversation = await ChatConversation.findById(id);
    if (!conversation) return undefined;

    return {
      _id: conversation._id,
      id: conversation._id,
      userId: conversation.userId,
      guestId: conversation.guestId,
      guestName: conversation.guestName,
      guestEmail: conversation.guestEmail,
      status: conversation.status,
      unreadByAdmin: conversation.unreadByAdmin,
      unreadByUser: conversation.unreadByUser,
      lastMessageAt: conversation.lastMessageAt,
      lastMessagePreview: conversation.lastMessagePreview,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  async getConversationByUserId(userId: string) {
    const conversation = await ChatConversation.findOne({ userId, status: "active" });
    if (!conversation) return undefined;

    return {
      _id: conversation._id,
      id: conversation._id,
      userId: conversation.userId,
      guestId: conversation.guestId,
      guestName: conversation.guestName,
      guestEmail: conversation.guestEmail,
      status: conversation.status,
      unreadByAdmin: conversation.unreadByAdmin,
      unreadByUser: conversation.unreadByUser,
      lastMessageAt: conversation.lastMessageAt,
      lastMessagePreview: conversation.lastMessagePreview,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  async getConversationByGuestId(guestId: string) {
    const conversation = await ChatConversation.findOne({ guestId, status: "active" });
    if (!conversation) return undefined;

    return {
      _id: conversation._id,
      id: conversation._id,
      userId: conversation.userId,
      guestId: conversation.guestId,
      guestName: conversation.guestName,
      guestEmail: conversation.guestEmail,
      status: conversation.status,
      unreadByAdmin: conversation.unreadByAdmin,
      unreadByUser: conversation.unreadByUser,
      lastMessageAt: conversation.lastMessageAt,
      lastMessagePreview: conversation.lastMessagePreview,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  async getAllConversations() {
    const conversations = await ChatConversation.find()
      .sort({ lastMessageAt: -1 });

    return conversations.map(conversation => ({
      _id: conversation._id,
      id: conversation._id,
      userId: conversation.userId,
      guestId: conversation.guestId,
      guestName: conversation.guestName,
      guestEmail: conversation.guestEmail,
      status: conversation.status,
      unreadByAdmin: conversation.unreadByAdmin,
      unreadByUser: conversation.unreadByUser,
      lastMessageAt: conversation.lastMessageAt,
      lastMessagePreview: conversation.lastMessagePreview,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    }));
  }

  async updateConversationStatus(id: string, status: "active" | "closed") {
    const conversation = await ChatConversation.findByIdAndUpdate(
      id,
      { $set: { status, updatedAt: new Date() } },
      { new: true }
    );

    if (!conversation) return undefined;

    return {
      _id: conversation._id,
      id: conversation._id,
      userId: conversation.userId,
      guestId: conversation.guestId,
      guestName: conversation.guestName,
      guestEmail: conversation.guestEmail,
      status: conversation.status,
      unreadByAdmin: conversation.unreadByAdmin,
      unreadByUser: conversation.unreadByUser,
      lastMessageAt: conversation.lastMessageAt,
      lastMessagePreview: conversation.lastMessagePreview,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  // Chat message operations
  async getMessagesByConversationId(conversationId: string) {
    const messages = await ChatMessage.find({ conversationId })
      .sort({ createdAt: 1 });

    return messages.map(message => ({
      _id: message._id,
      id: message._id,
      conversationId: message.conversationId,
      senderType: message.senderType,
      senderId: message.senderId,
      senderName: message.senderName,
      content: message.content,
      isRead: message.isRead,
      createdAt: message.createdAt,
    }));
  }

  async createMessage(messageData: Partial<{
    conversationId: string;
    senderType: "user" | "admin" | "system";
    senderId?: string;
    senderName?: string;
    content: string;
  }>) {
    const message = new ChatMessage({
      _id: randomUUID(),
      conversationId: messageData.conversationId,
      senderType: messageData.senderType,
      senderId: messageData.senderId,
      senderName: messageData.senderName,
      content: messageData.content,
      isRead: false,
      createdAt: new Date(),
    });

    await message.save();

    // Update conversation with last message info and unread count
    const updateData: any = {
      lastMessageAt: new Date(),
      lastMessagePreview: messageData.content?.substring(0, 100),
      updatedAt: new Date(),
    };

    if (messageData.senderType === "user") {
      updateData.$inc = { unreadByAdmin: 1 };
    } else if (messageData.senderType === "admin") {
      updateData.$inc = { unreadByUser: 1 };
    }

    await ChatConversation.findByIdAndUpdate(
      messageData.conversationId,
      messageData.senderType === "user" || messageData.senderType === "admin"
        ? { $set: { lastMessageAt: new Date(), lastMessagePreview: messageData.content?.substring(0, 100), updatedAt: new Date() }, $inc: { [messageData.senderType === "user" ? "unreadByAdmin" : "unreadByUser"]: 1 } }
        : { $set: { lastMessageAt: new Date(), lastMessagePreview: messageData.content?.substring(0, 100), updatedAt: new Date() } }
    );

    return {
      _id: message._id,
      id: message._id,
      conversationId: message.conversationId,
      senderType: message.senderType,
      senderId: message.senderId,
      senderName: message.senderName,
      content: message.content,
      isRead: message.isRead,
      createdAt: message.createdAt,
    };
  }

  async markMessagesAsRead(conversationId: string, senderType: "user" | "admin") {
    // Mark all messages from the other party as read
    const oppositeType = senderType === "user" ? "admin" : "user";
    
    await ChatMessage.updateMany(
      { conversationId, senderType: oppositeType, isRead: false },
      { $set: { isRead: true } }
    );

    // Reset unread count for the reader
    const updateField = senderType === "user" ? "unreadByUser" : "unreadByAdmin";
    await ChatConversation.findByIdAndUpdate(
      conversationId,
      { $set: { [updateField]: 0 } }
    );
  }

  // Notification methods
  async createNotification(data: {
    title: string;
    content: string;
    type: "all" | "single";
    targetUserId?: string;
    senderId: string;
    senderName?: string;
  }) {
    const notification = new Notification({
      _id: randomUUID(),
      ...data,
      isRead: false,
      createdAt: new Date(),
    });
    await notification.save();
    return {
      id: notification._id,
      _id: notification._id,
      title: notification.title,
      content: notification.content,
      type: notification.type,
      targetUserId: notification.targetUserId,
      senderId: notification.senderId,
      senderName: notification.senderName,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    };
  }

  async getNotificationsForUser(userId: string) {
    // Get all notifications that are either:
    // 1. Type "all" (broadcast to everyone)
    // 2. Type "single" and targetUserId matches this user
    const notifications = await Notification.find({
      $or: [
        { type: "all" },
        { type: "single", targetUserId: userId }
      ]
    }).sort({ createdAt: -1 }).limit(50);

    // Get read status for each notification
    const readNotifications = await NotificationRead.find({
      userId,
      notificationId: { $in: notifications.map(n => n._id) }
    });
    const readSet = new Set(readNotifications.map(r => r.notificationId));

    return notifications.map(n => ({
      id: n._id,
      _id: n._id,
      title: n.title,
      content: n.content,
      type: n.type,
      targetUserId: n.targetUserId,
      senderId: n.senderId,
      senderName: n.senderName,
      isRead: readSet.has(n._id),
      createdAt: n.createdAt,
    }));
  }

  async getUnreadNotificationCount(userId: string) {
    // Get all notifications for this user
    const notifications = await Notification.find({
      $or: [
        { type: "all" },
        { type: "single", targetUserId: userId }
      ]
    });

    // Get read notifications
    const readNotifications = await NotificationRead.find({
      userId,
      notificationId: { $in: notifications.map(n => n._id) }
    });
    const readSet = new Set(readNotifications.map(r => r.notificationId));

    // Count unread
    return notifications.filter(n => !readSet.has(n._id)).length;
  }

  async markNotificationAsRead(notificationId: string, userId: string) {
    const existing = await NotificationRead.findOne({ notificationId, userId });
    if (!existing) {
      const read = new NotificationRead({
        _id: randomUUID(),
        notificationId,
        userId,
        readAt: new Date(),
      });
      await read.save();
    }
    return true;
  }

  async markAllNotificationsAsRead(userId: string) {
    // Get all unread notifications for this user
    const notifications = await Notification.find({
      $or: [
        { type: "all" },
        { type: "single", targetUserId: userId }
      ]
    });

    const readNotifications = await NotificationRead.find({
      userId,
      notificationId: { $in: notifications.map(n => n._id) }
    });
    const readSet = new Set(readNotifications.map(r => r.notificationId));

    // Create read records for unread notifications
    const unreadNotifications = notifications.filter(n => !readSet.has(n._id));
    for (const notification of unreadNotifications) {
      const read = new NotificationRead({
        _id: randomUUID(),
        notificationId: notification._id,
        userId,
        readAt: new Date(),
      });
      await read.save();
    }
    return true;
  }

  async getAllNotifications() {
    const notifications = await Notification.find()
      .sort({ createdAt: -1 })
      .limit(100);
    return notifications.map(n => ({
      id: n._id,
      _id: n._id,
      title: n.title,
      content: n.content,
      type: n.type,
      targetUserId: n.targetUserId,
      senderId: n.senderId,
      senderName: n.senderName,
      isRead: n.isRead,
      createdAt: n.createdAt,
    }));
  }

  async deleteNotification(notificationId: string) {
    await NotificationRead.deleteMany({ notificationId });
    const result = await Notification.findByIdAndDelete(notificationId);
    return !!result;
  }

  // User Post View tracking - limit 10 posts per user
  async getUserViewedPostsCount(userId: string): Promise<number> {
    return await UserPostView.countDocuments({ userId });
  }

  async hasUserViewedPost(userId: string, documentId: string): Promise<boolean> {
    const view = await UserPostView.findOne({ userId, documentId });
    return !!view;
  }

  async recordUserPostView(userId: string, documentId: string): Promise<boolean> {
    const existing = await UserPostView.findOne({ userId, documentId });
    if (existing) {
      return true; // Already viewed, doesn't count toward limit
    }
    
    const count = await UserPostView.countDocuments({ userId });
    if (count >= 10) {
      return false; // User has reached view limit
    }
    
    const view = new UserPostView({
      _id: randomUUID(),
      userId,
      documentId,
      viewedAt: new Date(),
    });
    await view.save();
    return true;
  }

  async getUserViewStats(userId: string): Promise<{ viewedCount: number; maxViews: number; remainingViews: number }> {
    const viewedCount = await UserPostView.countDocuments({ userId });
    return {
      viewedCount,
      maxViews: 10,
      remainingViews: Math.max(0, 10 - viewedCount),
    };
  }

  async getUserViewedPosts(userId: string): Promise<string[]> {
    const views = await UserPostView.find({ userId }).sort({ viewedAt: -1 });
    return views.map(v => v.documentId);
  }

  // User Redeemed Files - files user has exchanged points for
  // SECURITY: Do not expose filePath to frontend - only return metadata
  async getUserRedeemedFiles(userId: string) {
    const files = await UserRedeemedFile.find({ userId }).sort({ redeemedAt: -1 });
    return files.map(f => ({
      id: f._id,
      userId: f.userId,
      documentId: f.documentId,
      postId: f.postId,
      documentTitle: f.documentTitle,
      fileName: f.fileName,
      fileSize: f.fileSize,
      pointsCost: f.pointsCost,
      redeemedAt: f.redeemedAt,
      // filePath intentionally excluded - use download proxy endpoint instead
    }));
  }

  async hasUserRedeemedDocument(userId: string, documentId: string): Promise<boolean> {
    const existing = await UserRedeemedFile.findOne({ userId, documentId });
    return !!existing;
  }

  async getRedeemedFile(userId: string, redeemedFileId: string) {
    const file = await UserRedeemedFile.findOne({ _id: redeemedFileId, userId });
    if (!file) return null;
    return {
      id: file._id,
      userId: file.userId,
      documentId: file.documentId,
      postId: file.postId,
      documentTitle: file.documentTitle,
      fileName: file.fileName,
      fileSize: file.fileSize,
      filePath: file.filePath,
      pointsCost: file.pointsCost,
      redeemedAt: file.redeemedAt,
    };
  }

  async createUserRedeemedFile(data: {
    userId: string;
    documentId: string;
    postId: string;
    documentTitle: string;
    fileName: string;
    fileSize: number;
    filePath: string;
    pointsCost: number;
  }) {
    const file = new UserRedeemedFile({
      _id: randomUUID(),
      ...data,
      redeemedAt: new Date(),
    });
    await file.save();
    return {
      id: file._id,
      userId: file.userId,
      documentId: file.documentId,
      postId: file.postId,
      documentTitle: file.documentTitle,
      fileName: file.fileName,
      fileSize: file.fileSize,
      filePath: file.filePath,
      pointsCost: file.pointsCost,
      redeemedAt: file.redeemedAt,
    };
  }

  async deductUserPoints(userId: string, points: number): Promise<boolean> {
    const user = await User.findById(userId);
    if (!user || user.points < points) {
      return false;
    }
    user.points -= points;
    user.updatedAt = new Date();
    await user.save();
    return true;
  }
}

export const storage = new MongoDBStorage();
