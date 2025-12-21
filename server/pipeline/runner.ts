import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import { createRequire } from "module";
import { uploadToSpaces, generateFolderName, uploadOriginalToArchive } from "../services/doSpaces";
import xlsx from "xlsx";

// pdf-parse v2.4.5+ - lazy load function to handle ESM/CommonJS compatibility
let pdfParseCache: any = null;

async function getPdfParse(): Promise<any> {
  if (pdfParseCache) {
    return pdfParseCache;
  }
  
  try {
    // Try dynamic import first (for ESM)
    const pdfParseModule = await import("pdf-parse");
    // pdf-parse v2.4.5+ exports as default function
    if (typeof pdfParseModule.default === 'function') {
      pdfParseCache = pdfParseModule.default;
    } else if (typeof pdfParseModule === 'function') {
      pdfParseCache = pdfParseModule;
    } else {
      // Try to find function in module
      const funcKeys = Object.keys(pdfParseModule).filter(key => typeof pdfParseModule[key] === 'function');
      if (funcKeys.length > 0) {
        pdfParseCache = pdfParseModule[funcKeys[0]];
      } else {
        throw new Error('Could not find pdfParse function in ESM module');
      }
    }
    return pdfParseCache;
  } catch (e) {
    // Fallback to require (for CommonJS)
    const require = createRequire(import.meta.url);
    const pdfParseModule = require("pdf-parse");
    
    console.log('[pdfParse] Module type:', typeof pdfParseModule);
    console.log('[pdfParse] Module keys:', Object.keys(pdfParseModule).slice(0, 15));
    
    // Handle different export formats
    if (typeof pdfParseModule === 'function') {
      pdfParseCache = pdfParseModule;
      console.log('[pdfParse] Using direct function export');
    } else if (pdfParseModule.default && typeof pdfParseModule.default === 'function') {
      pdfParseCache = pdfParseModule.default;
      console.log('[pdfParse] Using default export');
    } else if (pdfParseModule.pdfParse && typeof pdfParseModule.pdfParse === 'function') {
      pdfParseCache = pdfParseModule.pdfParse;
      console.log('[pdfParse] Using named pdfParse export');
    } else {
      // Try to find the function in the module - look for async functions first
      const allFuncs = Object.keys(pdfParseModule).filter(key => typeof pdfParseModule[key] === 'function');
      console.log('[pdfParse] Found functions:', allFuncs);
      
      // Filter for functions that might be the parser (usually async functions)
      const asyncFuncs = allFuncs.filter(key => {
        const fn = pdfParseModule[key];
        return fn.constructor.name === 'AsyncFunction' || fn.length > 0; // AsyncFunction or takes parameters
      });
      
      if (asyncFuncs.length > 0) {
        pdfParseCache = pdfParseModule[asyncFuncs[0]];
        console.log(`[pdfParse] Using async function: ${asyncFuncs[0]}`);
      } else if (allFuncs.length > 0) {
        pdfParseCache = pdfParseModule[allFuncs[0]];
        console.log(`[pdfParse] Using first function: ${allFuncs[0]}`);
      } else {
        // Last resort: check if module itself is callable
        console.error('[pdfParse] Module structure:', Object.keys(pdfParseModule).slice(0, 10));
        throw new Error(`Could not find pdfParse function. Module type: ${typeof pdfParseModule}, Keys: ${Object.keys(pdfParseModule).slice(0, 5).join(', ')}`);
      }
    }
    
    // Verify it's actually a function
    if (typeof pdfParseCache !== 'function') {
      console.error('[pdfParse] Cache type:', typeof pdfParseCache);
      throw new Error(`pdfParse is not a function, got: ${typeof pdfParseCache}`);
    }
    
    console.log('[pdfParse] Successfully loaded pdfParse function');
    return pdfParseCache;
  }
}

const PIPELINE_DIR = path.join(process.cwd(), "server", "pipeline");

/**
 * Check if a file is a PDF based on extension or mimetype
 */
function isPdfFile(filePath: string, mimetype?: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return true;
  if (mimetype && mimetype.toLowerCase() === 'application/pdf') return true;
  return false;
}

/**
 * Parse PDF text and extract tabular data.
 * PDFs often have inconsistent formatting, so we try to detect columns by whitespace patterns.
 */
function parseTextToRows(text: string): string[][] {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  const rows: string[][] = [];
  
  for (const line of lines) {
    // Try to split by multiple spaces (common in PDFs with tabular data)
    // Also handle tab-separated values
    let cells: string[];
    
    if (line.includes('\t')) {
      cells = line.split('\t').map(c => c.trim());
    } else {
      // Split by 2+ spaces to preserve single-space content
      cells = line.split(/\s{2,}/).map(c => c.trim());
    }
    
    // Filter out empty cells
    cells = cells.filter(c => c !== '');
    
    if (cells.length > 0) {
      rows.push(cells);
    }
  }
  
  return rows;
}

/**
 * Convert PDF file to Excel format.
 * Extracts text from PDF and attempts to parse tabular data.
 * Returns the path to the newly created Excel file.
 */
