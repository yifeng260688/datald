import fs from "fs/promises";
import path from "path";
import { createRequire } from "module";
import { parse as csvParse } from "csv-parse/sync";

// pdf-parse and xlsx are CommonJS modules, need to use require in ESM
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

// pdf-parse v2.4.5+ - lazy load function to handle ESM/CommonJS compatibility
let pdfParseCache: any = null;

async function getPdfParse(): Promise<any> {
  if (pdfParseCache) {
    return pdfParseCache;
  }
  
  try {
    // Try dynamic import first (for ESM)
    const pdfParseModule = await import("pdf-parse");
    pdfParseCache = pdfParseModule.default || pdfParseModule;
    return pdfParseCache;
  } catch (e) {
    // Fallback to require (for CommonJS)
    const pdfParseModule = require("pdf-parse");
    // Handle different export formats
    if (typeof pdfParseModule === 'function') {
      pdfParseCache = pdfParseModule;
    } else if (pdfParseModule.default && typeof pdfParseModule.default === 'function') {
      pdfParseCache = pdfParseModule.default;
    } else {
      // Try to find the function in the module
      const funcKeys = Object.keys(pdfParseModule).filter(key => typeof pdfParseModule[key] === 'function');
      if (funcKeys.length > 0) {
        pdfParseCache = pdfParseModule[funcKeys[0]];
      } else {
        throw new Error('Could not find pdfParse function in pdf-parse module');
      }
    }
    return pdfParseCache;
  }
}

export interface TextExtractionResult {
  success: boolean;
  text?: string;
  error?: string;
  metadata?: {
    pageCount?: number;
    sheetNames?: string[];
    rowCount?: number;
  };
}

/**
 * Extract text from PDF files using pdf-parse
 */
async function extractFromPDF(filePath: string): Promise<TextExtractionResult> {
  try {
    const pdfParse = await getPdfParse();
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);

    if (!data.text || data.text.trim().length === 0) {
      return {
        success: false,
        error: "PDF file contains no extractable text. It may be image-based or encrypted.",
      };
    }

    return {
      success: true,
      text: data.text,
      metadata: {
        pageCount: data.numpages,
      },
    };
  } catch (error: any) {
    console.error("PDF extraction error:", error);
    return {
      success: false,
      error: `Failed to extract text from PDF: ${error.message}`,
    };
  }
}

/**
 * Extract text from Excel files (XLS, XLSX) using xlsx
 */
async function extractFromExcel(filePath: string): Promise<TextExtractionResult> {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames;

    if (sheetNames.length === 0) {
      return {
        success: false,
        error: "Excel file contains no sheets.",
      };
    }

    // Extract text from all sheets
    const textParts: string[] = [];
    let totalRows = 0;

    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert sheet to JSON to get structured data
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      totalRows += jsonData.length;

      // Add sheet name as header
      textParts.push(`\n=== Sheet: ${sheetName} ===\n`);

      // Convert rows to text
      for (const row of jsonData as any[]) {
        if (Array.isArray(row) && row.length > 0) {
          const rowText = row
            .filter(cell => cell !== null && cell !== undefined && cell !== '')
            .join(' | ');
          
          if (rowText.trim()) {
            textParts.push(rowText);
          }
        }
      }
    }

    const extractedText = textParts.join('\n').trim();

    if (!extractedText || extractedText.length === 0) {
      return {
        success: false,
        error: "Excel file contains no extractable data.",
      };
    }

    return {
      success: true,
      text: extractedText,
      metadata: {
        sheetNames,
        rowCount: totalRows,
      },
    };
  } catch (error: any) {
    console.error("Excel extraction error:", error);
    return {
      success: false,
      error: `Failed to extract text from Excel: ${error.message}`,
    };
  }
}

/**
 * Extract text from CSV files using csv-parse
 */
async function extractFromCSV(filePath: string): Promise<TextExtractionResult> {
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');

    // Parse CSV
    const records = csvParse(fileContent, {
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true, // Allow varying column counts
    });

    if (!records || records.length === 0) {
      return {
        success: false,
        error: "CSV file contains no data.",
      };
    }

    // Convert CSV data to text
    const textParts: string[] = [];
    
    for (const row of records) {
      if (Array.isArray(row) && row.length > 0) {
        const rowText = row
          .filter((cell: any) => cell !== null && cell !== undefined && cell !== '')
          .join(' | ');
        
        if (rowText.trim()) {
          textParts.push(rowText);
        }
      }
    }

    const extractedText = textParts.join('\n').trim();

    if (!extractedText || extractedText.length === 0) {
      return {
        success: false,
        error: "CSV file contains no extractable data.",
      };
    }

    return {
      success: true,
      text: extractedText,
      metadata: {
        rowCount: records.length,
      },
    };
  } catch (error: any) {
    console.error("CSV extraction error:", error);
    return {
      success: false,
      error: `Failed to extract text from CSV: ${error.message}`,
    };
  }
}

/**
 * Extract text from a file based on its MIME type
 * Supports: PDF, Excel (XLS, XLSX), CSV
 */
export async function extractTextFromFile(
  filePath: string,
  mimeType: string
): Promise<TextExtractionResult> {
  console.log(`📄 Extracting text from: ${path.basename(filePath)} (${mimeType})`);

  // Verify file exists
  try {
    await fs.access(filePath);
  } catch (error) {
    return {
      success: false,
      error: `File not found: ${filePath}`,
    };
  }

  // Route to appropriate extractor based on MIME type
  if (mimeType === "application/pdf") {
    return await extractFromPDF(filePath);
  } 
  else if (
    mimeType === "application/vnd.ms-excel" || 
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return await extractFromExcel(filePath);
  } 
  else if (mimeType === "text/csv") {
    return await extractFromCSV(filePath);
  } 
  else {
    return {
      success: false,
      error: `Unsupported file type: ${mimeType}. Supported types: PDF, Excel (XLS/XLSX), CSV`,
    };
  }
}

/**
 * Extract text with file size limit check (to prevent memory issues)
 */
export async function extractTextWithSizeCheck(
  filePath: string,
  mimeType: string,
  maxSizeMB: number = 50
): Promise<TextExtractionResult> {
  try {
    const stats = await fs.stat(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);

    if (fileSizeMB > maxSizeMB) {
      return {
        success: false,
        error: `File too large (${fileSizeMB.toFixed(2)}MB). Maximum size: ${maxSizeMB}MB`,
      };
    }

    return await extractTextFromFile(filePath, mimeType);
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to check file size: ${error.message}`,
    };
  }
}
