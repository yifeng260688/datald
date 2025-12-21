import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI;

async function testConnection() {
  console.log("🔍 Testing MongoDB Connection...\n");
  
  if (!MONGO_URI) {
    console.error("❌ MONGO_URI environment variable not found!");
    process.exit(1);
  }

  const uriWithoutPassword = MONGO_URI.replace(/:[^:@]+@/, ":***@");
  console.log("📝 Connection URI (password hidden):");
  console.log(`   ${uriWithoutPassword}\n`);

  const uriParts = MONGO_URI.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/?([^?]*)/);
  
  if (uriParts) {
    console.log("🔍 URI Components:");
    console.log(`   Username: ${uriParts[1]}`);
    console.log(`   Password: ${"*".repeat(uriParts[2].length)} (${uriParts[2].length} chars)`);
    console.log(`   Host: ${uriParts[3]}`);
    console.log(`   Database: ${uriParts[4] || "(default: test)"}\n`);
  }

  try {
    console.log("🔄 Attempting to connect...");
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    
    console.log("✅ MongoDB connected successfully!");
    console.log(`   Database: ${mongoose.connection.db.databaseName}`);
    console.log(`   Host: ${mongoose.connection.host}`);
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`   Collections: ${collections.length}`);
    
    if (collections.length > 0) {
      console.log(`   Found collections: ${collections.map(c => c.name).join(", ")}`);
    }
    
    await mongoose.disconnect();
    console.log("\n✅ Test completed successfully!");
    
  } catch (error) {
    console.error("\n❌ Connection failed!");
    
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
      
      if (error.message.includes("authentication failed")) {
        console.log("\n💡 Troubleshooting Steps:");
        console.log("   1. Kiểm tra MongoDB Atlas → Database Access");
        console.log("   2. Xác nhận user tồn tại và password đúng");
        console.log("   3. User phải có quyền 'Read and write to any database'");
        console.log("   4. Nếu password có ký tự đặc biệt, cần URL encode");
        console.log("   5. Thử tạo user mới với password đơn giản để test");
      }
      
      if (error.message.includes("ENOTFOUND")) {
        console.log("\n💡 Troubleshooting Steps:");
        console.log("   1. Kiểm tra Network Access trong MongoDB Atlas");
        console.log("   2. Thêm IP 0.0.0.0/0 vào whitelist để test");
        console.log("   3. Xác nhận cluster đang chạy (không paused)");
      }
    }
    
    throw error;
  } finally {
    process.exit(0);
  }
}

testConnection();