async function convertPdfToExcel(pdfPath: string, outputDir: string): Promise<string> {
  console.log(`[Pipeline] Converting PDF to Excel: ${path.basename(pdfPath)}`);
  
  // Get pdfParse function
  const pdfParse = await getPdfParse();
  
  // Read PDF file
  const pdfBuffer = await fs.readFile(pdfPath);
  const pdfData = await pdfParse(pdfBuffer);
  
  console.log(`[Pipeline] PDF has ${pdfData.numpages} pages, extracted ${pdfData.text.length} characters`);
  
  // Parse text into rows
  const rows = parseTextToRows(pdfData.text);
  console.log(`[Pipeline] Parsed ${rows.length} rows from PDF`);
  
  if (rows.length === 0) {
    throw new Error('No data could be extracted from PDF');
  }
  
  // Create Excel workbook
  const workbook = xlsx.utils.book_new();
  const worksheet = xlsx.utils.aoa_to_sheet(rows);
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  
  // Generate output path
  const baseName = path.basename(pdfPath, '.pdf');
  await fs.mkdir(outputDir, { recursive: true });
  const excelPath = path.join(outputDir, `${baseName}_converted.xlsx`);
  
  // Write Excel file
  xlsx.writeFile(workbook, excelPath);
  console.log(`[Pipeline] Created Excel file: ${excelPath}`);
  
  return excelPath;
}
const MAX_ROWS_PER_POST = 1000;
const ROWS_PER_PAGE = 10;

// Facebook URL to check in first 30 rows - if found, delete all rows from that row to row 1
// Must match FACEBOOK_URL_TO_CHECK in excel_to_png.py
const FACEBOOK_URL_TO_CHECK = "https://www.facebook.com/datakhachhangtiemnang1";

// Keywords that trigger complete cell content removal (case-insensitive)
// Must match KEYWORDS_TO_REMOVE_CELL in excel_to_png.py
const KEYWORDS_TO_REMOVE_CELL = [
  "trang vang",
  "trangvang",
  "scribd",
  "hsct",
  "hosocongty",
  "mst",
  "masothue",
  "data5s",
  "google.com/map"
];

/**
 * Check if cell content should be completely removed based on keywords.
 */
function shouldRemoveCellContent(value: any): boolean {
  if (value === null || value === undefined) return false;
  const text = String(value).toLowerCase();
  if (!text || text.trim() === '') return false;
  
  for (const keyword of KEYWORDS_TO_REMOVE_CELL) {
    if (text.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/**
 * Find the row index containing Facebook URL in first 30 rows.
 * Returns -1 if not found.
 */
function findFacebookUrlRow(sheet: xlsx.WorkSheet): number {
  if (!sheet['!ref']) return -1;
  
  const range = xlsx.utils.decode_range(sheet['!ref']);
  const maxRowsToCheck = Math.min(30, range.e.r + 1);
  
  for (let row = 0; row < maxRowsToCheck; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = xlsx.utils.encode_cell({ r: row, c: col });
      const cell = sheet[cellAddress];
      
      if (cell && cell.v !== undefined && cell.v !== null) {
        const cellValue = String(cell.v).toLowerCase();
        if (cellValue.includes(FACEBOOK_URL_TO_CHECK.toLowerCase())) {
          return row;
        }
      }
    }
  }
  return -1;
}

/**
 * Remove header rows from sheet up to and including the row with Facebook URL.
 * This matches the behavior in excel_to_png.py
 */
function removeHeaderRowsFromSheet(sheet: xlsx.WorkSheet, facebookRowIndex: number): xlsx.WorkSheet {
  // Convert sheet to array of arrays
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
  
  // Remove rows from 0 to facebookRowIndex (inclusive)
  const cleanedData = data.slice(facebookRowIndex + 1);
  
  // Create new sheet from cleaned data
  return xlsx.utils.aoa_to_sheet(cleanedData);
}

/**
 * Clean Excel file by:
 * 1. Removing header rows containing Facebook URL (matching excel_to_png.py behavior)
 * 2. Removing cell contents that contain restricted keywords
 * Creates a cleaned copy of the file and returns its path.
 */
async function createCleanedExcelFile(originalPath: string, outputDir: string): Promise<string> {
  console.log(`[Pipeline] Creating cleaned Excel file from: ${path.basename(originalPath)}`);
  
  const workbook = xlsx.readFile(originalPath);
  let cleanedCellCount = 0;
  let removedHeaderRows = 0;
  
  for (let i = 0; i < workbook.SheetNames.length; i++) {
    const sheetName = workbook.SheetNames[i];
    let sheet = workbook.Sheets[sheetName];
    if (!sheet['!ref']) continue;
    
    // Step 1: Remove header rows with Facebook URL (only for first sheet or all sheets with this URL)
    const facebookRowIndex = findFacebookUrlRow(sheet);
    if (facebookRowIndex >= 0) {
      const rowsToRemove = facebookRowIndex + 1;
      console.log(`[Pipeline] Found Facebook URL at row ${facebookRowIndex + 1} in sheet "${sheetName}", removing ${rowsToRemove} header rows`);
      sheet = removeHeaderRowsFromSheet(sheet, facebookRowIndex);
      workbook.Sheets[sheetName] = sheet;
      removedHeaderRows += rowsToRemove;
    }
    
    // Step 2: Remove cell contents with restricted keywords
    if (!sheet['!ref']) continue;
    const range = xlsx.utils.decode_range(sheet['!ref']);
    
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = xlsx.utils.encode_cell({ r: row, c: col });
        const cell = sheet[cellAddress];
        
        if (cell && cell.v !== undefined && cell.v !== null) {
          if (shouldRemoveCellContent(cell.v)) {
            // Clear the cell content
            cell.v = '';
            cell.w = '';
            if (cell.t) cell.t = 's'; // Set type to string
            cleanedCellCount++;
          }
        }
      }
    }
  }
  
  // Write cleaned file
  const ext = path.extname(originalPath);
  const baseName = path.basename(originalPath, ext);
  const cleanedPath = path.join(outputDir, `${baseName}_cleaned${ext}`);
  
  await fs.mkdir(outputDir, { recursive: true });
  xlsx.writeFile(workbook, cleanedPath);
  
  console.log(`[Pipeline] Cleaned Excel file created: removed ${removedHeaderRows} header rows and cleared ${cleanedCellCount} cells`);
  
  return cleanedPath;
}

