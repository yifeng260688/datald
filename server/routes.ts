import type { Express } from "express";
import { createServer, type Server } from "http";
import type { IStorage } from "./storage";
import { MongoDBStorage } from "./mongo-storage";
import { MemStorage } from "./mem-storage";
import { connectMongoDB } from "./mongodb";
import { setupGoogleAuth, isAuthenticated, setStorage } from "./googleAuth";
import crypto from "crypto";

let storage: IStorage;
import { insertDocumentSchema, insertFavoriteSchema, insertTagSchema, insertUserUploadSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { processAdminUpload, processUserUploadApproval } from "./pipeline/runner";
import { processFileWithAI } from "./services/aiProcessor";
import { PointsAuditLog, RedemptionLog, Subcategory, User } from "./models";
import { 
  recordLegitimateAward, 
  recordPointsUsage, 
  validateUserLegitimacy, 
  blockUser,
  unblockUser,
  getLegitimatePointsRecord,
  getAllUsersWithLegitimatePoints,
  SUPER_ADMIN_EMAIL 
} from "./services/pointsLegitimacy";

// Calculate MD5 hash of a file for duplicate detection
function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// Admin middleware
const isAdmin = async (req: any, res: any, next: any) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden - Admin access required" });
    }
    next();
  } catch (error) {
    console.error("Error in admin middleware:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Helper function to format date as dd-mm-yyyy
function formatDateForFilename(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// Configure multer for user file uploads (10MB max)
const USER_UPLOAD_DIR = path.join(process.cwd(), "User-Upload");
const userStorageMulter = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(USER_UPLOAD_DIR)) {
      fs.mkdirSync(USER_UPLOAD_DIR, { recursive: true, mode: 0o700 });
    }
    cb(null, USER_UPLOAD_DIR);
  },
  filename: (req: any, file, cb) => {
    const now = new Date();
    const dateStr = formatDateForFilename(now);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    // Format: "original-filename-dd-mm-yyyy.ext"
    cb(null, `${nameWithoutExt}-${dateStr}${ext}`);
  }
});

const upload = multer({
  storage: userStorageMulter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, CSV, and Excel files are allowed."));
    }
  }
});

// Configure multer for admin bulk uploads (500MB max)
const ADMIN_UPLOAD_DIR = path.join(process.cwd(), "Admin-Upload");
const adminStorageMulter = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(ADMIN_UPLOAD_DIR)) {
      fs.mkdirSync(ADMIN_UPLOAD_DIR, { recursive: true, mode: 0o700 });
    }
    cb(null, ADMIN_UPLOAD_DIR);
  },
  filename: (req: any, file, cb) => {
    const now = new Date();
    const dateStr = formatDateForFilename(now);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    // Format: "original-filename-dd-mm-yyyy.ext"
    cb(null, `${nameWithoutExt}-${dateStr}${ext}`);
  }
});

const adminUpload = multer({
  storage: adminStorageMulter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, CSV, and Excel files are allowed."));
    }
  }
});

