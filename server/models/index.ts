import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  role: "admin" | "user";
  points: number;
  isBlocked: boolean;
  blockedReason?: string;
  blockedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDocumentImage {
  sheet: string;
  page: number;
  url: string;
}

export interface IDocument extends Document {
  _id: string;
  postId: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string | null;
  pageCount: number;
  pointsCost: number;
  coverImageUrl: string;
  imageUrls: IDocumentImage[];
  viewCount: number;
  favoriteCount: number;
  aiGenerated: boolean;
  aiGeneratedAt?: Date;
  originalFileName?: string;
  parentPostId?: string;
  postIndex?: number;
  totalParts?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFavorite extends Document {
  _id: string;
  userId: string;
  documentId: string;
  createdAt: Date;
}

export interface ITag extends Document {
  _id: string;
  name: string;
  createdAt: Date;
}

export interface IDocumentTag extends Document {
  _id: string;
  documentId: string;
  tagId: string;
  createdAt: Date;
}

export interface IUserUpload extends Document {
  _id: string;
  userId: string;
  slot: number;
  fileName: string;
  fileType: string;
  filePath: string;
  fileSize: number;
  fileHash?: string;
  category?: string;
  approvalStatus: "pending" | "approved" | "rejected";
  reviewedBy?: string;
  reviewedAt?: Date;
  approvedCategory?: string;
  pipelineStatus: "not_started" | "processing" | "completed" | "failed" | "skipped";
  pipelineStartedAt?: Date;
  pipelineCompletedAt?: Date;
  aiStatus?: "pending" | "processing" | "completed" | "failed";
  aiError?: string;
  aiGeneratedTitle?: string;
  aiGeneratedDescription?: string;
  aiGeneratedCategory?: string;
  aiGeneratedAt?: Date;
  uploadedAt: Date;
}

export interface IAdminUpload extends Document {
  _id: string;
  uploadedBy: string;
  fileName: string;
  fileType: string;
  filePath: string;
  fileSize: number;
  fileHash?: string;
  category?: string;
  pipelineStatus: "pending" | "processing" | "completed" | "failed";
  pipelineError?: string;
  pipelineStartedAt?: Date;
  pipelineCompletedAt?: Date;
  aiStatus?: "pending" | "processing" | "completed" | "failed";
  aiError?: string;
  aiGeneratedTitle?: string;
  aiGeneratedDescription?: string;
  aiGeneratedCategory?: string;
  aiGeneratedAt?: Date;
  uploadedAt: Date;
}

export interface ICategory extends Document {
  _id: string;
  name: string;
  logoUrl?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubcategory extends Document {
  _id: string;
  name: string;
  categoryId: string;
  parentSubcategoryId?: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IChatConversation extends Document {
  _id: string;
  
  userId?: string;
  guestId?: string;
  guestName?: string;
  guestEmail?: string;
  
  status: "active" | "closed";
  unreadByAdmin: number;
  unreadByUser: number;
  lastMessageAt: Date;
  lastMessagePreview?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IChatMessage extends Document {
  _id: string;
  conversationId: string;
  
  senderType: "user" | "admin" | "system";
  senderId?: string;
  senderName?: string;
  
  content: string;
  isRead: boolean;
  
  createdAt: Date;
}

export interface INotification extends Document {
  _id: string;
  title: string;
  content: string;
  type: "all" | "single";
  targetUserId?: string;
  senderId: string;
  senderName?: string;
  isRead: boolean;
  createdAt: Date;
}

export interface INotificationRead extends Document {
  _id: string;
  notificationId: string;
  userId: string;
  readAt: Date;
}

export interface IPointsAuditLog extends Document {
  _id: string;
  userId: string;
  adminId: string;
  adminEmail: string;
  previousPoints: number;
  newPoints: number;
  changeAmount: number;
  reason: string;
  actionType: "manual" | "upload_reward" | "redemption";
  relatedDocumentId?: string;
  relatedUploadId?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface IRedemptionLog extends Document {
  _id: string;
  userId: string;
  userEmail: string;
  documentId: string;
  documentTitle: string;
  postId: string;
  pointsDeducted: number;
  previousPoints: number;
  newPoints: number;
  createdAt: Date;
}

// Legitimate Points Whitelist - tracks points awarded by super admin only
export interface ILegitimatePointsAward {
  amount: number;
  reason: string;
  awardedAt: Date;
  relatedUploadId?: string;
}

export interface ILegitimatePoints extends Document {
  _id: string;
  userId: string;
  userEmail: string;
  totalLegitimatePoints: number;
  totalPointsUsed: number;
  awards: ILegitimatePointsAward[];
  lastAwardedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  _id: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  firstName: String,
  lastName: String,
  profileImageUrl: String,
  role: { type: String, enum: ["admin", "user"], default: "user" },
  points: { type: Number, default: 0 },
  isBlocked: { type: Boolean, default: false },
  blockedReason: String,
  blockedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const DocumentImageSchema = new Schema({
  sheet: { type: String, required: true },
  page: { type: Number, required: true },
  url: { type: String, required: true }
}, { _id: false });

const DocumentSchema = new Schema<IDocument>({
  _id: { type: String, required: true },
  postId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  subcategory: { type: String, default: null },
  pageCount: { type: Number, required: true },
  pointsCost: { type: Number, default: 0 },
  coverImageUrl: { type: String, required: true },
  imageUrls: { type: [DocumentImageSchema], default: [] },
  viewCount: { type: Number, default: 0 },
  favoriteCount: { type: Number, default: 0 },
  aiGenerated: { type: Boolean, default: false },
  aiGeneratedAt: Date,
  originalFileName: String,
  parentPostId: String,
  postIndex: Number,
  totalParts: Number,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const FavoriteSchema = new Schema<IFavorite>({
  _id: { type: String, required: true },
  userId: { type: String, required: true, ref: "User" },
  documentId: { type: String, required: true, ref: "Document" },
  createdAt: { type: Date, default: Date.now }
});

FavoriteSchema.index({ userId: 1, documentId: 1 }, { unique: true });

const TagSchema = new Schema<ITag>({
  _id: { type: String, required: true },
  name: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});

const DocumentTagSchema = new Schema<IDocumentTag>({
  _id: { type: String, required: true },
  documentId: { type: String, required: true, ref: "Document" },
  tagId: { type: String, required: true, ref: "Tag" },
  createdAt: { type: Date, default: Date.now }
});

DocumentTagSchema.index({ documentId: 1, tagId: 1 }, { unique: true });

const UserUploadSchema = new Schema<IUserUpload>({
  _id: { type: String, required: true },
  userId: { type: String, required: true, ref: "User" },
  slot: { type: Number, required: true, min: 1, max: 10 },
  fileName: { type: String, required: true },
  fileType: { type: String, required: true },
  filePath: { type: String, required: true },
  fileSize: { type: Number, required: true },
  fileHash: { type: String, index: true },
  category?: string, // Danh mục user chọn lúc upload
  approvalStatus: { 
    type: String, 
    enum: ["pending", "approved", "rejected"], 
    default: "pending" 
  },
  reviewedBy: { type: String, ref: "User" },
  reviewedAt: Date,
  approvedCategory: String,
  pipelineStatus: { 
    type: String, 
    enum: ["not_started", "processing", "completed", "failed", "skipped"], 
    default: "not_started" 
  },
  pipelineStartedAt: Date,
  pipelineCompletedAt: Date,
  aiStatus: { 
    type: String, 
    enum: ["pending", "processing", "completed", "failed"] 
  },
  aiError: String,
  aiGeneratedTitle: String,
  aiGeneratedDescription: String,
  aiGeneratedCategory: String,
  aiGeneratedAt: Date,
  uploadedAt: { type: Date, default: Date.now }
});

UserUploadSchema.index({ userId: 1, slot: 1 }, { unique: true });

const AdminUploadSchema = new Schema<IAdminUpload>({
  _id: { type: String, required: true },
  uploadedBy: { type: String, required: true, ref: "User" },
  fileName: { type: String, required: true },
  fileType: { type: String, required: true },
  filePath: { type: String, required: true },
  fileSize: { type: Number, required: true },
  fileHash: { type: String, index: true },
  category: String,
  subcategory: String,
  pipelineStatus: { 
    type: String, 
    enum: ["pending", "processing", "completed", "failed"], 
    default: "pending" 
  },
  pipelineError: String,
  pipelineStartedAt: Date,
  pipelineCompletedAt: Date,
  aiStatus: { 
    type: String, 
    enum: ["pending", "processing", "completed", "failed"] 
  },
  aiError: String,
  aiGeneratedTitle: String,
  aiGeneratedDescription: String,
  aiGeneratedCategory: String,
  aiGeneratedAt: Date,
  uploadedAt: { type: Date, default: Date.now }
});

const CategorySchema = new Schema<ICategory>({
  _id: { type: String, required: true },
  name: { type: String, required: true, unique: true },
  logoUrl: String,
  order: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const SubcategorySchema = new Schema<ISubcategory>({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  categoryId: { type: String, required: true, ref: "Category" },
  parentSubcategoryId: { type: String, default: null, ref: "Subcategory" },
  order: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

SubcategorySchema.index({ categoryId: 1, parentSubcategoryId: 1, name: 1 }, { unique: true });

const ChatConversationSchema = new Schema<IChatConversation>({
  _id: { type: String, required: true },
  userId: { type: String, ref: "User" },
  guestId: String,
  guestName: String,
  guestEmail: String,
  status: { type: String, enum: ["active", "closed"], default: "active" },
  unreadByAdmin: { type: Number, default: 0 },
  unreadByUser: { type: Number, default: 0 },
  lastMessageAt: { type: Date, default: Date.now },
  lastMessagePreview: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

ChatConversationSchema.index({ userId: 1 });
ChatConversationSchema.index({ guestId: 1 });
ChatConversationSchema.index({ status: 1, lastMessageAt: -1 });

const ChatMessageSchema = new Schema<IChatMessage>({
  _id: { type: String, required: true },
  conversationId: { type: String, required: true, ref: "ChatConversation" },
  senderType: { type: String, enum: ["user", "admin", "system"], required: true },
  senderId: String,
  senderName: String,
  content: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

ChatMessageSchema.index({ conversationId: 1, createdAt: 1 });

const NotificationSchema = new Schema<INotification>({
  _id: { type: String, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ["all", "single"], required: true },
  targetUserId: { type: String, ref: "User" },
  senderId: { type: String, required: true, ref: "User" },
  senderName: String,
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

NotificationSchema.index({ type: 1, createdAt: -1 });
NotificationSchema.index({ targetUserId: 1, createdAt: -1 });

const NotificationReadSchema = new Schema<INotificationRead>({
  _id: { type: String, required: true },
  notificationId: { type: String, required: true, ref: "Notification" },
  userId: { type: String, required: true, ref: "User" },
  readAt: { type: Date, default: Date.now }
});

NotificationReadSchema.index({ notificationId: 1, userId: 1 }, { unique: true });
NotificationReadSchema.index({ userId: 1, readAt: -1 });

const PointsAuditLogSchema = new Schema<IPointsAuditLog>({
  _id: { type: String, required: true },
  userId: { type: String, required: true, ref: "User" },
  adminId: { type: String, required: true, ref: "User" },
  adminEmail: { type: String, required: true },
  previousPoints: { type: Number, required: true },
  newPoints: { type: Number, required: true },
  changeAmount: { type: Number, required: true },
  reason: { type: String, required: true },
  actionType: { type: String, enum: ["manual", "upload_reward", "redemption"], default: "manual" },
  relatedDocumentId: String,
  relatedUploadId: String,
  ipAddress: String,
  userAgent: String,
  createdAt: { type: Date, default: Date.now }
});

PointsAuditLogSchema.index({ userId: 1, createdAt: -1 });
PointsAuditLogSchema.index({ adminId: 1, createdAt: -1 });
PointsAuditLogSchema.index({ createdAt: -1 });
PointsAuditLogSchema.index({ actionType: 1, createdAt: -1 });

const RedemptionLogSchema = new Schema<IRedemptionLog>({
  _id: { type: String, required: true },
  userId: { type: String, required: true, ref: "User" },
  userEmail: { type: String, required: true },
  documentId: { type: String, required: true, ref: "Document" },
  documentTitle: { type: String, required: true },
  postId: { type: String, required: true },
  pointsDeducted: { type: Number, required: true },
  previousPoints: { type: Number, required: true },
  newPoints: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

RedemptionLogSchema.index({ userId: 1, createdAt: -1 });
RedemptionLogSchema.index({ documentId: 1, createdAt: -1 });
RedemptionLogSchema.index({ createdAt: -1 });

const LegitimatePointsAwardSchema = new Schema({
  amount: { type: Number, required: true },
  reason: { type: String, required: true },
  awardedAt: { type: Date, default: Date.now },
  relatedUploadId: String
}, { _id: false });

const LegitimatePointsSchema = new Schema<ILegitimatePoints>({
  _id: { type: String, required: true },
  userId: { type: String, required: true, ref: "User", unique: true },
  userEmail: { type: String, required: true },
  totalLegitimatePoints: { type: Number, default: 0 },
  totalPointsUsed: { type: Number, default: 0 },
  awards: { type: [LegitimatePointsAwardSchema], default: [] },
  lastAwardedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const User = mongoose.model<IUser>("User", UserSchema);
export const DocumentModel = mongoose.model<IDocument>("Document", DocumentSchema);
export const Favorite = mongoose.model<IFavorite>("Favorite", FavoriteSchema);
export const Tag = mongoose.model<ITag>("Tag", TagSchema);
export const DocumentTag = mongoose.model<IDocumentTag>("DocumentTag", DocumentTagSchema);
export const UserUpload = mongoose.model<IUserUpload>("UserUpload", UserUploadSchema);
export const AdminUpload = mongoose.model<IAdminUpload>("AdminUpload", AdminUploadSchema);
export const Category = mongoose.model<ICategory>("Category", CategorySchema);
export const Subcategory = mongoose.model<ISubcategory>("Subcategory", SubcategorySchema);
export const ChatConversation = mongoose.model<IChatConversation>("ChatConversation", ChatConversationSchema);
export const ChatMessage = mongoose.model<IChatMessage>("ChatMessage", ChatMessageSchema);
export const Notification = mongoose.model<INotification>("Notification", NotificationSchema);
export const NotificationRead = mongoose.model<INotificationRead>("NotificationRead", NotificationReadSchema);
export const PointsAuditLog = mongoose.model<IPointsAuditLog>("PointsAuditLog", PointsAuditLogSchema);
export const RedemptionLog = mongoose.model<IRedemptionLog>("RedemptionLog", RedemptionLogSchema);
export const LegitimatePoints = mongoose.model<ILegitimatePoints>("LegitimatePoints", LegitimatePointsSchema);

// User Post View tracking - limits each user to viewing max 10 posts
export interface IUserPostView extends Document {
  _id: string;
  userId: string;
  documentId: string;
  viewedAt: Date;
}

// User Redeemed Files - files that user has redeemed with points
export interface IUserRedeemedFile extends Document {
  _id: string;
  userId: string;
  documentId: string;
  postId: string;
  documentTitle: string;
  fileName: string;
  fileSize: number;
  filePath: string; // Stored path for user (separate from original storage)
  pointsCost: number;
  redeemedAt: Date;
}

const UserPostViewSchema = new Schema<IUserPostView>({
  _id: { type: String, required: true },
  userId: { type: String, required: true, ref: "User" },
  documentId: { type: String, required: true, ref: "Document" },
  viewedAt: { type: Date, default: Date.now }
});

UserPostViewSchema.index({ userId: 1, documentId: 1 }, { unique: true });
UserPostViewSchema.index({ userId: 1, viewedAt: -1 });

const UserRedeemedFileSchema = new Schema<IUserRedeemedFile>({
  _id: { type: String, required: true },
  userId: { type: String, required: true, ref: "User" },
  documentId: { type: String, required: true, ref: "Document" },
  postId: { type: String, required: true },
  documentTitle: { type: String, required: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  filePath: { type: String, required: true },
  pointsCost: { type: Number, required: true },
  redeemedAt: { type: Date, default: Date.now }
});

UserRedeemedFileSchema.index({ userId: 1, redeemedAt: -1 });
UserRedeemedFileSchema.index({ userId: 1, documentId: 1 }, { unique: true });

export const UserPostView = mongoose.model<IUserPostView>("UserPostView", UserPostViewSchema);
export const UserRedeemedFile = mongoose.model<IUserRedeemedFile>("UserRedeemedFile", UserRedeemedFileSchema);