export interface PipelineResult {
  success: boolean;
  fileName?: string;
  totalImages?: number;
  coverPhoto?: string;
  images?: Array<{
    type: "page";
    sheet: string;
    page: number;
    path: string;
    isBlurred?: boolean;
  }>;
  outputDir?: string;
  error?: string;
}

async function uploadAndCleanupOriginalFile(
  sourcePath: string, 
  postId: string, 
  originalFileName: string,
  outputDir?: string
): Promise<{ success: boolean; archiveUrl?: string; error?: string }> {
  const ext = path.extname(originalFileName);
  // File name uses only PostID (without original filename)
  const newFileName = `${postId}${ext}`;
  const remoteKey = `Original-Files/${newFileName}`;
  
  console.log(`[Pipeline] Creating cleaned file for archive: ${newFileName}`);
  
  // Create cleaned version of the file before uploading
  const cleanedDir = path.join(path.dirname(sourcePath), 'cleaned-temp');
  let fileToUpload = sourcePath;
  let cleanedFilePath: string | null = null;
  
  try {
    cleanedFilePath = await createCleanedExcelFile(sourcePath, cleanedDir);
    fileToUpload = cleanedFilePath;
    console.log(`[Pipeline] Using cleaned file for archive upload`);
  } catch (cleanErr) {
    console.warn(`[Pipeline] Failed to create cleaned file, uploading original:`, cleanErr);
  }
  
  const uploadResult = await uploadOriginalToArchive(fileToUpload, remoteKey);
  
  if (!uploadResult.success) {
    console.error(`[Pipeline] Failed to upload original to archive: ${uploadResult.error}`);
    return { success: false, error: uploadResult.error };
  }
  
  console.log(`[Pipeline] Cleaned file archived: ${uploadResult.url}`);
  
  // Cleanup: delete cleaned temp file and directory
  if (cleanedFilePath) {
    try {
      await fs.unlink(cleanedFilePath);
      await fs.rm(cleanedDir, { recursive: true, force: true });
      console.log(`[Pipeline] Deleted cleaned temp file and directory`);
    } catch (err) {
      console.warn(`[Pipeline] Failed to delete cleaned temp files:`, err);
    }
  }
  
  try {
    await fs.unlink(sourcePath);
    console.log(`[Pipeline] Deleted source file: ${sourcePath}`);
  } catch (err) {
    console.warn(`[Pipeline] Failed to delete source file: ${sourcePath}`, err);
  }
  
  if (outputDir) {
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
      console.log(`[Pipeline] Deleted temp output directory: ${outputDir}`);
    } catch (err) {
      console.warn(`[Pipeline] Failed to delete temp directory: ${outputDir}`, err);
    }
  }
  
  console.log(`[Pipeline] Cleanup completed - all local files removed`);
  
  return { success: true, archiveUrl: uploadResult.url };
}

interface ExcelInfo {
  totalRows: number;
  needsSplit: boolean;
  partCount: number;
}

function getExcelRowCount(filePath: string): ExcelInfo {
  try {
    const workbook = xlsx.readFile(filePath);
    let totalDataRows = 0;
    
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet['!ref']) continue;
      const range = xlsx.utils.decode_range(sheet['!ref']);
      const sheetRows = range.e.r - range.s.r + 1;
      const dataRows = Math.max(0, sheetRows - 1);
      totalDataRows += dataRows;
    }
    
    const needsSplit = totalDataRows > MAX_ROWS_PER_POST;
    const partCount = needsSplit ? Math.ceil(totalDataRows / MAX_ROWS_PER_POST) : 1;
    
    console.log(`[Pipeline] Excel has ${totalDataRows} total data rows (excluding headers), needsSplit: ${needsSplit}, parts: ${partCount}`);
    
    return { totalRows: totalDataRows, needsSplit, partCount };
  } catch (error) {
    console.error(`[Pipeline] Error reading Excel for row count:`, error);
    return { totalRows: 0, needsSplit: false, partCount: 1 };
  }
}

interface SheetData {
  sheetName: string;
  headers: any[];
  rows: any[][];
}

