import { extractTextFromFile } from "./textExtractor";
import { generateMetadataFromText } from "./gemini";
import type { MongoDBStorage } from "../mongo-storage";

export interface AIProcessingResult {
  success: boolean;
  metadata?: {
    title: string;
    description: string;
    category: string;
  };
  error?: string;
}

export async function processFileWithAI(
  filePath: string,
  mimeType: string,
  uploadId: string,
  uploadType: 'user' | 'admin',
  storage: MongoDBStorage,
  inputCategory?: string
): Promise<AIProcessingResult> {
  const logPrefix = `[AI-${uploadType === 'user' ? 'User' : 'Admin'}] Upload ${uploadId}:`;
  
  try {
    console.log(`${logPrefix} Starting AI processing for ${filePath}${inputCategory ? ` (category: ${inputCategory})` : ''}`);

    // Step 1: Extract text from file
    console.log(`${logPrefix} Extracting text...`);
    const extractionResult = await extractTextFromFile(filePath, mimeType);
    
    if (!extractionResult.success || !extractionResult.text) {
      const errorMsg = extractionResult.error || "Failed to extract text from file";
      console.error(`${logPrefix} Text extraction failed:`, errorMsg);
      
      // Update database with error
      if (uploadType === 'user') {
        await storage.updateUserUploadAIError(uploadId, errorMsg);
      } else {
        await storage.updateAdminUploadAIError(uploadId, errorMsg);
      }
      
      return {
        success: false,
        error: errorMsg
      };
    }

    console.log(`${logPrefix} Text extracted (${extractionResult.text.length} chars)`);

    // Determine file type for context
    const fileType = mimeType.includes('pdf') ? 'PDF' 
      : mimeType.includes('excel') || mimeType.includes('spreadsheet') ? 'Excel'
      : mimeType.includes('csv') ? 'CSV'
      : 'document';

    // Step 2: Generate metadata using Gemini AI with category context
    console.log(`${logPrefix} Generating metadata with Gemini AI...`);
    const metadataResult = await generateMetadataFromText(extractionResult.text, fileType, inputCategory);
    
    if (!metadataResult.success || !metadataResult.metadata) {
      const errorMsg = metadataResult.error || "Failed to generate metadata";
      console.error(`${logPrefix} Metadata generation failed:`, errorMsg);
      
      // Update database with error
      if (uploadType === 'user') {
        await storage.updateUserUploadAIError(uploadId, errorMsg);
      } else {
        await storage.updateAdminUploadAIError(uploadId, errorMsg);
      }
      
      return {
        success: false,
        error: errorMsg
      };
    }

    const { title, description } = metadataResult.metadata;
    // Use input category (admin-selected) or default to "Khác"
    const category = inputCategory || "Khác";
    
    console.log(`${logPrefix} Metadata generated successfully:`);
    console.log(`  - Title: ${title.substring(0, 50)}...`);
    console.log(`  - Category: ${category}`);

    // Step 3: Update upload record with AI-generated metadata
    console.log(`${logPrefix} Updating database with AI metadata...`);
    
    if (uploadType === 'user') {
      await storage.updateUserUploadMetadata(uploadId, { title, description, category });
    } else {
      await storage.updateAdminUploadMetadata(uploadId, { title, description, category });
    }

    console.log(`${logPrefix} ✅ AI processing completed successfully!`);

    return {
      success: true,
      metadata: { title, description, category }
    };

  } catch (error: any) {
    const errorMsg = error.message || "Unexpected error during AI processing";
    console.error(`${logPrefix} ❌ Unexpected error:`, errorMsg);
    
    // Update database with error
    try {
      if (uploadType === 'user') {
        await storage.updateUserUploadAIError(uploadId, errorMsg);
      } else {
        await storage.updateAdminUploadAIError(uploadId, errorMsg);
      }
    } catch (dbError) {
      console.error(`${logPrefix} Failed to update error in database:`, dbError);
    }
    
    return {
      success: false,
      error: errorMsg
    };
  }
}
