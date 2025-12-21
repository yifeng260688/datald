import { db } from "../db";
import { 
  users, 
  documents, 
  favorites, 
  tags, 
  documentTags,
  userUploads,
  adminUploads 
} from "../../shared/schema";
import fs from "fs/promises";
import path from "path";

async function exportData() {
  console.log("🔄 Starting PostgreSQL data export...");
  
  const exportDir = path.join(process.cwd(), "postgres-backup");
  await fs.mkdir(exportDir, { recursive: true });

  try {
    const [
      usersData,
      documentsData,
      favoritesData,
      tagsData,
      documentTagsData,
      userUploadsData,
      adminUploadsData
    ] = await Promise.all([
      db.select().from(users),
      db.select().from(documents),
      db.select().from(favorites),
      db.select().from(tags),
      db.select().from(documentTags),
      db.select().from(userUploads),
      db.select().from(adminUploads)
    ]);

    const exportData = {
      users: usersData,
      documents: documentsData,
      favorites: favoritesData,
      tags: tagsData,
      documentTags: documentTagsData,
      userUploads: userUploadsData,
      adminUploads: adminUploadsData,
      exportedAt: new Date().toISOString(),
      counts: {
        users: usersData.length,
        documents: documentsData.length,
        favorites: favoritesData.length,
        tags: tagsData.length,
        documentTags: documentTagsData.length,
        userUploads: userUploadsData.length,
        adminUploads: adminUploadsData.length
      }
    };

    await fs.writeFile(
      path.join(exportDir, "postgres-backup.json"),
      JSON.stringify(exportData, null, 2)
    );

    console.log("\n✅ Export completed successfully!");
    console.log("📊 Exported data:");
    console.log(`   - Users: ${exportData.counts.users}`);
    console.log(`   - Documents: ${exportData.counts.documents}`);
    console.log(`   - Favorites: ${exportData.counts.favorites}`);
    console.log(`   - Tags: ${exportData.counts.tags}`);
    console.log(`   - Document Tags: ${exportData.counts.documentTags}`);
    console.log(`   - User Uploads: ${exportData.counts.userUploads}`);
    console.log(`   - Admin Uploads: ${exportData.counts.adminUploads}`);
    console.log(`\n📁 Backup saved to: ${exportDir}/postgres-backup.json`);

  } catch (error) {
    console.error("❌ Export failed:", error);
    throw error;
  } finally {
    process.exit(0);
  }
}

exportData();
