import { connectMongoDB } from "../mongodb";
import { UserUpload } from "../models";

async function checkUploads() {
  try {
    console.log("Connecting to MongoDB...");
    await connectMongoDB();
    
    console.log("\nFetching user uploads...");
    const uploads = await UserUpload.find().populate('userId');
    
    console.log(`\nFound ${uploads.length} uploads:\n`);
    
    for (const upload of uploads) {
      console.log(`Upload ID: ${upload._id}`);
      console.log(`  User: ${upload.userId}`);
      console.log(`  Filename: ${upload.fileName}`);
      console.log(`  File Path: ${upload.filePath}`);
      console.log(`  File Type: ${upload.fileType}`);
      console.log(`  File Size: ${upload.fileSize} bytes`);
      console.log(`  Status: ${upload.approvalStatus}`);
      console.log(`  Uploaded: ${upload.uploadedAt}`);
      console.log('---');
    }
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkUploads();
