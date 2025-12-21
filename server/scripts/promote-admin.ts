import { connectMongoDB } from "../mongodb";
import { User } from "../models";

/**
 * Script to promote a user to admin role
 * Usage: tsx server/scripts/promote-admin.ts <user-id>
 */

async function promoteUserToAdmin(userId: string) {
  try {
    console.log(`Connecting to MongoDB...`);
    await connectMongoDB();
    
    console.log(`Looking up user: ${userId}`);
    const user = await User.findById(userId);
    
    if (!user) {
      console.error(`❌ User not found: ${userId}`);
      process.exit(1);
    }
    
    console.log(`Found user: ${user.email} (${user.firstName} ${user.lastName})`);
    console.log(`Current role: ${user.role}`);
    
    if (user.role === "admin") {
      console.log(`✅ User is already an admin!`);
      process.exit(0);
    }
    
    console.log(`Promoting user to admin...`);
    user.role = "admin";
    await user.save();
    
    console.log(`✅ Successfully promoted ${user.email} to admin!`);
    console.log(`Please logout and login again to see the changes.`);
    
    process.exit(0);
  } catch (error) {
    console.error("Error promoting user:", error);
    process.exit(1);
  }
}

// Get user ID from command line arguments
const userId = process.argv[2];

if (!userId) {
  console.error("Usage: tsx server/scripts/promote-admin.ts <user-id>");
  console.error("Example: tsx server/scripts/promote-admin.ts 47369284");
  process.exit(1);
}

promoteUserToAdmin(userId);
