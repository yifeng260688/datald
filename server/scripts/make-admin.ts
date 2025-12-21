#!/usr/bin/env tsx
/**
 * Script để bổ nhiệm admin thông qua email
 * Usage: npm run make-admin <email>
 * Example: npm run make-admin user@example.com
 */

import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function makeAdmin(email: string) {
  if (!email) {
    console.error("❌ Lỗi: Vui lòng cung cấp email");
    console.log("Cách sử dụng: npm run make-admin <email>");
    console.log("Ví dụ: npm run make-admin user@example.com");
    process.exit(1);
  }

  try {
    console.log(`🔍 Đang tìm user với email: ${email}...`);

    // Tìm user theo email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      console.error(`❌ Không tìm thấy user với email: ${email}`);
      console.log("\n💡 Lưu ý: User phải đăng nhập ít nhất 1 lần trước khi bổ nhiệm admin");
      process.exit(1);
    }

    // Kiểm tra nếu đã là admin
    if (user.role === "admin") {
      console.log(`✅ User ${email} đã là admin rồi!`);
      console.log(`   Tên: ${user.firstName} ${user.lastName}`);
      console.log(`   ID: ${user.id}`);
      process.exit(0);
    }

    // Update role thành admin
    console.log(`⚙️  Đang cập nhật role...`);
    const [updatedUser] = await db
      .update(users)
      .set({ 
        role: "admin",
        updatedAt: new Date()
      })
      .where(eq(users.email, email))
      .returning();

    console.log("\n✅ Bổ nhiệm admin thành công!");
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   Tên: ${updatedUser.firstName} ${updatedUser.lastName}`);
    console.log(`   Role: ${updatedUser.role}`);
    console.log(`   ID: ${updatedUser.id}`);
    console.log("\n🎉 User này giờ đã có quyền admin!");

  } catch (error) {
    console.error("❌ Lỗi khi bổ nhiệm admin:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Lấy email từ command line arguments
const email = process.argv[2];
makeAdmin(email);