async function splitExcelFile(filePath: string, outputDir: string, maxRowsPerPart: number = MAX_ROWS_PER_POST): Promise<string[]> {
  try {
    const workbook = xlsx.readFile(filePath);
    const fileName = path.basename(filePath, path.extname(filePath));
    const ext = path.extname(filePath);
    const splitFiles: string[] = [];
    
    const allSheetData: SheetData[] = [];
    
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
      
      if (data.length < 2) continue;
      
      const headers = data[0];
      const dataRows = data.slice(1);
      
      if (dataRows.length > 0 && headers.length > 0) {
        allSheetData.push({
          sheetName,
          headers,
          rows: dataRows
        });
      }
    }
    
    if (allSheetData.length === 0) {
      return [filePath];
    }
    
    let currentPart: SheetData[] = [];
    let currentRowCount = 0;
    let partNumber = 1;
    
    for (const sheetData of allSheetData) {
      let remainingRows = [...sheetData.rows];
      
      while (remainingRows.length > 0) {
        const spaceInPart = maxRowsPerPart - currentRowCount;
        
        if (spaceInPart <= 0) {
          const partPath = await writePartFileMultiSheet(outputDir, fileName, ext, partNumber, currentPart);
          splitFiles.push(partPath);
          console.log(`[Pipeline] Created part ${partNumber} with ${currentRowCount} rows across ${currentPart.length} sheets`);
          
          currentPart = [];
          currentRowCount = 0;
          partNumber++;
          continue;
        }
        
        const rowsToAdd = remainingRows.slice(0, spaceInPart);
        remainingRows = remainingRows.slice(spaceInPart);
        
        const existingSheet = currentPart.find(s => s.sheetName === sheetData.sheetName);
        if (existingSheet) {
          existingSheet.rows.push(...rowsToAdd);
        } else {
          currentPart.push({
            sheetName: sheetData.sheetName,
            headers: sheetData.headers,
            rows: rowsToAdd
          });
        }
        currentRowCount += rowsToAdd.length;
      }
    }
    
    if (currentPart.length > 0 && currentRowCount > 0) {
      const partPath = await writePartFileMultiSheet(outputDir, fileName, ext, partNumber, currentPart);
      splitFiles.push(partPath);
      console.log(`[Pipeline] Created final part ${partNumber} with ${currentRowCount} rows across ${currentPart.length} sheets`);
    }
    
    return splitFiles;
  } catch (error) {
    console.error(`[Pipeline] Error splitting Excel file:`, error);
    throw error;
  }
}

async function writePartFileMultiSheet(outputDir: string, fileName: string, ext: string, partNumber: number, sheets: SheetData[]): Promise<string> {
  const partFileName = `${fileName}_part${partNumber}${ext}`;
  const partPath = path.join(outputDir, partFileName);
  
  const newWorkbook = xlsx.utils.book_new();
  
  for (const sheet of sheets) {
    const allData = [sheet.headers, ...sheet.rows];
    const newSheet = xlsx.utils.aoa_to_sheet(allData);
    xlsx.utils.book_append_sheet(newWorkbook, newSheet, sheet.sheetName);
  }
  
  xlsx.writeFile(newWorkbook, partPath);
  return partPath;
}

async function uploadImagesToSpaces(
  images: PipelineResult["images"],
  folderName: string,
  coverPhotoPath?: string
): Promise<{ imageUrls: Array<{ sheet: string; page: number; url: string; isBlurred: boolean }>; coverUrl: string | null }> {
  const imageUrls: Array<{ sheet: string; page: number; url: string; isBlurred: boolean }> = [];
  let coverUrl: string | null = null;
  
  if (!images || images.length === 0) {
    return { imageUrls, coverUrl };
  }
  
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const imgFileName = `${String(i + 1).padStart(3, '0')}_${img.sheet}_page${img.page}.png`;
    
    const result = await uploadToSpaces({
      localFilePath: img.path,
      remoteKey: `${folderName}/${imgFileName}`,
    });
    
    if (result.success && result.url) {
      imageUrls.push({
        sheet: img.sheet,
        page: img.page,
        url: result.url,
        isBlurred: img.isBlurred || false,
      });
      
      if (i === 0) {
        coverUrl = result.url;
      }
    } else {
      console.error(`[Pipeline] Failed to upload image: ${img.path}`, result.error);
    }
  }
  
  return { imageUrls, coverUrl };
}

export interface PipelineOptions {
  excelFilePath: string;
  outputDir: string;
  onProgress?: (message: string) => void;
}

