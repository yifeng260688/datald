import mongoose from "mongoose";
import MongoStore from "connect-mongo";
import session from "express-session";
import type { SessionOptions } from "express-session";

const MONGO_URI = process.env.MONGO_URI;
const USE_MONGO = process.env.USE_MONGO !== "false";

export async function connectMongoDB(retries = 3, retryDelay = 2000): Promise<boolean> {
  if (!USE_MONGO) {
    console.log("⚠️  MongoDB disabled via USE_MONGO=false - using in-memory storage");
    return false;
  }

  if (!MONGO_URI) {
    console.warn("⚠️  MONGO_URI not configured - falling back to in-memory storage");
    return false;
  }

  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
      });
      console.log("✅ MongoDB connected successfully");
      return true;
    } catch (error) {
      console.error(`❌ MongoDB connection attempt ${i + 1}/${retries} failed:`, error instanceof Error ? error.message : error);
      
      if (i === retries - 1) {
        console.error("⚠️  MongoDB connection failed after all retries");
        console.error("⚠️  This may be due to IP whitelisting in MongoDB Atlas");
        console.error("⚠️  Please check: https://www.mongodb.com/docs/atlas/security-whitelist/");
        console.error("⚠️  Falling back to IN-MEMORY storage (data not persisted)");
        return false;
      }
      
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  return false;
}

mongoose.connection.on("error", (error) => {
  console.error("MongoDB connection error:", error);
});

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected");
});

export function createSessionStore(mongoConnected: boolean): SessionOptions["store"] {
  if (mongoConnected && MONGO_URI) {
    console.log("✅ Using MongoDB session store");
    return MongoStore.create({
      mongoUrl: MONGO_URI,
      collectionName: "sessions",
      ttl: 7 * 24 * 60 * 60,
      autoRemove: "native",
      touchAfter: 24 * 3600,
      // Removed crypto encryption to avoid decryption errors with old sessions
      // Sessions are still secure via httpOnly cookies and SESSION_SECRET
    });
  } else {
    console.log("⚠️  Using in-memory session store (sessions lost on restart)");
    return new session.MemoryStore();
  }
}

export { mongoose };
