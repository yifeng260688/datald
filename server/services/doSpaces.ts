import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs/promises";
import path from "path";

const REGION = "sgp1";

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const DO_ENDPOINT = process.env.DO_ENDPOINT || "https://sgp1.digitaloceanspaces.com";
    const DO_ACCESS_KEY = process.env.DO_ACCESS_KEY;
    const DO_SECRET_KEY = process.env.DO_SECRET_KEY;
    
    console.log(`[DO Spaces] Initializing client with endpoint: ${DO_ENDPOINT}`);
    console.log(`[DO Spaces] Access Key present: ${!!DO_ACCESS_KEY}, Secret Key present: ${!!DO_SECRET_KEY}`);
    
    if (!DO_ACCESS_KEY || !DO_SECRET_KEY) {
      throw new Error("DO_ACCESS_KEY and DO_SECRET_KEY are required for DigitalOcean Spaces");
    }
    
    s3Client = new S3Client({
      endpoint: DO_ENDPOINT,
      region: REGION,
      credentials: {
        accessKeyId: DO_ACCESS_KEY,
        secretAccessKey: DO_SECRET_KEY,
      },
      forcePathStyle: false,
    });
    
    console.log(`[DO Spaces] S3 client initialized successfully`);
  }
  return s3Client;
}

export function resetS3Client(): void {
  s3Client = null;
  console.log(`[DO Spaces] S3 client reset - will reinitialize on next use`);
}

function getBucketName(): string {
  return process.env.DO_BUCKET_NAME || "data-ld1";
}

export interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

export interface UploadOptions {
  localFilePath: string;
  remoteKey: string;
  contentType?: string;
  isPublic?: boolean;
}

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".csv": "text/csv",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

export async function uploadToSpaces(options: UploadOptions): Promise<UploadResult> {
  const { localFilePath, remoteKey, contentType, isPublic = true } = options;
  
  try {
    const client = getS3Client();
    
    const fileContent = await fs.readFile(localFilePath);
    const mimeType = contentType || getContentType(localFilePath);
    const bucketName = getBucketName();
    
    console.log(`[DO Spaces] Uploading to bucket: ${bucketName}, key: ${remoteKey}, size: ${fileContent.length} bytes`);
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: remoteKey,
      Body: fileContent,
      ContentType: mimeType,
      ACL: isPublic ? "public-read" : "private",
    });
    
    await client.send(command);
    
    const cdnUrl = `https://${bucketName}.${REGION}.cdn.digitaloceanspaces.com/${remoteKey}`;
    
    console.log(`[DO Spaces] Uploaded: ${remoteKey} -> ${cdnUrl}`);
    
    return {
      success: true,
      url: cdnUrl,
      key: remoteKey,
    };
  } catch (error: any) {
    const errorName = error.name || 'Unknown';
    const errorCode = error.$metadata?.httpStatusCode || 'N/A';
    const errorMessage = error.message || 'No message';
    console.error(`[DO Spaces] Upload failed for ${remoteKey}:`);
    console.error(`  - Error Name: ${errorName}`);
    console.error(`  - HTTP Status: ${errorCode}`);
    console.error(`  - Message: ${errorMessage}`);
    if (error.$metadata) {
      console.error(`  - Metadata:`, JSON.stringify(error.$metadata, null, 2));
    }
    return {
      success: false,
      error: `${errorName}: ${errorMessage} (HTTP ${errorCode})`,
    };
  }
}

export async function uploadMultipleToSpaces(
  files: { localPath: string; remotePath: string }[],
  folderName: string
): Promise<{ success: boolean; urls: string[]; errors: string[] }> {
  const urls: string[] = [];
  const errors: string[] = [];
  
  for (const file of files) {
    const remoteKey = `${folderName}/${file.remotePath}`;
    const result = await uploadToSpaces({
      localFilePath: file.localPath,
      remoteKey,
    });
    
    if (result.success && result.url) {
      urls.push(result.url);
    } else {
      errors.push(result.error || `Failed to upload ${file.localPath}`);
    }
  }
  
  return {
    success: errors.length === 0,
    urls,
    errors,
  };
}