export async function registerRoutes(app: Express, server?: Server): Promise<Server> {
  // Try to connect to MongoDB, fall back to in-memory storage if it fails
  const mongoConnected = await connectMongoDB();
  
  if (mongoConnected) {
    console.log("✅ Using MongoDB persistent storage");
    storage = new MongoDBStorage();
  } else {
    console.log("⚠️  Using IN-MEMORY storage - all data will be lost on restart!");
    storage = new MemStorage();
  }
  
  // Pass storage to auth module
  setStorage(storage);
  
  // Seed initial categories if none exist
  if (mongoConnected) {
    try {
      const existingCategories = await storage.getAllCategories();
      if (existingCategories.length === 0) {
        console.log("📦 Seeding initial categories...");
        const initialCategories = [
          { name: "Data khách hàng Casino", order: 1 },
          { name: "Data Doanh Nghiệp", order: 2 },
          { name: "Data Bất Động Sản", order: 3 },
          { name: "Data Ngân Hàng", order: 4 },
          { name: "Data Bảo Hiểm", order: 5 },
          { name: "Data Email", order: 6 },
          { name: "Khác", order: 7 },
        ];
        
        for (const cat of initialCategories) {
          await storage.createCategory(cat);
        }
        
        console.log("✅ Initial categories seeded successfully");
      }
    } catch (error) {
      console.error("Error seeding categories:", error);
    }
  }
  
  // Google Auth middleware
  await setupGoogleAuth(app, mongoConnected);

  // Auth routes
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Invalid session" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User view stats - get how many posts user has viewed
  app.get('/api/user/view-stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getUserViewStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching view stats:", error);
      res.status(500).json({ message: "Failed to fetch view stats" });
    }
  });

  // Document routes
  app.get("/api/documents", async (req: any, res) => {
    try {
      let userId: string | undefined;
      if (req.isAuthenticated() && req.user?.claims?.sub) {
        userId = req.user.claims.sub;
      }
      const documents = await storage.getAllDocuments(userId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.get("/api/documents/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      let userId: string | undefined;
      if (req.isAuthenticated() && req.user?.claims?.sub) {
        userId = req.user.claims.sub;
      }
      
      const document = await storage.getDocumentById(id, userId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check if user is blocked
      if (userId) {
        const user = await storage.getUser(userId);
        if (user?.isBlocked) {
          return res.status(403).json({ 
            message: "Tài khoản của bạn đã bị khóa. Bạn không thể xem nội dung bài viết. Vui lòng liên hệ admin để được hỗ trợ.",
            code: "USER_BLOCKED",
            blockedReason: user.blockedReason
          });
        }
        
        // Admin users bypass the view limit
        if (user?.role !== 'admin') {
          const canView = await storage.recordUserPostView(userId, id);
          if (!canView) {
            return res.status(403).json({ 
              message: "Bạn đã đạt giới hạn xem 10 bài đăng. Vui lòng liên hệ admin để được hỗ trợ.",
              code: "VIEW_LIMIT_REACHED"
            });
          }
        }
      }

      // Increment view count
      await storage.incrementViewCount(id);

      res.json(document);
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ message: "Failed to fetch document" });
    }
  });

  app.get("/api/documents/:id/related", async (req: any, res) => {
    try {
      const { id } = req.params;
      let userId: string | undefined;
      if (req.isAuthenticated() && req.user?.claims?.sub) {
        userId = req.user.claims.sub;
      }

      const relatedDocuments = await storage.getRelatedDocuments(id, userId);
      res.json(relatedDocuments);
    } catch (error) {
      console.error("Error fetching related documents:", error);
      res.status(500).json({ message: "Failed to fetch related documents" });
    }
  });

  // ============================================
  // Image Proxy Endpoints - Hide DO Spaces URLs
  // ============================================
  
  // Proxy for cover images - fetches from DO Spaces without exposing URLs
  app.get("/api/documents/:id/cover", async (req: any, res) => {
    try {
      const { id } = req.params;
      const rawDoc = await storage.getDocumentByIdRaw(id);
      
      if (!rawDoc || !rawDoc.coverImageUrl) {
        return res.status(404).json({ message: "Cover image not found" });
      }
      
      const { extractKeyFromCdnUrl, downloadFromSpaces } = await import("./services/doSpaces");
      const key = extractKeyFromCdnUrl(rawDoc.coverImageUrl);
      
      if (!key) {
        return res.status(404).json({ message: "Invalid cover image URL" });
      }
      
      const result = await downloadFromSpaces(key);
      
      if (!result.success || !result.buffer) {
        return res.status(404).json({ message: "Failed to fetch cover image" });
      }
      
      res.set({
        'Content-Type': result.contentType || 'image/png',
        'Content-Length': result.buffer.length,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      });
      res.send(result.buffer);
    } catch (error) {
      console.error("Error proxying cover image:", error);
      res.status(500).json({ message: "Failed to fetch cover image" });
    }
  });
  
  // Proxy for gallery images - fetches from DO Spaces without exposing URLs
  app.get("/api/documents/:id/images/:index", async (req: any, res) => {
    try {
      const { id, index } = req.params;
      const imageIndex = parseInt(index, 10);
      
      if (isNaN(imageIndex) || imageIndex < 0) {
        return res.status(400).json({ message: "Invalid image index" });
      }
      
      const rawDoc = await storage.getDocumentByIdRaw(id);
      
      if (!rawDoc) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      const imageUrls = rawDoc.imageUrls || [];
      
      if (imageIndex >= imageUrls.length) {
        return res.status(404).json({ message: "Image not found" });
      }
      
      const imageData = imageUrls[imageIndex];
      const imageUrl = typeof imageData === 'string' ? imageData : imageData?.url;
      
      if (!imageUrl) {
        return res.status(404).json({ message: "Image URL not found" });
      }
      
      const { extractKeyFromCdnUrl, downloadFromSpaces } = await import("./services/doSpaces");
      const key = extractKeyFromCdnUrl(imageUrl);
      
      if (!key) {
        return res.status(404).json({ message: "Invalid image URL" });
      }
      
      const result = await downloadFromSpaces(key);
      
      if (!result.success || !result.buffer) {
        return res.status(404).json({ message: "Failed to fetch image" });
      }
      
      res.set({
        'Content-Type': result.contentType || 'image/png',
        'Content-Length': result.buffer.length,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      });
      res.send(result.buffer);
    } catch (error) {
      console.error("Error proxying gallery image:", error);
      res.status(500).json({ message: "Failed to fetch image" });
    }
  });

  app.post("/api/documents", isAdmin, async (req: any, res) => {
    try {
      const validatedData = insertDocumentSchema.parse(req.body);
      const document = await storage.createDocument(validatedData);
      res.status(201).json(document);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid document data", errors: error.errors });
      }
      console.error("Error creating document:", error);
      res.status(500).json({ message: "Failed to create document" });
    }
  });

  app.patch("/api/documents/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const document = await storage.updateDocument(id, req.body);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.json(document);
    } catch (error) {
      console.error("Error updating document:", error);
      res.status(500).json({ message: "Failed to update document" });
    }
  });

  app.delete("/api/documents/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteDocument(id);
      if (!success) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Favorite routes
  app.post("/api/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { documentId } = req.body;

      if (!documentId) {
        return res.status(400).json({ message: "documentId is required" });
      }

      const favorite = await storage.addFavorite({ userId, documentId });
      res.status(201).json(favorite);
    } catch (error) {
      console.error("Error adding favorite:", error);
      res.status(500).json({ message: "Failed to add favorite" });
    }
  });

  app.delete("/api/favorites/:documentId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { documentId } = req.params;

      const success = await storage.removeFavorite(userId, documentId);
      if (!success) {
        return res.status(404).json({ message: "Favorite not found" });
      }
      res.json({ message: "Favorite removed successfully" });
    } catch (error) {
      console.error("Error removing favorite:", error);
      res.status(500).json({ message: "Failed to remove favorite" });
    }
  });

  app.get("/api/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const favorites = await storage.getUserFavorites(userId);
      res.json(favorites);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      res.status(500).json({ message: "Failed to fetch favorites" });
    }
  });

  // Admin routes
  app.get("/api/admin/stats", isAdmin, async (req: any, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Admin badge counts for sidebar notifications
  app.get("/api/admin/badge-counts", isAdmin, async (req: any, res) => {
    try {
      // Count pending user uploads
      const allUploads = await storage.getAllUserUploads();
      const pendingUploadsCount = allUploads.filter(u => u.approvalStatus === 'pending').length;

      // Count total unread support messages
      const conversations = await (storage as any).getAllConversations();
      const unreadSupportCount = conversations.reduce((sum: number, conv: any) => sum + (conv.unreadByAdmin || 0), 0);

      // Count new users (registered in last 24 hours)
      const allUsers = await storage.getAllUsers();
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const newUsersCount = allUsers.filter(u => u.createdAt && new Date(u.createdAt) > oneDayAgo).length;

      res.json({
        pendingUploads: pendingUploadsCount,
        unreadSupport: unreadSupportCount,
        newUsers: newUsersCount,
      });
    } catch (error) {
      console.error("Error fetching admin badge counts:", error);
      res.status(500).json({ message: "Failed to fetch badge counts" });
    }
  });

  app.get("/api/admin/documents", isAdmin, async (req: any, res) => {
    try {
      const documents = await storage.getAllDocumentsForAdmin();
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents for admin:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.get("/api/admin/documents/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const document = await storage.getDocumentByIdForAdmin(id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.json(document);
    } catch (error) {
      console.error("Error fetching document for admin:", error);
      res.status(500).json({ message: "Failed to fetch document" });
    }
  });

  app.get("/api/admin/documents/recent", isAdmin, async (req: any, res) => {
    try {
      const documents = await storage.getRecentDocuments(5);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching recent documents:", error);
      res.status(500).json({ message: "Failed to fetch recent documents" });
    }
  });

  app.delete("/api/admin/documents/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteDocument(id);
      if (!success) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  app.post("/api/admin/documents/bulk-delete", isAdmin, async (req: any, res) => {
    try {
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "No document IDs provided" });
      }

      let deletedCount = 0;
      let errors: string[] = [];

      for (const id of ids) {
        try {
          const success = await storage.deleteDocument(id);
          if (success) {
            deletedCount++;
          } else {
            errors.push(`Document ${id} not found`);
          }
        } catch (err) {
          errors.push(`Failed to delete document ${id}`);
        }
      }

      res.json({ 
        message: `Deleted ${deletedCount} documents successfully`,
        deletedCount,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error("Error bulk deleting documents:", error);
      res.status(500).json({ message: "Failed to bulk delete documents" });
    }
  });

  app.get("/api/admin/users", isAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/users/recent", isAdmin, async (req: any, res) => {
    try {
      const users = await storage.getRecentUsers(5);
      res.json(users);
    } catch (error) {
      console.error("Error fetching recent users:", error);
      res.status(500).json({ message: "Failed to fetch recent users" });
    }
  });

  app.patch("/api/admin/users/:id/role", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      
      if (!role || !["admin", "user"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const user = await storage.updateUserRole(id, role);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Update user points (only super admin yifeng260688@gmail.com can manage points)
  const SUPER_ADMIN_EMAIL = "yifeng260688@gmail.com";
  
  const updatePointsSchema = z.object({
    points: z.number().int().min(0, "Points must be a non-negative integer"),
    reason: z.string().min(1, "Reason is required").max(500).optional(),
  });
  
  app.patch("/api/admin/users/:id/points", isAdmin, async (req: any, res) => {
    try {
      // Check if current user is the super admin
      const currentUserEmail = req.user?.claims?.email;
      const currentUserId = req.user?.claims?.sub;
      
      if (currentUserEmail !== SUPER_ADMIN_EMAIL) {
        // Log unauthorized attempt for security monitoring
        console.warn(`[SECURITY] Unauthorized points modification attempt by ${currentUserEmail} (${currentUserId}) for user ${req.params.id}`);
        return res.status(403).json({ message: "Only the super admin can manage user points" });
      }

      const { id } = req.params;
      
      // Validate request body with Zod
      const validationResult = updatePointsSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid points value", 
          errors: validationResult.error.errors 
        });
      }
      
      const { points, reason } = validationResult.data;

      // Get current user to record previous points
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const previousPoints = targetUser.points || 0;
      const changeAmount = points - previousPoints;
      
      // Update points
      const user = await storage.updateUserPoints(id, points);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Also update LegitimatePoints to match (when super admin manually sets points)
      // This ensures user won't be flagged as suspicious after manual adjustment
      if (changeAmount > 0) {
        // Adding points - record as legitimate
        // recordLegitimateAward(userId, userEmail, amount, reason, adminEmail, relatedUploadId?)
        await recordLegitimateAward(
          id,                                                    // userId
          targetUser.email || '',                                // userEmail
          changeAmount,                                          // amount
          reason || `Admin manual adjustment: +${changeAmount}`, // reason
          currentUserEmail                                       // adminEmail (super admin email)
        );
      } else if (points === 0) {
        // Reset to 0 - clear the legitimate points record too
        const { LegitimatePoints } = await import("./models");
        await LegitimatePoints.updateOne(
          { userId: id },
          { 
            $set: { 
              totalLegitimatePoints: 0, 
              totalPointsUsed: 0 
            } 
          }
        );
        console.log(`[POINTS] Reset legitimate points for user ${id} to 0`);
      }

      // Create security audit log
      const auditLog = new PointsAuditLog({
        _id: crypto.randomUUID(),
        userId: id,
        adminId: currentUserId,
        adminEmail: currentUserEmail,
        previousPoints,
        newPoints: points,
        changeAmount,
        reason: reason || `Điều chỉnh điểm từ ${previousPoints} thành ${points}`,
        actionType: "manual",
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent'),
      });
      await auditLog.save();
      
      console.log(`[AUDIT] Points updated for user ${id}: ${previousPoints} -> ${points} by ${currentUserEmail}`);
      
      res.json(user);
    } catch (error) {
      console.error("Error updating user points:", error);
      res.status(500).json({ message: "Failed to update user points" });
    }
  });
  
  // Get points audit log (super admin only)
  app.get("/api/admin/points-audit", isAdmin, async (req: any, res) => {
    try {
      const currentUserEmail = req.user?.claims?.email;
      if (currentUserEmail !== SUPER_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Only the super admin can view points audit log" });
      }
      
      const { userId, actionType, limit = 100 } = req.query;
      const query: any = {};
      if (userId) query.userId = userId;
      if (actionType) query.actionType = actionType;
      
      const logs = await PointsAuditLog.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit as string))
        .lean();
      
      // Get user emails for display
      const userIds = [...new Set(logs.map(log => log.userId))];
      const users = await Promise.all(userIds.map(id => storage.getUser(id)));
      const userMap = new Map(users.filter(Boolean).map(u => [u!.id, u!.email]));
      
      const enrichedLogs = logs.map(log => ({
        ...log,
        userEmail: userMap.get(log.userId) || "Unknown"
      }));
      
      res.json(enrichedLogs);
    } catch (error) {
      console.error("Error fetching points audit log:", error);
      res.status(500).json({ message: "Failed to fetch points audit log" });
    }
  });

  // Get redemption logs (super admin only)
  app.get("/api/admin/redemption-logs", isAdmin, async (req: any, res) => {
    try {
      const currentUserEmail = req.user?.claims?.email;
      if (currentUserEmail !== SUPER_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Only the super admin can view redemption logs" });
      }
      
      const { userId, documentId, limit = 100 } = req.query;
      const query: any = {};
      if (userId) query.userId = userId;
      if (documentId) query.documentId = documentId;
      
      const logs = await RedemptionLog.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit as string))
        .lean();
      
      res.json(logs);
    } catch (error) {
      console.error("Error fetching redemption logs:", error);
      res.status(500).json({ message: "Failed to fetch redemption logs" });
    }
  });

  // Admin: Get all users with legitimate points
  app.get("/api/admin/legitimate-points", isAdmin, async (req: any, res) => {
    try {
      const currentUserEmail = req.user?.claims?.email;
      if (currentUserEmail !== SUPER_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Only the super admin can view legitimate points" });
      }
      
      const records = await getAllUsersWithLegitimatePoints();
      res.json(records);
    } catch (error) {
      console.error("Error fetching legitimate points:", error);
      res.status(500).json({ message: "Failed to fetch legitimate points" });
    }
  });

  // Admin: Get users with current points for validation
  app.get("/api/admin/users-points-validation", isAdmin, async (req: any, res) => {
    try {
      const currentUserEmail = req.user?.claims?.email;
      if (currentUserEmail !== SUPER_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Only the super admin can view this data" });
      }
      
      // Get all users with points > 0, EXCLUDING super admin
      const allUsers = await User.find({ 
        points: { $gt: 0 },
        email: { $ne: SUPER_ADMIN_EMAIL }  // Exclude super admin
      }).lean();
      const legitRecords = await getAllUsersWithLegitimatePoints();
      const legitMap = new Map(legitRecords.map(r => [r.userId, r]));
      
      const usersWithValidation = allUsers.map(user => {
        const legit = legitMap.get(user._id);
        const legitAvailable = legit ? legit.availablePoints : 0;
        const isValid = user.points <= legitAvailable;
        
        return {
          userId: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          currentPoints: user.points,
          legitimatePoints: legit?.totalLegitimatePoints || 0,
          pointsUsed: legit?.totalPointsUsed || 0,
          availablePoints: legitAvailable,
          isValid,
          isBlocked: user.isBlocked || false,
          blockedReason: user.blockedReason,
          blockedAt: user.blockedAt,
        };
      });
      
      res.json(usersWithValidation);
    } catch (error) {
      console.error("Error fetching users points validation:", error);
      res.status(500).json({ message: "Failed to fetch data" });
    }
  });

  // Admin: Block a user
  app.post("/api/admin/users/:id/block", isAdmin, async (req: any, res) => {
    try {
      const currentUserEmail = req.user?.claims?.email;
      if (currentUserEmail !== SUPER_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Only the super admin can block users" });
      }
      
      const { id } = req.params;
      const { reason } = req.body;
      
      const result = await blockUser(id, reason || "Blocked by admin");
      if (result) {
        res.json({ success: true, message: "User blocked successfully" });
      } else {
        res.status(404).json({ message: "User not found" });
      }
    } catch (error) {
      console.error("Error blocking user:", error);
      res.status(500).json({ message: "Failed to block user" });
    }
  });

  // Admin: Unblock a user
  app.post("/api/admin/users/:id/unblock", isAdmin, async (req: any, res) => {
    try {
      const currentUserEmail = req.user?.claims?.email;
      if (currentUserEmail !== SUPER_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Only the super admin can unblock users" });
      }
      
      const { id } = req.params;
      
      const result = await unblockUser(id);
      if (result) {
        res.json({ success: true, message: "User unblocked successfully" });
      } else {
        res.status(404).json({ message: "User not found" });
      }
    } catch (error) {
      console.error("Error unblocking user:", error);
      res.status(500).json({ message: "Failed to unblock user" });
    }
  });

  // TEST ONLY: Set user points directly (bypasses legitimate tracking) - For testing auto-block feature
  app.post("/api/admin/users/:id/set-points-test", isAdmin, async (req: any, res) => {
    try {
      const currentUserEmail = req.user?.claims?.email;
      if (currentUserEmail !== SUPER_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Only the super admin can use this test endpoint" });
      }
      
      const { id } = req.params;
      const { accountPoints, legitimatePoints } = req.body;
      
      if (typeof accountPoints !== 'number' || typeof legitimatePoints !== 'number') {
        return res.status(400).json({ message: "Both accountPoints and legitimatePoints are required as numbers" });
      }
      
      // Get user
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Set account points directly
      const { User, LegitimatePoints } = await import("./models");
      await User.updateOne({ id }, { $set: { points: accountPoints } });
      
      // Set legitimate points directly
      await LegitimatePoints.updateOne(
        { userId: id },
        { 
          $set: { 
            totalLegitimatePoints: legitimatePoints,
            totalPointsUsed: 0,
          }
        },
        { upsert: true }
      );
      
      // Check validity
      const isValid = accountPoints <= legitimatePoints;
      
      console.log(`[TEST] Set user ${id} - Account: ${accountPoints}, Legitimate: ${legitimatePoints}, Valid: ${isValid}`);
      
      res.json({ 
        success: true, 
        message: `User points set for testing`,
        accountPoints,
        legitimatePoints,
        isValid,
        warning: isValid ? null : "User will be AUTO-BLOCKED when trying to redeem!"
      });
    } catch (error) {
      console.error("Error setting test points:", error);
      res.status(500).json({ message: "Failed to set test points" });
    }
  });

  // Tag routes (admin-only for CRUD, public for reading)
  app.get("/api/tags", async (req: any, res) => {
    try {
      const tags = await storage.getAllTags();
      res.json(tags);
    } catch (error) {
      console.error("Error fetching tags:", error);
      res.status(500).json({ message: "Failed to fetch tags" });
    }
  });

  app.post("/api/admin/tags", isAdmin, async (req: any, res) => {
    try {
      const tagData = insertTagSchema.parse(req.body);
      const tag = await storage.createTag(tagData);
      res.status(201).json(tag);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid tag data", errors: error.errors });
      }
      console.error("Error creating tag:", error);
      res.status(500).json({ message: "Failed to create tag" });
    }
  });

  app.delete("/api/admin/tags/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteTag(id);
      if (!success) {
        return res.status(404).json({ message: "Tag not found" });
      }
      res.json({ message: "Tag deleted successfully" });
    } catch (error) {
      console.error("Error deleting tag:", error);
      res.status(500).json({ message: "Failed to delete tag" });
    }
  });

  app.get("/api/documents/:id/tags", async (req: any, res) => {
    try {
      const { id } = req.params;
      const tags = await storage.getDocumentTags(id);
      res.json(tags);
    } catch (error) {
      console.error("Error fetching document tags:", error);
      res.status(500).json({ message: "Failed to fetch document tags" });
    }
  });

  app.put("/api/admin/documents/:id/tags", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { tagIds } = req.body;
      
      if (!Array.isArray(tagIds)) {
        return res.status(400).json({ message: "tagIds must be an array" });
      }

      await storage.setDocumentTags(id, tagIds);
      const tags = await storage.getDocumentTags(id);
      res.json(tags);
    } catch (error) {
      console.error("Error setting document tags:", error);
      res.status(500).json({ message: "Failed to set document tags" });
    }
  });

  // User upload routes
  app.get("/api/user-uploads", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const uploads = await storage.getUserUploads(userId);
      res.json(uploads);
    } catch (error) {
      console.error("Error fetching user uploads:", error);
      res.status(500).json({ message: "Failed to fetch uploads" });
    }
  });

  app.post("/api/user-uploads", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const file = req.file;

      // Check if user is blocked
      const user = await storage.getUser(userId);
      if (user?.isBlocked) {
        // Delete uploaded file if exists
        if (file && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        return res.status(403).json({ 
          message: "Tài khoản của bạn đã bị khóa. Bạn không thể upload file. Vui lòng liên hệ admin để được hỗ trợ.",
          code: "USER_BLOCKED",
          blockedReason: user.blockedReason
        });
      }

      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Calculate file hash for duplicate detection
      const fileHash = await calculateFileHash(file.path);
      
      // Check for duplicate
      const duplicateCheck = await storage.checkDuplicateFileHash(fileHash);
      if (duplicateCheck.isDuplicate) {
        console.log(`[Duplicate] File "${file.originalname}" is duplicate of "${duplicateCheck.existingFileName}"`);
        // Delete the duplicate file
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        return res.status(400).json({ 
          message: `File trùng lặp! File "${file.originalname}" đã tồn tại trong hệ thống với tên "${duplicateCheck.existingFileName}".`
        });
      }

      // Check available slot
      const availableSlot = await storage.findAvailableSlot(userId);
      if (availableSlot === null) {
        // Delete uploaded file since we can't store it
        fs.unlinkSync(file.path);
        return res.status(400).json({ 
          message: "Upload limit reached. You can only upload 2 files. Please delete an existing file first." 
        });
      }

      // Validate upload data matches schema requirements
      const uploadData = {
        userId,
        slot: availableSlot,
        fileName: file.originalname,
        fileType: file.mimetype,
        filePath: file.path,
        fileSize: file.size,
        fileHash: fileHash,
      };

      // Validate using Zod schema (will throw if invalid)
      const validatedData = insertUserUploadSchema.parse(uploadData);

      // Create upload record (database unique constraint prevents race conditions)
      const upload = await storage.createUserUpload(validatedData);

      // Trigger AI metadata generation asynchronously (non-blocking)
      console.log(`[AI] User upload created: ${upload.id}, triggering AI processing...`);
      processFileWithAI(file.path, file.mimetype, upload.id, 'user', storage).catch((error) => {
        console.error(`[AI] Error processing user upload ${upload.id}:`, error);
      });

      res.json(upload);
    } catch (error: any) {
      console.error("Error uploading file:", error);
      // Clean up file if database operation failed
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      // Handle database constraint violations
      if (error.code === '23505') { // PostgreSQL unique constraint violation
        return res.status(400).json({ 
          message: "Upload limit reached due to concurrent request. Please try again." 
        });
      }
      
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid upload data", errors: error.errors });
      }
      
      res.status(500).json({ message: error.message || "Failed to upload file" });
    }
  });


  // Admin upload routes (bulk uploads up to 500MB)
  app.get("/api/admin/uploads", isAdmin, async (req: any, res) => {
    try {
      const uploads = await storage.getAdminUploads();
      res.json(uploads);
    } catch (error) {
      console.error("Error fetching admin uploads:", error);
      res.status(500).json({ message: "Failed to fetch uploads" });
    }
  });

  app.post("/api/admin/uploads", isAdmin, adminUpload.array("files", 10), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const files = req.files as Express.Multer.File[];
      const category = req.body.category || null;
      const subcategory = req.body.subcategory || null;

      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const uploads = [];
      const duplicates: { fileName: string; existingFileName: string }[] = [];
      
      // Process each file
      for (const file of files) {
        try {
          // Calculate file hash for duplicate detection
          const fileHash = await calculateFileHash(file.path);
          
          // Check for duplicate
          const duplicateCheck = await storage.checkDuplicateFileHash(fileHash);
          if (duplicateCheck.isDuplicate) {
            console.log(`[Duplicate] File "${file.originalname}" is duplicate of "${duplicateCheck.existingFileName}"`);
            duplicates.push({
              fileName: file.originalname,
              existingFileName: duplicateCheck.existingFileName || 'unknown'
            });
            // Delete the duplicate file
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
            continue; // Skip this file
          }
          
          // Create upload record with category, subcategory and hash
          const upload = await storage.createAdminUpload({
            uploadedBy: userId,
            fileName: file.originalname,
            fileType: file.mimetype,
            filePath: file.path,
            fileSize: file.size,
            fileHash: fileHash,
            category: category,
            subcategory: subcategory,
          });

          uploads.push(upload);

          // Trigger pipeline processing asynchronously (for Excel and PDF files)
          // AI processing runs FIRST, then pipeline starts after AI completes
          const isExcelFile = file.mimetype === "application/vnd.ms-excel" || 
                              file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          const isPdfFile = file.mimetype === "application/pdf";
          
          if (isExcelFile || isPdfFile) {
            // Run AI processing first, then pipeline - so AI metadata is available when document is created
            console.log(`[AI+Pipeline] Admin upload created: ${upload.id}, starting AI processing first with category: ${category || 'none'}...`);
            (async () => {
              try {
                // Wait for AI processing to complete
                const aiResult = await processFileWithAI(file.path, file.mimetype, upload.id, 'admin', storage, category);
                console.log(`[AI+Pipeline] AI processing completed for ${upload.id}: ${aiResult.success ? 'success' : 'failed'}`);
                
                // Now start pipeline processing (AI metadata will be available)
                console.log(`[AI+Pipeline] Starting pipeline for ${upload.id}...`);
                await processAdminUpload(upload.id, file.path, storage);
              } catch (error) {
                console.error(`[AI+Pipeline] Error processing admin upload ${upload.id}:`, error);
              }
            })();
          } else {
            // Update status to "skipped" for non-Excel files to avoid dangling "pending" records
            console.log(`[Pipeline] Skipping pipeline for non-Excel file: ${file.mimetype}`);
            await storage.updatePipelineStatus(upload.id, "skipped");
          }
        } catch (fileError: any) {
          console.error(`Error processing file ${file.originalname}:`, fileError);
          // Clean up this specific file if database operation failed
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
          // Continue processing other files
        }
      }

      // Return response with both successful uploads and duplicate info
      if (uploads.length === 0 && duplicates.length > 0) {
        return res.status(400).json({ 
          message: "Tất cả file đều bị trùng lặp",
          duplicates 
        });
      }

      if (uploads.length === 0) {
        return res.status(500).json({ message: "Failed to process any files" });
      }

      res.json({ 
        uploads, 
        duplicates: duplicates.length > 0 ? duplicates : undefined,
        message: duplicates.length > 0 
          ? `Đã upload ${uploads.length} file. ${duplicates.length} file bị trùng lặp đã bị bỏ qua.`
          : undefined
      });
    } catch (error: any) {
      console.error("Error uploading admin files:", error);
      // Clean up all files if request failed
      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files) {
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }
      }
      res.status(500).json({ message: error.message || "Failed to upload files" });
    }
  });

  app.delete("/api/admin/uploads/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;

      // Get upload to find file path
      const uploads = await storage.getAdminUploads();
      const upload = uploads.find(u => u.id === id);

      if (!upload) {
        return res.status(404).json({ message: "Upload not found" });
      }

      // Delete from database
      const deleted = await storage.deleteAdminUpload(id);
      if (!deleted) {
        return res.status(404).json({ message: "Upload not found" });
      }

      // Delete file from filesystem
      if (fs.existsSync(upload.filePath)) {
        fs.unlinkSync(upload.filePath);
      }

      res.json({ message: "Upload deleted successfully" });
    } catch (error) {
      console.error("Error deleting admin upload:", error);
      res.status(500).json({ message: "Failed to delete upload" });
    }
  });

  // Reprocess failed admin upload
  app.post("/api/admin/uploads/:id/reprocess", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const upload = await storage.getAdminUploadById(id);
      if (!upload) {
        return res.status(404).json({ message: "Upload not found" });
      }
      
      if (upload.pipelineStatus !== "failed") {
        return res.status(400).json({ message: "Only failed uploads can be reprocessed" });
      }
      
      // Check if file exists
      if (!fs.existsSync(upload.filePath)) {
        return res.status(400).json({ message: "File no longer exists on the server" });
      }
      
      // Reset status to pending and clear error
      await storage.updatePipelineStatus(id, "pending");
      
      // Start pipeline processing asynchronously
      processAdminUpload(id, upload.filePath, storage)
        .catch((err: any) => console.error(`[Reprocess] Pipeline failed for ${id}:`, err));
      
      res.json({ message: "Reprocessing started" });
    } catch (error: any) {
      console.error("Error reprocessing admin upload:", error);
      res.status(500).json({ message: error.message || "Failed to reprocess upload" });
    }
  });

  // User upload approval routes (admin only)
  app.get("/api/admin/user-uploads", isAdmin, async (req: any, res) => {
    try {
      const uploads = await storage.getAllUserUploads();
      res.json(uploads);
    } catch (error) {
      console.error("Error fetching user uploads for review:", error);
      res.status(500).json({ message: "Failed to fetch uploads" });
    }
  });

  app.patch("/api/admin/user-uploads/:id/approve", isAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const { id } = req.params;
      const { category: selectedCategory, points } = req.body;

      // Validate category is provided and exists
      if (!selectedCategory || typeof selectedCategory !== 'string') {
        return res.status(400).json({ message: "Category is required" });
      }

      // Verify category exists in the system
      const allCategories = await storage.getAllCategories();
      const validCategory = allCategories.find(cat => cat.name === selectedCategory);
      if (!validCategory) {
        return res.status(400).json({ message: "Invalid category. Please select a valid category." });
      }

      const upload = await storage.approveUserUpload(id, adminId, selectedCategory);
      
      if (!upload) {
        return res.status(404).json({ message: "Upload not found" });
      }

      // Award points to user if specified
      const pointsToAward = parseInt(points) || 0;
      if (pointsToAward > 0 && upload.userId) {
        // Get current user points and add the new points
        const user = await storage.getUser(upload.userId);
        const currentPoints = user?.points || 0;
        const newTotal = currentPoints + pointsToAward;
        await storage.updateUserPoints(upload.userId, newTotal);
        
        // Log points award
        const adminEmail = req.user?.claims?.email || "unknown";
        const pointsLog = new PointsAuditLog({
          _id: crypto.randomUUID(),
          userId: upload.userId,
          adminId: adminId,
          adminEmail: adminEmail,
          previousPoints: currentPoints,
          newPoints: newTotal,
          changeAmount: pointsToAward,
          reason: `Thưởng điểm cho file "${upload.fileName}" được phê duyệt`,
          actionType: "upload_reward",
          relatedUploadId: upload.id,
        });
        await pointsLog.save();
        
        // Record legitimate points if awarded by super admin
        if (adminEmail === SUPER_ADMIN_EMAIL) {
          await recordLegitimateAward(
            upload.userId,
            user?.email || "unknown",
            pointsToAward,
            `Thưởng điểm cho file "${upload.fileName}" được phê duyệt`,
            adminEmail,
            upload.id
          );
        }
        
        console.log(`[Points] Awarded ${pointsToAward} points to user ${upload.userId} for approved upload ${upload.id} (total: ${newTotal})`);
      }

      // Create approval notification for user
      if (upload.userId) {
        const pointsMessage = pointsToAward > 0 ? ` Bạn được thưởng ${pointsToAward} điểm.` : '';
        await (storage as any).createNotification({
          type: 'single',
          targetUserId: upload.userId,
          senderId: adminId,
          title: 'File đã được phê duyệt',
          content: `File "${upload.fileName}" của bạn đã được phê duyệt và đăng thành công.${pointsMessage}`,
        });
        console.log(`[Notification] Sent approval notification to user ${upload.userId}`);
      }

      // Trigger pipeline processing asynchronously for approved upload
      // AI processing runs FIRST, then pipeline starts after AI completes
      const isExcelFile = upload.fileType === "application/vnd.ms-excel" || 
                          upload.fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const isPdfFile = upload.fileType === "application/pdf";
      
      if (isExcelFile || isPdfFile) {
        // Run AI processing first, then pipeline - so AI metadata is available when document is created
        console.log(`[AI+Pipeline] User upload approved: ${upload.id}, starting AI processing first with category: ${selectedCategory}...`);
        (async () => {
          try {
            // Wait for AI processing to complete
            const aiResult = await processFileWithAI(upload.filePath, upload.fileType, upload.id, 'user', storage, selectedCategory);
            console.log(`[AI+Pipeline] AI processing completed for user upload ${upload.id}: ${aiResult.success ? 'success' : 'failed'}`);
            
            // Now start pipeline processing (AI metadata will be available)
            console.log(`[AI+Pipeline] Starting pipeline for user upload ${upload.id}...`);
            await processUserUploadApproval(upload.id, upload.filePath, storage);
          } catch (error) {
            console.error(`[AI+Pipeline] Error processing approved user upload ${upload.id}:`, error);
          }
        })();
      } else {
        // For non-Excel files, create document immediately with AI-generated or default metadata
        console.log(`[Document] Creating document from non-Excel approved upload: ${upload.id} with category: ${selectedCategory}`);
        
        // Trigger AI processing and create document after
        (async () => {
          try {
            const aiResult = await processFileWithAI(upload.filePath, upload.fileType, upload.id, 'user', storage, selectedCategory);
            console.log(`[AI] AI processing completed for non-Excel user upload ${upload.id}: ${aiResult.success ? 'success' : 'failed'}`);
            
            // Get updated upload with AI metadata
            const updatedUpload = await storage.getUserUploadById(upload.id);
            const fileName = path.basename(upload.filePath);
            const fileUrl = `/User-Upload/${fileName}`;
            
            const title = updatedUpload?.aiGeneratedTitle || upload.fileName.replace(/\.[^/.]+$/, "");
            const description = updatedUpload?.aiGeneratedDescription || `Tài liệu được tải lên bởi người dùng: ${upload.fileName}`;
            
            const document = await storage.createDocument({
              title,
              description,
              category: selectedCategory,
              pageCount: 1,
              coverImageUrl: fileUrl,
              imageUrls: "[]",
            });
            console.log(`[Document] Created document ${document.id} from non-Excel upload ${upload.id}`);
          } catch (error) {
            console.error(`[AI+Document] Error processing non-Excel user upload ${upload.id}:`, error);
          }
        })();
        
        // Update status to "skipped" for non-Excel files
        console.log(`[Pipeline] Skipping pipeline for non-Excel file: ${upload.fileType}`);
        await storage.updateUserUploadPipelineStatus(upload.id, "skipped", undefined, new Date());
      }

      res.json(upload);
    } catch (error) {
      console.error("Error approving user upload:", error);
      res.status(500).json({ message: "Failed to approve upload" });
    }
  });

  app.patch("/api/admin/user-uploads/:id/reject", isAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const { id } = req.params;
      const { reason } = req.body;

      // Validate reason is provided
      if (!reason || typeof reason !== 'string' || !reason.trim()) {
        return res.status(400).json({ message: "Rejection reason is required" });
      }

      const upload = await storage.rejectUserUpload(id, adminId);
      
      if (!upload) {
        return res.status(404).json({ message: "Upload not found" });
      }

      // Create rejection notification for user with reason
      if (upload.userId) {
        await (storage as any).createNotification({
          type: 'single',
          targetUserId: upload.userId,
          senderId: adminId,
          title: 'File bị từ chối',
          content: `File "${upload.fileName}" của bạn đã bị từ chối. Lý do: ${reason.trim()}`,
        });
        console.log(`[Notification] Sent rejection notification to user ${upload.userId} with reason: ${reason.trim()}`);
      }

      res.json(upload);
    } catch (error) {
      console.error("Error rejecting user upload:", error);
      res.status(500).json({ message: "Failed to reject upload" });
    }
  });

  // View user upload as HTML (for Excel files)
  // Custom auth check that returns HTML error instead of JSON
  app.get("/api/admin/user-uploads/:id/view-html", async (req: any, res) => {
    // Check authentication with HTML response
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      const loginHtml = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Phiên đăng nhập hết hạn</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; text-align: center; }
    .container { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto; }
    h1 { color: #f57c00; font-size: 18px; }
    p { color: #666; font-size: 14px; }
    a { color: #1976d2; text-decoration: none; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Phiên đăng nhập đã hết hạn</h1>
    <p>Vui lòng đăng nhập lại để xem file.</p>
    <p><a href="/">Đăng nhập lại</a></p>
  </div>
</body>
</html>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(401).send(loginHtml);
    }
    
    // Check admin role
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).send('<html><body><h1>Unauthorized</h1></body></html>');
    }
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") {
      return res.status(403).send('<html><body><h1>Forbidden - Admin access required</h1></body></html>');
    }
    try {
      const { id } = req.params;
      const upload = await storage.getUserUploadById(id);
      
      if (!upload) {
        return res.status(404).json({ message: "Upload not found" });
      }

      let filePath = upload.filePath;
      console.log(`[Admin View] Upload ID: ${id}, original filePath: ${filePath}`);
      
      // Try different path variations
      if (!fs.existsSync(filePath)) {
        // Try with current working directory
        const cwdPath = path.join(process.cwd(), filePath);
        console.log(`[Admin View] Trying cwd path: ${cwdPath}`);
        if (fs.existsSync(cwdPath)) {
          filePath = cwdPath;
        } else {
          // Try just the filename in User-Upload folder
          const fileName = path.basename(filePath);
          const userUploadPath = path.join(process.cwd(), 'User-Upload', fileName);
          console.log(`[Admin View] Trying User-Upload path: ${userUploadPath}`);
          if (fs.existsSync(userUploadPath)) {
            filePath = userUploadPath;
          } else {
            console.log(`[Admin View] File not found at any path`);
            // Return a user-friendly HTML page instead of JSON error
            const errorHtml = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>File không tồn tại</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; text-align: center; }
    .container { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }
    h1 { color: #e53935; font-size: 20px; margin-bottom: 20px; }
    p { color: #666; font-size: 14px; margin: 10px 0; }
    .icon { font-size: 48px; margin-bottom: 20px; }
    .filename { background: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">⚠️</div>
    <h1>File không tồn tại trên server</h1>
    <p>File này có thể đã bị xóa hoặc upload bị lỗi.</p>
    <div class="filename">${upload.fileName}</div>
    <p style="margin-top: 20px; color: #999; font-size: 12px;">Bạn có thể từ chối upload này và yêu cầu user upload lại.</p>
  </div>
</body>
</html>`;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.send(errorHtml);
          }
        }
      }

      // Check file type
      const ext = path.extname(upload.fileName).toLowerCase();
      
      // Handle PDF files with embedded viewer
      if (ext === '.pdf') {
        const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${upload.fileName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #1a1a1a; height: 100vh; display: flex; flex-direction: column; }
    .header { background: #2d2d2d; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
    .header h1 { font-size: 14px; font-weight: normal; }
    .header .info { font-size: 12px; color: #999; }
    .header .actions { display: flex; gap: 10px; }
    .header a { color: #4CAF50; text-decoration: none; font-size: 13px; padding: 6px 12px; background: #3d3d3d; border-radius: 4px; }
    .header a:hover { background: #4d4d4d; }
    .pdf-container { flex: 1; display: flex; justify-content: center; align-items: center; overflow: hidden; }
    embed, iframe { width: 100%; height: 100%; border: none; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${upload.fileName}</h1>
      <span class="info">Kích thước: ${(upload.fileSize / 1024).toFixed(1)} KB | Uploaded by: ${(upload as any).userEmail || 'Unknown'}</span>
    </div>
    <div class="actions">
      <a href="/api/admin/user-uploads/${id}/download">Tải về</a>
    </div>
  </div>
  <div class="pdf-container">
    <embed src="/api/admin/user-uploads/${id}/pdf-stream" type="application/pdf" />
  </div>
</body>
</html>`;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(htmlContent);
      }
      
      // Handle other non-Excel files
      if (ext !== '.xlsx' && ext !== '.xls') {
        const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${upload.fileName}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; text-align: center; }
    .container { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }
    h1 { color: #333; font-size: 18px; margin-bottom: 20px; }
    p { color: #666; font-size: 14px; }
    .file-icon { font-size: 48px; margin-bottom: 20px; }
    a { color: #4CAF50; text-decoration: none; font-weight: bold; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="file-icon">📊</div>
    <h1>${upload.fileName}</h1>
    <p>Loại file: ${upload.fileType}</p>
    <p>Kích thước: ${(upload.fileSize / 1024).toFixed(1)} KB</p>
    <p style="margin-top: 20px;">File này không phải Excel hoặc PDF nên không thể xem trước.</p>
    <p><a href="/api/admin/user-uploads/${id}/download">Tải về để xem</a></p>
  </div>
</body>
</html>`;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(htmlContent);
      }

      const xlsxModule = await import("xlsx");
      const xlsx = xlsxModule.default || xlsxModule;
      const workbook = xlsx.readFile(filePath);
      
      let htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${upload.fileName}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    h1 { color: #333; font-size: 18px; margin-bottom: 20px; }
    h2 { color: #555; font-size: 14px; margin: 20px 0 10px; background: #e0e0e0; padding: 8px; border-radius: 4px; }
    table { border-collapse: collapse; width: 100%; background: white; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    th { background-color: #4CAF50; color: white; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    tr:hover { background-color: #f1f1f1; }
    .info { color: #666; margin-bottom: 10px; font-size: 12px; }
  </style>
</head>
<body>
  <h1>File: ${upload.fileName}</h1>
  <p class="info">Uploaded by: ${(upload as any).userEmail || 'Unknown'} | Size: ${(upload.fileSize / 1024).toFixed(1)} KB</p>
`;

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        
        htmlContent += `<h2>Sheet: ${sheetName} (${jsonData.length} rows)</h2>`;
        htmlContent += '<table>';
        
        // Show ALL rows - no limit
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (Array.isArray(row) && row.length > 0) {
            htmlContent += '<tr>';
            const tag = i === 0 ? 'th' : 'td';
            for (const cell of row) {
              const cellValue = cell !== null && cell !== undefined ? String(cell).substring(0, 100) : '';
              htmlContent += `<${tag}>${cellValue}</${tag}>`;
            }
            htmlContent += '</tr>';
          }
        }
        
        htmlContent += '</table>';
      }

      htmlContent += '</body></html>';
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlContent);
    } catch (error: any) {
      console.error("Error viewing user upload as HTML:", error);
      res.status(500).json({ message: error.message || "Failed to view file" });
    }
  });

  // Download user upload file
  app.get("/api/admin/user-uploads/:id/download", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const upload = await storage.getUserUploadById(id);
      
      if (!upload) {
        return res.status(404).json({ message: "Upload not found" });
      }

      let filePath = upload.filePath;
      
      // Try different path variations
      if (!fs.existsSync(filePath)) {
        const cwdPath = path.join(process.cwd(), filePath);
        if (fs.existsSync(cwdPath)) {
          filePath = cwdPath;
        } else {
          const fileName = path.basename(filePath);
          const userUploadPath = path.join(process.cwd(), 'User-Upload', fileName);
          if (fs.existsSync(userUploadPath)) {
            filePath = userUploadPath;
          } else {
            return res.status(404).json({ 
              message: "File không tồn tại trên server. File có thể đã bị xóa hoặc upload bị lỗi.",
              fileName: upload.fileName
            });
          }
        }
      }

      res.download(filePath, upload.fileName);
    } catch (error: any) {
      console.error("Error downloading user upload:", error);
      res.status(500).json({ message: error.message || "Failed to download file" });
    }
  });

  // Stream PDF file for embedded viewer
  app.get("/api/admin/user-uploads/:id/pdf-stream", async (req: any, res) => {
    // Check authentication
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Check admin role
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    try {
      const { id } = req.params;
      const upload = await storage.getUserUploadById(id);
      
      if (!upload) {
        return res.status(404).json({ message: "Upload not found" });
      }

      // Verify it's a PDF file
      const ext = path.extname(upload.fileName).toLowerCase();
      if (ext !== '.pdf') {
        return res.status(400).json({ message: "File is not a PDF" });
      }

      let filePath = upload.filePath;
      
      // Try different path variations
      if (!fs.existsSync(filePath)) {
        const cwdPath = path.join(process.cwd(), filePath);
        if (fs.existsSync(cwdPath)) {
          filePath = cwdPath;
        } else {
          const fileName = path.basename(filePath);
          const userUploadPath = path.join(process.cwd(), 'User-Upload', fileName);
          if (fs.existsSync(userUploadPath)) {
            filePath = userUploadPath;
          } else {
            return res.status(404).json({ message: "File not found" });
          }
        }
      }

      // Stream the PDF file
      const stat = fs.statSync(filePath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(upload.fileName)}"`);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error: any) {
      console.error("Error streaming PDF:", error);
      res.status(500).json({ message: error.message || "Failed to stream PDF" });
    }
  });

  // Category routes
  app.get("/api/categories", async (_req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // Configure multer for category logo uploads
  const CATEGORY_LOGO_DIR = path.join(process.cwd(), "Category-Logos");
  const categoryLogoStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      if (!fs.existsSync(CATEGORY_LOGO_DIR)) {
        fs.mkdirSync(CATEGORY_LOGO_DIR, { recursive: true, mode: 0o700 });
      }
      cb(null, CATEGORY_LOGO_DIR);
    },
    filename: (req: any, file, cb) => {
      const now = new Date();
      const timestamp = now.getTime();
      const ext = path.extname(file.originalname);
      const nameWithoutExt = path.basename(file.originalname, ext);
      cb(null, `${nameWithoutExt}-${timestamp}${ext}`);
    }
  });

  const categoryLogoUpload = multer({
    storage: categoryLogoStorage,
    limits: {
      fileSize: 2 * 1024 * 1024, // 2MB max for logos
    },
    fileFilter: (_req, file, cb) => {
      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Invalid file type. Only images are allowed."));
      }
    }
  });

  app.post("/api/categories", isAdmin, categoryLogoUpload.single('logo'), async (req: any, res) => {
    try {
      const { name, order } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: "Category name is required" });
      }

      const logoUrl = req.file ? `/Category-Logos/${req.file.filename}` : undefined;
      
      const category = await storage.createCategory({
        name,
        logoUrl,
        order: order ? parseInt(order) : 0,
      });

      res.json(category);
    } catch (error: any) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category", error: error.message });
    }
  });

  app.patch("/api/categories/:id", isAdmin, categoryLogoUpload.single('logo'), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { name, order } = req.body;

      const updateData: any = {};
      if (name) updateData.name = name;
      if (order !== undefined) updateData.order = parseInt(order);
      if (req.file) updateData.logoUrl = `/Category-Logos/${req.file.filename}`;

      const category = await storage.updateCategory(id, updateData);

      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      res.json(category);
    } catch (error: any) {
      console.error("Error updating category:", error);
      res.status(500).json({ message: "Failed to update category", error: error.message });
    }
  });

  app.delete("/api/categories/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Get category name first
      const category = await storage.getCategoryById(id);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      // Check if any documents use this category
      const allDocuments = await storage.getAllDocumentsForAdmin();
      const documentsUsingCategory = allDocuments.filter(doc => doc.category === category.name);
      
      if (documentsUsingCategory.length > 0) {
        return res.status(400).json({ 
          message: `Không thể xóa danh mục vì có ${documentsUsingCategory.length} tài liệu đang sử dụng danh mục này. Vui lòng cập nhật hoặc xóa các tài liệu trước.`
        });
      }

      const deleted = await storage.deleteCategory(id);

      if (!deleted) {
        return res.status(404).json({ message: "Category not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Subcategory routes
  app.get("/api/subcategories", async (req: any, res) => {
    try {
      const { categoryId } = req.query;
      const query = categoryId ? { categoryId } : {};
      const subcategories = await Subcategory.find(query).sort({ order: 1, name: 1 }).lean();
      res.json(subcategories.map((s: any) => ({ ...s, id: s._id })));
    } catch (error) {
      console.error("Error fetching subcategories:", error);
      res.status(500).json({ message: "Failed to fetch subcategories" });
    }
  });

  app.post("/api/subcategories", isAdmin, async (req: any, res) => {
    try {
      const { name, categoryId, parentSubcategoryId, order } = req.body;
      
      if (!name || !categoryId) {
        return res.status(400).json({ message: "Name and categoryId are required" });
      }

      // Check category exists
      const category = await storage.getCategoryById(categoryId);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      // Validate parent subcategory if provided
      if (parentSubcategoryId) {
        const parentSub = await Subcategory.findById(parentSubcategoryId);
        if (!parentSub) {
          return res.status(404).json({ message: "Parent subcategory not found" });
        }
      }

      const subcategory = new Subcategory({
        _id: crypto.randomUUID(),
        name: name.trim(),
        categoryId,
        parentSubcategoryId: parentSubcategoryId || null,
        order: order !== undefined ? parseInt(order) : 0,
      });

      await subcategory.save();
      res.status(201).json({ ...subcategory.toObject(), id: subcategory._id });
    } catch (error: any) {
      if (error.code === 11000) {
        return res.status(400).json({ message: "Subcategory with this name already exists in this category" });
      }
      console.error("Error creating subcategory:", error);
      res.status(500).json({ message: "Failed to create subcategory" });
    }
  });

  app.patch("/api/subcategories/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { name, order } = req.body;

      const updateData: any = { updatedAt: new Date() };
      if (name) updateData.name = name.trim();
      if (order !== undefined) updateData.order = parseInt(order);

      const subcategory = await Subcategory.findByIdAndUpdate(id, updateData, { new: true }).lean();

      if (!subcategory) {
        return res.status(404).json({ message: "Subcategory not found" });
      }

      res.json({ ...subcategory, id: subcategory._id });
    } catch (error: any) {
      if (error.code === 11000) {
        return res.status(400).json({ message: "Subcategory with this name already exists in this category" });
      }
      console.error("Error updating subcategory:", error);
      res.status(500).json({ message: "Failed to update subcategory" });
    }
  });

  app.delete("/api/subcategories/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const result = await Subcategory.findByIdAndDelete(id);

      if (!result) {
        return res.status(404).json({ message: "Subcategory not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting subcategory:", error);
      res.status(500).json({ message: "Failed to delete subcategory" });
    }
  });

  // ============ CHAT SUPPORT API ROUTES ============

  // Helper to verify conversation ownership
  const verifyConversationAccess = async (conversationId: string, userId?: string, guestId?: string) => {
    const conversation = await storage.getConversationById(conversationId);
    if (!conversation) return null;
    
    if (userId && conversation.userId === userId) return conversation;
    if (guestId && conversation.guestId === guestId) return conversation;
    
    return null;
  };

  // Get or create conversation for current user
  app.get("/api/support/conversation", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const guestId = req.cookies?.guestId;

      if (!userId && !guestId) {
        return res.status(400).json({ message: "User ID or Guest ID required" });
      }

      const conversation = await storage.getOrCreateConversation(userId, guestId);
      res.json(conversation);
    } catch (error: any) {
      console.error("Error getting conversation:", error);
      res.status(500).json({ message: "Failed to get conversation", error: error.message });
    }
  });

  // Start a new conversation (generates server-side guestId for guests)
  app.post("/api/support/conversation", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const existingGuestId = req.cookies?.guestId;
      const { guestName, guestEmail } = req.body;

      let guestId = existingGuestId;
      
      if (!userId && !guestId) {
        const crypto = await import("crypto");
        guestId = `guest-${Date.now()}-${crypto.randomBytes(12).toString("hex")}`;
      }

      const conversation = await storage.getOrCreateConversation(userId, guestId, guestName, guestEmail);
      
      if (guestId && !userId) {
        res.cookie("guestId", guestId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });
      }

      res.json(conversation);
    } catch (error: any) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation", error: error.message });
    }
  });

  // Get messages for a conversation (with ownership verification)
  app.get("/api/support/conversation/:id/messages", async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.claims?.sub;
      const guestId = req.cookies?.guestId;

      const conversation = await verifyConversationAccess(id, userId, guestId);
      if (!conversation) {
        return res.status(403).json({ message: "Access denied" });
      }

      const messages = await storage.getMessagesByConversationId(id);
      res.json(messages);
    } catch (error: any) {
      console.error("Error getting messages:", error);
      res.status(500).json({ message: "Failed to get messages", error: error.message });
    }
  });

  // Send a message (user side with ownership verification)
  app.post("/api/support/conversation/:id/messages", async (req: any, res) => {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const userId = req.user?.claims?.sub;
      const guestId = req.cookies?.guestId;

      if (!content || typeof content !== "string" || !content.trim() || content.length > 5000) {
        return res.status(400).json({ message: "Invalid message content" });
      }

      const conversation = await verifyConversationAccess(id, userId, guestId);
      if (!conversation) {
        return res.status(403).json({ message: "Access denied" });
      }

      const user = userId ? await storage.getUser(userId) : null;
      const senderName = user 
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email 
        : "Khách";

      const message = await storage.createMessage({
        conversationId: id,
        senderType: "user",
        senderId: userId,
        senderName,
        content: content.trim(),
      });

      const { emitNewMessage } = await import("./socket");
      emitNewMessage(id, message);

      res.json(message);
    } catch (error: any) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message", error: error.message });
    }
  });

  // Mark messages as read (user side with ownership verification)
  app.post("/api/support/conversation/:id/read", async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.claims?.sub;
      const guestId = req.cookies?.guestId;

      const conversation = await verifyConversationAccess(id, userId, guestId);
      if (!conversation) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.markMessagesAsRead(id, "user");
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ message: "Failed to mark messages as read", error: error.message });
    }
  });

  // ============ ADMIN CHAT SUPPORT API ROUTES ============

  // Get all conversations (admin only)
  app.get("/api/admin/support/conversations", isAdmin, async (req: any, res) => {
    try {
      const conversations = await storage.getAllConversations();
      
      const conversationsWithUserInfo = await Promise.all(
        conversations.map(async (conv: any) => {
          let userName = conv.guestName || "Khách";
          let userEmail = conv.guestEmail;
          
          if (conv.userId) {
            const user = await storage.getUser(conv.userId);
            if (user) {
              userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || "User";
              userEmail = user.email;
            }
          }
          
          return {
            ...conv,
            userName,
            userEmail,
          };
        })
      );

      res.json(conversationsWithUserInfo);
    } catch (error: any) {
      console.error("Error getting conversations:", error);
      res.status(500).json({ message: "Failed to get conversations", error: error.message });
    }
  });

  // Get single conversation (admin only)
  app.get("/api/admin/support/conversations/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const conversation = await storage.getConversationById(id);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      res.json(conversation);
    } catch (error: any) {
      console.error("Error getting conversation:", error);
      res.status(500).json({ message: "Failed to get conversation", error: error.message });
    }
  });

  // Get messages for a conversation (admin only)
  app.get("/api/admin/support/conversations/:id/messages", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const messages = await storage.getMessagesByConversationId(id);
      res.json(messages);
    } catch (error: any) {
      console.error("Error getting messages:", error);
      res.status(500).json({ message: "Failed to get messages", error: error.message });
    }
  });

  // Send a message as admin
  app.post("/api/admin/support/conversations/:id/messages", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const adminId = req.user?.claims?.sub;

      if (!content || !content.trim()) {
        return res.status(400).json({ message: "Message content required" });
      }

      const admin = await storage.getUser(adminId);
      const senderName = admin 
        ? `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || "Support" 
        : "Support";

      const message = await storage.createMessage({
        conversationId: id,
        senderType: "admin",
        senderId: adminId,
        senderName,
        content: content.trim(),
      });

      const { emitNewMessage } = await import("./socket");
      emitNewMessage(id, message);

      res.json(message);
    } catch (error: any) {
      console.error("Error sending admin message:", error);
      res.status(500).json({ message: "Failed to send message", error: error.message });
    }
  });

  // Mark messages as read (admin side)
  app.post("/api/admin/support/conversations/:id/read", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.markMessagesAsRead(id, "admin");
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ message: "Failed to mark messages as read", error: error.message });
    }
  });

  // Update conversation status (admin only)
  app.patch("/api/admin/support/conversations/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!["active", "closed"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const conversation = await storage.updateConversationStatus(id, status);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const { emitConversationUpdate } = await import("./socket");
      emitConversationUpdate(conversation);

      res.json(conversation);
    } catch (error: any) {
      console.error("Error updating conversation:", error);
      res.status(500).json({ message: "Failed to update conversation", error: error.message });
    }
  });

  // ============ NOTIFICATION ROUTES ============

  // Get notifications for current user
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const notifications = await storage.getNotificationsForUser(userId);
      res.json(notifications);
    } catch (error: any) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications", error: error.message });
    }
  });

  // Get unread notification count for current user
  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error: any) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count", error: error.message });
    }
  });

  // Mark notification as read
  app.post("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      await storage.markNotificationAsRead(id, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read", error: error.message });
    }
  });

  // Mark all notifications as read
  app.post("/api/notifications/read-all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read", error: error.message });
    }
  });

  // Admin: Get all users for sending notifications
  app.get("/api/admin/users", isAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users", error: error.message });
    }
  });

  // Admin: Get all notifications
  app.get("/api/admin/notifications", isAdmin, async (req: any, res) => {
    try {
      const notifications = await storage.getAllNotifications();
      res.json(notifications);
    } catch (error: any) {
      console.error("Error fetching all notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications", error: error.message });
    }
  });

  // Admin: Create notification (send to all or single user)
  app.post("/api/admin/notifications", isAdmin, async (req: any, res) => {
    try {
      const senderId = req.user.claims.sub;
      const { title, content, type, targetUserId } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({ message: "Title is required" });
      }
      if (!content || !content.trim()) {
        return res.status(400).json({ message: "Content is required" });
      }
      if (!type || !["all", "single"].includes(type)) {
        return res.status(400).json({ message: "Type must be 'all' or 'single'" });
      }
      if (type === "single" && !targetUserId) {
        return res.status(400).json({ message: "Target user ID is required for single notifications" });
      }

      const sender = await storage.getUser(senderId);
      const senderName = sender 
        ? `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || "Admin" 
        : "Admin";

      const notification = await storage.createNotification({
        title: title.trim(),
        content: content.trim(),
        type,
        targetUserId: type === "single" ? targetUserId : undefined,
        senderId,
        senderName,
      });

      res.json(notification);
    } catch (error: any) {
      console.error("Error creating notification:", error);
      res.status(500).json({ message: "Failed to create notification", error: error.message });
    }
  });

  // Admin: Delete notification
  app.delete("/api/admin/notifications/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteNotification(id);
      if (!deleted) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting notification:", error);
      res.status(500).json({ message: "Failed to delete notification", error: error.message });
    }
  });

  // ============================================
  // Points Redemption & Redeemed Files
  // ============================================
  
  // Get user's redeemed files
  app.get("/api/user/redeemed-files", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const mongoStorage = storage as MongoDBStorage;
      const files = await mongoStorage.getUserRedeemedFiles(userId);
      res.json(files);
    } catch (error: any) {
      console.error("Error fetching redeemed files:", error);
      res.status(500).json({ message: "Failed to fetch redeemed files", error: error.message });
    }
  });

  // Redeem points for a document
  app.post("/api/redeem/:documentId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { documentId } = req.params;
      const mongoStorage = storage as MongoDBStorage;

      // Get the document
      const document = await mongoStorage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check if already redeemed
      const alreadyRedeemed = await mongoStorage.hasUserRedeemedDocument(userId, documentId);
      if (alreadyRedeemed) {
        return res.status(400).json({ message: "Bạn đã quy đổi tài liệu này rồi" });
      }

      // Get user and check points
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user is blocked
      if (user.isBlocked) {
        return res.status(403).json({ 
          message: "Tài khoản của bạn đã bị khóa do phát hiện điểm không hợp lệ. Vui lòng liên hệ admin.",
          blocked: true
        });
      }

      const pointsCost = document.pointsCost || document.pageCount || 0;
      if (user.points < pointsCost) {
        return res.status(400).json({ 
          message: "Bạn không đủ điểm để quy đổi tài liệu này",
          required: pointsCost,
          current: user.points
        });
      }

      // Validate points legitimacy before allowing redemption
      const legitimacyCheck = await validateUserLegitimacy(userId);
      if (!legitimacyCheck.isValid) {
        // Block the user immediately
        await blockUser(userId, legitimacyCheck.reason || "Điểm không hợp lệ");
        console.error(`[Security] BLOCKED user ${userId} for illegitimate points: ${legitimacyCheck.reason}`);
        return res.status(403).json({ 
          message: "Tài khoản của bạn đã bị khóa do phát hiện điểm không hợp lệ. Vui lòng liên hệ admin.",
          blocked: true,
          reason: legitimacyCheck.reason
        });
      }

      // Import download function
      const { downloadFromArchive, uploadToSpaces } = await import("./services/doSpaces");
      
      // Download file from archive storage (secure - internal only)
      const archiveKey = `Original-Files/${document.postId}.xlsx`;
      const downloadResult = await downloadFromArchive(archiveKey);
      
      if (!downloadResult.success || !downloadResult.buffer) {
        console.error(`[Redeem] Failed to download file for postId: ${document.postId}`);
        return res.status(500).json({ message: "Không thể tải file từ kho lưu trữ" });
      }

      // Save file to a temporary location
      const tempDir = path.join(process.cwd(), "temp-redeem");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempFileName = `${userId}-${document.postId}.xlsx`;
      const tempFilePath = path.join(tempDir, tempFileName);
      fs.writeFileSync(tempFilePath, downloadResult.buffer);

      // Upload to user's redeemed folder in public bucket
      const userRedeemedKey = `Redeemed-Files/${userId}/${document.postId}.xlsx`;
      const uploadResult = await uploadToSpaces({
        localFilePath: tempFilePath,
        remoteKey: userRedeemedKey,
        isPublic: false, // Private - only accessible via signed URLs or direct download
      });

      // Clean up temp file
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        console.warn("Failed to delete temp file:", e);
      }

      if (!uploadResult.success) {
        console.error(`[Redeem] Failed to upload to user's folder:`, uploadResult.error);
        return res.status(500).json({ message: "Không thể lưu file" });
      }

      // Deduct points
      const deducted = await mongoStorage.deductUserPoints(userId, pointsCost);
      if (!deducted) {
        return res.status(400).json({ message: "Không thể trừ điểm" });
      }

      // Record points usage in legitimate points tracker
      await recordPointsUsage(userId, pointsCost);

      // Create redeemed file record
      const redeemedFile = await mongoStorage.createUserRedeemedFile({
        userId,
        documentId,
        postId: document.postId,
        documentTitle: document.title,
        fileName: `${document.postId}.xlsx`,
        fileSize: downloadResult.fileSize || 0,
        filePath: userRedeemedKey,
        pointsCost,
      });

      // Create redemption log for admin dashboard
      const previousPoints = user.points;
      const newPoints = previousPoints - pointsCost;
      const redemptionLog = new RedemptionLog({
        _id: crypto.randomUUID(),
        userId,
        userEmail: req.user?.claims?.email || "unknown",
        documentId,
        documentTitle: document.title,
        postId: document.postId,
        pointsDeducted: pointsCost,
        previousPoints,
        newPoints,
      });
      await redemptionLog.save();

      console.log(`[Redeem] User ${userId} redeemed document ${document.postId} for ${pointsCost} points`);

      res.json({
        success: true,
        redeemedFile,
        newPoints: user.points - pointsCost,
      });
    } catch (error: any) {
      console.error("Error redeeming document:", error);
      res.status(500).json({ message: "Failed to redeem document", error: error.message });
    }
  });

  // Download a redeemed file
  app.get("/api/user/redeemed-files/:id/download", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const mongoStorage = storage as MongoDBStorage;

      // Get the redeemed file record
      const redeemedFile = await mongoStorage.getRedeemedFile(userId, id);
      if (!redeemedFile) {
        return res.status(404).json({ message: "File not found" });
      }

      // Download from public bucket (user's redeemed folder)
      const { downloadFromArchive } = await import("./services/doSpaces");
      
      // Use the regular spaces bucket for redeemed files
      const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
      
      const DO_ENDPOINT = process.env.DO_ENDPOINT || "https://sgp1.digitaloceanspaces.com";
      const DO_ACCESS_KEY = process.env.DO_ACCESS_KEY;
      const DO_SECRET_KEY = process.env.DO_SECRET_KEY;
      const bucketName = process.env.DO_BUCKET_NAME || "data-ld1";
      
      if (!DO_ACCESS_KEY || !DO_SECRET_KEY) {
        return res.status(500).json({ message: "Storage not configured" });
      }

      const client = new S3Client({
        endpoint: DO_ENDPOINT,
        region: "sgp1",
        credentials: {
          accessKeyId: DO_ACCESS_KEY,
          secretAccessKey: DO_SECRET_KEY,
        },
        forcePathStyle: false,
      });

      const getCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: redeemedFile.filePath,
      });

      const response = await client.send(getCommand);

      if (!response.Body) {
        return res.status(500).json({ message: "Failed to download file" });
      }

      // Set headers for file download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${redeemedFile.fileName}"`);
      
      // Stream the file to response
      const stream = response.Body as any;
      stream.pipe(res);
    } catch (error: any) {
      console.error("Error downloading redeemed file:", error);
      res.status(500).json({ message: "Failed to download file", error: error.message });
    }
  });

  // Check if user has redeemed a document
  app.get("/api/user/redeemed-check/:documentId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { documentId } = req.params;
      const mongoStorage = storage as MongoDBStorage;
      
      const hasRedeemed = await mongoStorage.hasUserRedeemedDocument(userId, documentId);
      res.json({ hasRedeemed });
    } catch (error: any) {
      console.error("Error checking redemption status:", error);
      res.status(500).json({ message: "Failed to check redemption status", error: error.message });
    }
  });

  // Use provided server or create new one
  const httpServer = server || createServer(app);

  // Setup Socket.IO
  const { setupSocket } = await import("./socket");
  setupSocket(httpServer, storage);

  return httpServer;
}