export async function runExcelToPngPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const { excelFilePath, outputDir, onProgress } = options;
  
  const scriptPath = path.join(PIPELINE_DIR, "excel_to_png.py");
  const templatePath = path.join(PIPELINE_DIR, "template.html");
  
  console.log(`[Pipeline] Script path: ${scriptPath}`);
  console.log(`[Pipeline] Template path: ${templatePath}`);
  
  try {
    await fs.access(excelFilePath);
  } catch (error) {
    return {
      success: false,
      error: `Excel file not found: ${excelFilePath}`,
    };
  }
  
  await fs.mkdir(outputDir, { recursive: true });
  
  return new Promise((resolve) => {
    const pythonProcess = spawn("python3", [
      scriptPath,
      excelFilePath,
      outputDir,
      templatePath,
    ], {
      env: {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: path.join(process.cwd(), '.cache', 'ms-playwright'),
        LD_LIBRARY_PATH: `${process.env.LD_LIBRARY_PATH || ''}:/nix/store`,
      }
    });
    
    let stdout = "";
    let stderr = "";
    
    pythonProcess.stdout.on("data", (data) => {
      const message = data.toString();
      stdout += message;
      if (onProgress) {
        onProgress(message);
      }
    });
    
    pythonProcess.stderr.on("data", (data) => {
      const message = data.toString();
      stderr += message;
      if (onProgress) {
        onProgress(`[ERROR] ${message}`);
      }
    });
    
    pythonProcess.on("close", async (code) => {
      if (code !== 0) {
        resolve({
          success: false,
          error: `Pipeline failed with code ${code}: ${stderr}`,
        });
        return;
      }
      
      try {
        const stdoutJson = JSON.parse(stdout.trim());
        
        if (!stdoutJson.success || !stdoutJson.outputFile) {
          resolve({
            success: false,
            error: `Python script did not return output file path. Stdout: ${stdout}`,
          });
          return;
        }
        
        const resultData = await fs.readFile(stdoutJson.outputFile, 'utf-8');
        const result = JSON.parse(resultData);
        resolve(result);
      } catch (error) {
        resolve({
          success: false,
          error: `Failed to parse pipeline output. Error: ${error}. Stdout: ${stdout.substring(0, 200)}`,
        });
      }
    });
    
    pythonProcess.on("error", (error) => {
      resolve({
        success: false,
        error: `Failed to start pipeline: ${error.message}`,
      });
    });
  });
}