export async function deleteFromSpaces(remoteKey: string): Promise<boolean> {
  try {
    const client = getS3Client();
    
    const command = new DeleteObjectCommand({
      Bucket: getBucketName(),
      Key: remoteKey,
    });
    
    await client.send(command);
    console.log(`[DO Spaces] Deleted: ${remoteKey}`);
    return true;
  } catch (error: any) {
    console.error(`[DO Spaces] Delete failed for ${remoteKey}:`, error.message);
    return false;
  }
}

export function generateFolderName(postId: string, originalFileName: string): string {
  const baseName = path.basename(originalFileName, path.extname(originalFileName));
  const sanitizedName = baseName.replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1E00-\u1EFF]/g, "_").substring(0, 50);
  return `${postId}-${sanitizedName}`;
}

// ============================================
// ARCHIVE BUCKET (datashop) - for original files
// ============================================

let archiveS3Client: S3Client | null = null;

function getArchiveS3Client(): S3Client {
  if (!archiveS3Client) {
    const DO_ENDPOINT = process.env.DO_ENDPOINT_1 || "https://sgp1.digitaloceanspaces.com";
    const DO_ACCESS_KEY = process.env.DO_ACCESS_KEY_1;
    const DO_SECRET_KEY = process.env.DO_SECRET_KEY_1;
    
    console.log(`[DO Archive] Initializing archive client with endpoint: ${DO_ENDPOINT}`);
    console.log(`[DO Archive] Access Key present: ${!!DO_ACCESS_KEY}, Secret Key present: ${!!DO_SECRET_KEY}`);
    
    if (!DO_ACCESS_KEY || !DO_SECRET_KEY) {
      throw new Error("DO_ACCESS_KEY_1 and DO_SECRET_KEY_1 are required for archive bucket");
    }
    
    archiveS3Client = new S3Client({
      endpoint: DO_ENDPOINT,
      region: REGION,
      credentials: {
        accessKeyId: DO_ACCESS_KEY,
        secretAccessKey: DO_SECRET_KEY,
      },
      forcePathStyle: false,
    });
    
    console.log(`[DO Archive] Archive S3 client initialized successfully`);
  }
  return archiveS3Client;
}

function getArchiveBucketName(): string {
  return process.env.DO_BUCKET_NAME_1 || "datashop";
}

export interface DownloadResult {
  success: boolean;
  buffer?: Buffer;
  contentType?: string;
  fileSize?: number;
  error?: string;
}

/**
 * Download a file from archive bucket (datashop) - used for redemption
 * This returns the file buffer without exposing the storage URL
 */
export async function downloadFromArchive(remoteKey: string): Promise<DownloadResult> {
  try {
    const client = getArchiveS3Client();
    const bucketName = getArchiveBucketName();
    
    console.log(`[DO Archive] Downloading from bucket: ${bucketName}, key: ${remoteKey}`);
    
    // First check if file exists
    const headCommand = new HeadObjectCommand({
      Bucket: bucketName,
      Key: remoteKey,
    });
    
    let fileSize = 0;
    let contentType = 'application/octet-stream';
    
    try {
      const headResult = await client.send(headCommand);
      fileSize = headResult.ContentLength || 0;
      contentType = headResult.ContentType || 'application/octet-stream';
    } catch (headError: any) {
      if (headError.name === 'NotFound' || headError.$metadata?.httpStatusCode === 404) {
        console.error(`[DO Archive] File not found: ${remoteKey}`);
        return { success: false, error: 'File not found' };
      }
      throw headError;
    }
    
    // Download the file
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: remoteKey,
    });
    
    const response = await client.send(getCommand);
    
    if (!response.Body) {
      return { success: false, error: 'Empty response body' };
    }
    
    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    console.log(`[DO Archive] Downloaded: ${remoteKey}, size: ${buffer.length} bytes`);
    
    return {
      success: true,
      buffer,
      contentType,
      fileSize: buffer.length,
    };
  } catch (error: any) {
    const errorName = error.name || 'Unknown';
    const errorCode = error.$metadata?.httpStatusCode || 'N/A';
    const errorMessage = error.message || 'No message';
    console.error(`[DO Archive] Download failed for ${remoteKey}:`);
    console.error(`  - Error Name: ${errorName}`);
    console.error(`  - HTTP Status: ${errorCode}`);
    console.error(`  - Message: ${errorMessage}`);
    return {
      success: false,
      error: `${errorName}: ${errorMessage} (HTTP ${errorCode})`,
    };
  }
}

