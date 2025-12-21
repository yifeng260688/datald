#!/usr/bin/env tsx
/**
 * Script để liệt kê tất cả admin trong hệ thống
 * Usage: npx tsx server/scripts/list-admins.ts
 */

import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function listAdmins() {
  try {
    console.log("🔍 Đang tìm tất cả admin...\n");

    const admins = await db
      .select()
      .from(users)
      .where(eq(users.role, "admin"));

    if (admins.length === 0) {
      console.log("⚠️  Chưa có admin nào trong hệ thống");
      console.log("💡 Sử dụng: npx tsx server/scripts/make-admin.ts <email>");
      process.exit(0);
    }

    console.log(`✅ Tìm thấy ${admins.length} admin:\n`);
    
    admins.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.firstName || ''} ${admin.lastName || ''}`.trim());
      console.log(`   📧 Email: ${admin.email}`);
      console.log(`   🆔 ID: ${admin.id}`);
      console.log(`   📅 Tạo lúc: ${admin.createdAt?.toLocaleString('vi-VN')}`);
      console.log("");
    });

  } catch (error) {
    console.error("❌ Lỗi khi liệt kê admin:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

listAdmins();