async function processSinglePart(
  partFilePath: string,
  outputDir: string,
  uploadId: string,
  storage: any,
  baseTitle: string,
  baseDescription: string,
  category: string,
  subcategory: string | null,
  partNumber: number,
  totalParts: number,
  originalFileName: string,
  parentPostId?: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  const partTitle = totalParts > 1 ? `[${partNumber}] - ${baseTitle}` : baseTitle;
  const partDesc = totalParts > 1 
    ? `${baseDescription} (Phần ${partNumber}/${totalParts})`
    : baseDescription;
  
  const partOutputDir = path.join(outputDir, `part${partNumber}`);
  
  const result = await runExcelToPngPipeline({
    excelFilePath: partFilePath,
    outputDir: partOutputDir,
    onProgress: (msg) => console.log(`[Pipeline ${uploadId} P${partNumber}]`, msg),
  });
  
  if (!result.success) {
    return { success: false, error: result.error };
  }
  
  console.log(`[Pipeline] Part ${partNumber}: Generated ${result.totalImages} images`);
  
  const pageCount = result.totalImages || 1;
  const document = await storage.createDocument({
    title: partTitle,
    description: partDesc,
    category,
    subcategory,
    pageCount,
    pointsCost: pageCount,
    coverImageUrl: '/placeholder-cover.png',
    imageUrls: [],
    originalFileName,
    parentPostId: parentPostId || null,
    postIndex: totalParts > 1 ? partNumber : null,
    totalParts: totalParts > 1 ? totalParts : null,
  });
  
  const postId = document.postId;
  console.log(`[Pipeline] Part ${partNumber}: Document created with postId: ${postId}`);
  
  const partFolderName = generateFolderName(postId, `${originalFileName}_part${partNumber}`);
  const { imageUrls, coverUrl } = await uploadImagesToSpaces(result.images, partFolderName, result.coverPhoto);
  
  console.log(`[Pipeline] Part ${partNumber}: Uploaded ${imageUrls.length} images to DO Spaces`);
  
  await storage.updateDocument(document.id, {
    coverImageUrl: coverUrl || '/placeholder-cover.png',
    imageUrls: imageUrls,
  });
  
  // Upload each split file to archive with format: PostID.xlsx (only PostID)
  // Create cleaned version before uploading to match image content
  const ext = path.extname(originalFileName);
  // File name uses only PostID (without original filename or part number)
  const archiveFileName = `${postId}${ext}`;
  
  // Create cleaned version of split file
  const cleanedDir = path.join(outputDir, `cleaned-temp-${partNumber}`);
  let fileToUpload = partFilePath;
  let cleanedFilePath: string | null = null;
  
  try {
    cleanedFilePath = await createCleanedExcelFile(partFilePath, cleanedDir);
    fileToUpload = cleanedFilePath;
    console.log(`[Pipeline] Part ${partNumber}: Using cleaned file for archive upload`);
  } catch (cleanErr) {
    console.warn(`[Pipeline] Part ${partNumber}: Failed to create cleaned file, uploading original:`, cleanErr);
  }
  
  let archiveSuccess = false;
  const archiveResult = await uploadOriginalToArchive(fileToUpload, `Original-Files/${archiveFileName}`);
  if (!archiveResult.success) {
    console.warn(`[Pipeline] Part ${partNumber}: Failed to archive split file, will retry...`);
    // Retry once
    const retryResult = await uploadOriginalToArchive(fileToUpload, `Original-Files/${archiveFileName}`);
    if (retryResult.success) {
      console.log(`[Pipeline] Part ${partNumber}: Archived cleaned split file as ${archiveFileName} (on retry)`);
      archiveSuccess = true;
    } else {
      console.error(`[Pipeline] Part ${partNumber}: Failed to archive split file after retry. File preserved at: ${partFilePath}`);
    }
  } else {
    console.log(`[Pipeline] Part ${partNumber}: Archived cleaned split file as ${archiveFileName}`);
    archiveSuccess = true;
  }
  
  // Cleanup cleaned temp file
  if (cleanedFilePath) {
    try {
      await fs.unlink(cleanedFilePath);
      await fs.rm(cleanedDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn(`[Pipeline] Part ${partNumber}: Failed to cleanup cleaned temp file:`, cleanupErr);
    }
  }
  
  // Cleanup temp output directory (always safe to clean)
  try {
    if (result.outputDir) {
      await fs.rm(result.outputDir, { recursive: true, force: true });
    }
    console.log(`[Pipeline] Part ${partNumber}: Cleaned up temp output dir`);
  } catch (cleanupErr) {
    console.warn(`[Pipeline] Part ${partNumber}: Failed to cleanup temp output dir:`, cleanupErr);
  }
  
  // Only delete split file if archive was successful (preserve for manual retry on failure)
  if (archiveSuccess) {
    try {
      await fs.unlink(partFilePath);
      console.log(`[Pipeline] Part ${partNumber}: Deleted split file after successful archive`);
    } catch (cleanupErr) {
      console.warn(`[Pipeline] Part ${partNumber}: Failed to delete split file:`, cleanupErr);
    }
  } else {
    console.log(`[Pipeline] Part ${partNumber}: Split file preserved for manual recovery: ${partFilePath}`);
  }
  
  console.log(`[Pipeline] Part ${partNumber}: Document completed: "${partTitle}" with ${imageUrls.length} images`);
  
  return { success: true, postId };
}

export async function processAdminUpload(uploadId: string, filePath: string, storage: any): Promise<void> {
  console.log(`[Pipeline] Starting processing for admin upload ${uploadId}`);
  
  const outputDir = path.join(process.cwd(), "uploads", "pipeline-output", uploadId);
  const splitDir = path.join(outputDir, "split-files");
  const originalFileName = path.basename(filePath);
  let workingFilePath = filePath;
  let convertedFromPdf = false;
  
  await storage.updatePipelineStatus(uploadId, "processing", new Date());
  
  try {
    // Check if file is PDF and convert to Excel first
    if (isPdfFile(filePath)) {
      console.log(`[Pipeline] Detected PDF file, converting to Excel first`);
      const pdfConvertDir = path.join(outputDir, "pdf-converted");
      workingFilePath = await convertPdfToExcel(filePath, pdfConvertDir);
      convertedFromPdf = true;
      console.log(`[Pipeline] PDF converted to Excel: ${workingFilePath}`);
    }
    
    const excelInfo = getExcelRowCount(workingFilePath);
    
    const uploadRecord = await storage.getAdminUploadById(uploadId);
    let baseTitle = path.basename(filePath, path.extname(filePath));
    let baseDescription = `Tài liệu được tạo từ admin upload`;
    let category = uploadRecord?.category || 'Khác';
    let subcategory = uploadRecord?.subcategory || null;
    
    if (uploadRecord?.aiStatus === 'completed' && uploadRecord.aiGeneratedTitle) {
      baseTitle = uploadRecord.aiGeneratedTitle;
      baseDescription = uploadRecord.aiGeneratedDescription || baseDescription;
      console.log(`[Pipeline] Using AI-generated metadata for document`);
    } else {
      console.log(`[Pipeline] No AI metadata available, using default values`);
    }
    
    console.log(`[Pipeline] Using admin-selected category: "${category}"`);
    
    if (excelInfo.needsSplit) {
      console.log(`[Pipeline] File has ${excelInfo.totalRows} rows, splitting into ${excelInfo.partCount} parts`);
      
      await fs.mkdir(splitDir, { recursive: true });
      const splitFiles = await splitExcelFile(workingFilePath, splitDir, MAX_ROWS_PER_POST);
      
      console.log(`[Pipeline] Created ${splitFiles.length} split files`);
      
      const createdPostIds: string[] = [];
      let parentPostId: string | undefined = undefined;
      
      for (let i = 0; i < splitFiles.length; i++) {
        const partResult = await processSinglePart(
          splitFiles[i],
          outputDir,
          uploadId,
          storage,
          baseTitle,
          baseDescription,
          category,
          subcategory,
          i + 1,
          splitFiles.length,
          originalFileName,
          parentPostId
        );
        
        if (!partResult.success) {
          throw new Error(`Part ${i + 1} failed: ${partResult.error}`);
        }
        
        if (partResult.postId) {
          createdPostIds.push(partResult.postId);
          if (i === 0) {
            parentPostId = partResult.postId;
          }
        }
      }
      
      // Check if any split files remain (failed archives preserved for manual recovery)
      try {
        const remainingFiles = await fs.readdir(splitDir);
        if (remainingFiles.length > 0) {
          console.log(`[Pipeline] ${remainingFiles.length} split files preserved in ${splitDir} for manual recovery`);
        } else {
          await fs.rm(splitDir, { recursive: true, force: true });
          console.log(`[Pipeline] Cleaned up empty split directory`);
        }
        // Delete the working file (converted Excel if PDF, or original if Excel)
        if (convertedFromPdf && workingFilePath !== filePath) {
          await fs.unlink(workingFilePath);
          console.log(`[Pipeline] Deleted converted Excel file`);
        }
        // Delete the original uploaded file
        await fs.unlink(filePath);
        console.log(`[Pipeline] Deleted original uploaded file`);
      } catch (cleanupErr) {
        console.warn(`[Pipeline] Failed to cleanup files:`, cleanupErr);
      }
      
      console.log(`[Pipeline] All ${splitFiles.length} parts completed. PostIds: ${createdPostIds.join(', ')}`);
      await storage.updatePipelineStatus(uploadId, "completed", undefined, new Date());
      
    } else {
      const result = await runExcelToPngPipeline({
        excelFilePath: workingFilePath,
        outputDir,
        onProgress: (msg) => console.log(`[Pipeline ${uploadId}]`, msg),
      });
      
      if (result.success) {
        console.log(`[Pipeline] Excel-to-PNG completed for upload ${uploadId}`);
        console.log(`[Pipeline] Generated ${result.totalImages} images`);
        
        const pageCount = result.totalImages || 1;
        const document = await storage.createDocument({
          title: baseTitle,
          description: baseDescription,
          category,
          subcategory,
          pageCount,
          pointsCost: pageCount,
          coverImageUrl: '/placeholder-cover.png',
          imageUrls: [],
          originalFileName,
        });
        
        const postId = document.postId;
        console.log(`[Pipeline] Document created with postId: ${postId}`);
        
        const folderName = generateFolderName(postId, originalFileName);
        console.log(`[Pipeline] Uploading images to DO Spaces folder: ${folderName}`);
        
        const { imageUrls, coverUrl } = await uploadImagesToSpaces(result.images, folderName, result.coverPhoto);
        
        console.log(`[Pipeline] Uploaded ${imageUrls.length} images to DO Spaces`);
        
        await storage.updateDocument(document.id, {
          coverImageUrl: coverUrl || '/placeholder-cover.png',
          imageUrls: imageUrls,
        });
        
        console.log(`[Pipeline] Document updated with DO Spaces URLs`);
        
        const archiveResult = await uploadAndCleanupOriginalFile(workingFilePath, postId, originalFileName, result.outputDir);
        if (!archiveResult.success) {
          console.warn(`[Pipeline] Failed to archive original file: ${archiveResult.error}`);
        }
        
        // If converted from PDF, also delete the original PDF file
        if (convertedFromPdf && filePath !== workingFilePath) {
          try {
            await fs.unlink(filePath);
            console.log(`[Pipeline] Deleted original PDF file after conversion`);
          } catch (err) {
            console.warn(`[Pipeline] Failed to delete original PDF:`, err);
          }
        }
        
        console.log(`[Pipeline] Document completed: "${baseTitle}" with ${imageUrls.length} images`);
        await storage.updatePipelineStatus(uploadId, "completed", undefined, new Date());
      } else {
        const errorMessage = result.error || "Unknown pipeline error";
        console.error(`[Pipeline] Excel-to-PNG failed for upload ${uploadId}:`, errorMessage);
        await storage.updatePipelineStatus(uploadId, "failed", undefined, new Date(), errorMessage);
      }
    }
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    console.error(`[Pipeline] Processing failed:`, errorMessage);
    await storage.updatePipelineStatus(uploadId, "failed", undefined, new Date(), errorMessage);
  }
}

export async function processUserUploadApproval(uploadId: string, filePath: string, storage: any): Promise<void> {
  console.log(`[Pipeline] Starting processing for approved user upload ${uploadId}`);
  
  const outputDir = path.join(process.cwd(), "uploads", "user-pipeline-output", uploadId);
  const splitDir = path.join(outputDir, "split-files");
  const originalFileName = path.basename(filePath);
  let workingFilePath = filePath;
  let convertedFromPdf = false;
  
  await storage.updateUserUploadPipelineStatus(uploadId, "processing", new Date());
  
  try {
    // Check if file is PDF and convert to Excel first
    if (isPdfFile(filePath)) {
      console.log(`[Pipeline] Detected PDF file, converting to Excel first`);
      const pdfConvertDir = path.join(outputDir, "pdf-converted");
      workingFilePath = await convertPdfToExcel(filePath, pdfConvertDir);
      convertedFromPdf = true;
      console.log(`[Pipeline] PDF converted to Excel: ${workingFilePath}`);
    }
    
    const excelInfo = getExcelRowCount(workingFilePath);
    
    const uploadRecord = await storage.getUserUploadById(uploadId);
    let baseTitle = path.basename(filePath, path.extname(filePath));
    let baseDescription = `Tài liệu được tạo từ upload của người dùng`;
    let category = uploadRecord?.approvedCategory || 'Khác';
    let subcategory = uploadRecord?.approvedSubcategory || null;
    
    if (uploadRecord?.aiStatus === 'completed' && uploadRecord.aiGeneratedTitle) {
      baseTitle = uploadRecord.aiGeneratedTitle;
      baseDescription = uploadRecord.aiGeneratedDescription || baseDescription;
      console.log(`[Pipeline] Using AI-generated metadata for document`);
    } else {
      console.log(`[Pipeline] No AI metadata available, using default values`);
    }
    
    console.log(`[Pipeline] Using admin-approved category: "${category}"`);
    
    if (excelInfo.needsSplit) {
      console.log(`[Pipeline] File has ${excelInfo.totalRows} rows, splitting into ${excelInfo.partCount} parts`);
      
      await fs.mkdir(splitDir, { recursive: true });
      const splitFiles = await splitExcelFile(workingFilePath, splitDir, MAX_ROWS_PER_POST);
      
      console.log(`[Pipeline] Created ${splitFiles.length} split files`);
      
      const createdPostIds: string[] = [];
      let parentPostId: string | undefined = undefined;
      
      for (let i = 0; i < splitFiles.length; i++) {
        const partResult = await processSinglePart(
          splitFiles[i],
          outputDir,
          uploadId,
          storage,
          baseTitle,
          baseDescription,
          category,
          subcategory,
          i + 1,
          splitFiles.length,
          originalFileName,
          parentPostId
        );
        
        if (!partResult.success) {
          throw new Error(`Part ${i + 1} failed: ${partResult.error}`);
        }
        
        if (partResult.postId) {
          createdPostIds.push(partResult.postId);
          if (i === 0) {
            parentPostId = partResult.postId;
          }
        }
      }
      
      try {
        await fs.rm(splitDir, { recursive: true, force: true });
        // Delete the working file (converted Excel if PDF, or original if Excel)
        if (workingFilePath !== filePath) {
          await fs.unlink(workingFilePath);
          console.log(`[Pipeline] Deleted converted Excel file`);
        }
        // Also delete the original uploaded file after all parts are archived
        await fs.unlink(filePath);
        console.log(`[Pipeline] Cleaned up split directory and original file`);
      } catch (cleanupErr) {
        console.warn(`[Pipeline] Failed to cleanup files:`, cleanupErr);
      }
      
      console.log(`[Pipeline] All ${splitFiles.length} parts completed. PostIds: ${createdPostIds.join(', ')}`);
      await storage.updateUserUploadPipelineStatus(uploadId, "completed", undefined, new Date());
      
    } else {
      const result = await runExcelToPngPipeline({
        excelFilePath: workingFilePath,
        outputDir,
        onProgress: (msg) => console.log(`[Pipeline ${uploadId}]`, msg),
      });
      
      if (result.success) {
        console.log(`[Pipeline] Excel-to-PNG completed for user upload ${uploadId}`);
        console.log(`[Pipeline] Generated ${result.totalImages} images`);
        
        const pageCount = result.totalImages || 1;
        const document = await storage.createDocument({
          title: baseTitle,
          description: baseDescription,
          category,
          subcategory,
          pageCount,
          pointsCost: pageCount,
          coverImageUrl: '/placeholder-cover.png',
          imageUrls: [],
          originalFileName,
        });
        
        const postId = document.postId;
        console.log(`[Pipeline] Document created with postId: ${postId}`);
        
        const folderName = generateFolderName(postId, originalFileName);
        console.log(`[Pipeline] Uploading images to DO Spaces folder: ${folderName}`);
        
        const { imageUrls, coverUrl } = await uploadImagesToSpaces(result.images, folderName, result.coverPhoto);
        
        console.log(`[Pipeline] Uploaded ${imageUrls.length} images to DO Spaces`);
        
        await storage.updateDocument(document.id, {
          coverImageUrl: coverUrl || '/placeholder-cover.png',
          imageUrls: imageUrls,
        });
        
        console.log(`[Pipeline] Document updated with DO Spaces URLs`);
        
        const archiveResult = await uploadAndCleanupOriginalFile(workingFilePath, postId, originalFileName, result.outputDir);
        if (!archiveResult.success) {
          console.warn(`[Pipeline] Failed to archive original file: ${archiveResult.error}`);
        }
        
        // If converted from PDF, also delete the original PDF file
        if (convertedFromPdf && filePath !== workingFilePath) {
          try {
            await fs.unlink(filePath);
            console.log(`[Pipeline] Deleted original PDF file after conversion`);
          } catch (err) {
            console.warn(`[Pipeline] Failed to delete original PDF:`, err);
          }
        }
        
        console.log(`[Pipeline] Document completed: "${baseTitle}" with ${imageUrls.length} images`);
        await storage.updateUserUploadPipelineStatus(uploadId, "completed", undefined, new Date());
      } else {
        const errorMessage = result.error || "Unknown pipeline error";
        console.error(`[Pipeline] Excel-to-PNG failed for user upload ${uploadId}:`, errorMessage);
        await storage.updateUserUploadPipelineStatus(uploadId, "failed", undefined, new Date());
      }
    }
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    console.error(`[Pipeline] Processing failed:`, errorMessage);
    await storage.updateUserUploadPipelineStatus(uploadId, "failed", undefined, new Date());
  }
}