/**
 * Download a file from main bucket (data-ld1) - used for image proxying
 * This returns the file buffer without exposing the storage URL
 */
export async function downloadFromSpaces(remoteKey: string): Promise<DownloadResult> {
  try {
    const client = getS3Client();
    const bucketName = getBucketName();
    
    // Download the file
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: remoteKey,
    });
    
    const response = await client.send(getCommand);
    
    if (!response.Body) {
      return { success: false, error: 'Empty response body' };
    }
    
    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    return {
      success: true,
      buffer,
      contentType: response.ContentType || 'image/png',
      fileSize: buffer.length,
    };
  } catch (error: any) {
    const errorName = error.name || 'Unknown';
    const errorCode = error.$metadata?.httpStatusCode || 'N/A';
    const errorMessage = error.message || 'No message';
    console.error(`[DO Spaces] Download failed for ${remoteKey}: ${errorName} (HTTP ${errorCode})`);
    return {
      success: false,
      error: `${errorName}: ${errorMessage} (HTTP ${errorCode})`,
    };
  }
}

/**
 * Extract the object key from a full CDN URL
 */
export function extractKeyFromCdnUrl(cdnUrl: string): string | null {
  const bucketName = getBucketName();
  const pattern = new RegExp(`https://${bucketName}\\.${REGION}\\.cdn\\.digitaloceanspaces\\.com/(.+)`);
  const match = cdnUrl.match(pattern);
  return match ? match[1] : null;
}

export async function uploadOriginalToArchive(localFilePath: string, remoteKey: string): Promise<UploadResult> {
  try {
    const client = getArchiveS3Client();
    const fileContent = await fs.readFile(localFilePath);
    const mimeType = getContentType(localFilePath);
    const bucketName = getArchiveBucketName();
    
    console.log(`[DO Archive] Uploading original to bucket: ${bucketName}, key: ${remoteKey}, size: ${fileContent.length} bytes`);
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: remoteKey,
      Body: fileContent,
      ContentType: mimeType,
      ACL: "private",
    });
    
    await client.send(command);
    
    const url = `https://${bucketName}.${REGION}.digitaloceanspaces.com/${remoteKey}`;
    
    console.log(`[DO Archive] Original file uploaded: ${remoteKey}`);
    
    return {
      success: true,
      url,
      key: remoteKey,
    };
  } catch (error: any) {
    const errorName = error.name || 'Unknown';
    const errorCode = error.$metadata?.httpStatusCode || 'N/A';
    const errorMessage = error.message || 'No message';
    console.error(`[DO Archive] Upload failed for ${remoteKey}:`);
    console.error(`  - Error Name: ${errorName}`);
    console.error(`  - HTTP Status: ${errorCode}`);
    console.error(`  - Message: ${errorMessage}`);
    if (error.$metadata) {
      console.error(`  - Metadata:`, JSON.stringify(error.$metadata, null, 2));
    }
    return {
      success: false,
      error: `${errorName}: ${errorMessage} (HTTP ${errorCode})`,
    };
  }
}
