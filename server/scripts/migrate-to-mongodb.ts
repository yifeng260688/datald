import fs from "fs/promises";
import path from "path";
import { connectMongoDB } from "../mongodb";
import {
  User,
  DocumentModel,
  Favorite,
  Tag,
  DocumentTag,
  UserUpload,
  AdminUpload
} from "../models";

async function migrate() {
  console.log("🔄 Starting PostgreSQL → MongoDB migration...\n");

  try {
    await connectMongoDB();

    const backupPath = path.join(process.cwd(), "postgres-backup", "postgres-backup.json");
    const backupData = JSON.parse(await fs.readFile(backupPath, "utf-8"));

    console.log("📥 Loading backup data...");
    console.log(`   - Users: ${backupData.users.length}`);
    console.log(`   - Documents: ${backupData.documents.length}`);
    console.log(`   - Favorites: ${backupData.favorites.length}`);
    console.log(`   - Tags: ${backupData.tags.length}`);
    console.log(`   - Document Tags: ${backupData.documentTags.length}`);
    console.log(`   - User Uploads: ${backupData.userUploads.length}`);
    console.log(`   - Admin Uploads: ${backupData.adminUploads.length}\n`);

    await User.deleteMany({});
    console.log("🗑️  Cleared existing users");

    await DocumentModel.deleteMany({});
    console.log("🗑️  Cleared existing documents");

    await Favorite.deleteMany({});
    console.log("🗑️  Cleared existing favorites");

    await Tag.deleteMany({});
    console.log("🗑️  Cleared existing tags");

    await DocumentTag.deleteMany({});
    console.log("🗑️  Cleared existing document tags");

    await UserUpload.deleteMany({});
    console.log("🗑️  Cleared existing user uploads");

    await AdminUpload.deleteMany({});
    console.log("🗑️  Cleared existing admin uploads\n");

    if (backupData.users.length > 0) {
      const users = backupData.users.map((u: any) => ({
        _id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        profileImageUrl: u.profileImageUrl,
        role: u.role,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt
      }));
      await User.insertMany(users);
      console.log(`✅ Migrated ${users.length} users`);
    }

    if (backupData.documents.length > 0) {
      const documents = backupData.documents.map((d: any) => ({
        _id: d.id,
        postId: d.postId,
        title: d.title,
        description: d.description,
        category: d.category,
        pageCount: d.pageCount,
        coverImageUrl: d.coverImageUrl,
        imageUrls: d.imageUrls || [],
        viewCount: d.viewCount || 0,
        favoriteCount: 0,
        aiGenerated: false,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt
      }));
      await DocumentModel.insertMany(documents);
      console.log(`✅ Migrated ${documents.length} documents`);
    }

    if (backupData.favorites.length > 0) {
      const favorites = backupData.favorites.map((f: any) => ({
        _id: f.id,
        userId: f.userId,
        documentId: f.documentId,
        createdAt: f.createdAt
      }));
      await Favorite.insertMany(favorites);
      console.log(`✅ Migrated ${favorites.length} favorites`);

      const favoriteCounts = favorites.reduce((acc: any, f: any) => {
        acc[f.documentId] = (acc[f.documentId] || 0) + 1;
        return acc;
      }, {});

      for (const [docId, count] of Object.entries(favoriteCounts)) {
        await DocumentModel.updateOne({ _id: docId }, { favoriteCount: count });
      }
      console.log(`✅ Updated favorite counts for ${Object.keys(favoriteCounts).length} documents`);
    }

    if (backupData.tags.length > 0) {
      const tags = backupData.tags.map((t: any) => ({
        _id: t.id,
        name: t.name,
        createdAt: t.createdAt
      }));
      await Tag.insertMany(tags);
      console.log(`✅ Migrated ${tags.length} tags`);
    }

    if (backupData.documentTags.length > 0) {
      const documentTags = backupData.documentTags.map((dt: any) => ({
        _id: dt.id,
        documentId: dt.documentId,
        tagId: dt.tagId,
        createdAt: dt.createdAt
      }));
      await DocumentTag.insertMany(documentTags);
      console.log(`✅ Migrated ${documentTags.length} document tags`);
    }

    if (backupData.userUploads.length > 0) {
      const userUploads = backupData.userUploads.map((u: any) => ({
        _id: u.id,
        userId: u.userId,
        slot: u.slot,
        fileName: u.fileName,
        fileType: u.fileType,
        filePath: u.filePath,
        fileSize: u.fileSize,
        approvalStatus: u.approvalStatus,
        reviewedBy: u.reviewedBy,
        reviewedAt: u.reviewedAt,
        pipelineStatus: u.pipelineStatus,
        pipelineStartedAt: u.pipelineStartedAt,
        pipelineCompletedAt: u.pipelineCompletedAt,
        aiStatus: "pending",
        uploadedAt: u.uploadedAt
      }));
      await UserUpload.insertMany(userUploads);
      console.log(`✅ Migrated ${userUploads.length} user uploads`);
    }

    if (backupData.adminUploads.length > 0) {
      const adminUploads = backupData.adminUploads.map((a: any) => ({
        _id: a.id,
        uploadedBy: a.uploadedBy,
        fileName: a.fileName,
        fileType: a.fileType,
        filePath: a.filePath,
        fileSize: a.fileSize,
        pipelineStatus: a.pipelineStatus,
        pipelineStartedAt: a.pipelineStartedAt,
        pipelineCompletedAt: a.pipelineCompletedAt,
        aiStatus: "pending",
        uploadedAt: a.uploadedAt
      }));
      await AdminUpload.insertMany(adminUploads);
      console.log(`✅ Migrated ${adminUploads.length} admin uploads`);
    }

    console.log("\n✅ Migration completed successfully!");

    const finalCounts = {
      users: await User.countDocuments(),
      documents: await DocumentModel.countDocuments(),
      favorites: await Favorite.countDocuments(),
      tags: await Tag.countDocuments(),
      documentTags: await DocumentTag.countDocuments(),
      userUploads: await UserUpload.countDocuments(),
      adminUploads: await AdminUpload.countDocuments()
    };

    console.log("\n📊 Final MongoDB counts:");
    console.log(`   - Users: ${finalCounts.users}`);
    console.log(`   - Documents: ${finalCounts.documents}`);
    console.log(`   - Favorites: ${finalCounts.favorites}`);
    console.log(`   - Tags: ${finalCounts.tags}`);
    console.log(`   - Document Tags: ${finalCounts.documentTags}`);
    console.log(`   - User Uploads: ${finalCounts.userUploads}`);
    console.log(`   - Admin Uploads: ${finalCounts.adminUploads}`);

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    process.exit(0);
  }
}

migrate();
