import { extractTextFromFile } from "../services/textExtractor";
import fs from "fs/promises";
import path from "path";

async function createTestCSV() {
  const testDir = path.join(process.cwd(), "test-files");
  await fs.mkdir(testDir, { recursive: true });
  
  const csvContent = `Name,Age,City,Occupation
Nguyễn Văn A,25,Hà Nội,Kỹ sư phần mềm
Trần Thị B,30,TP. Hồ Chí Minh,Giáo viên
Lê Văn C,28,Đà Nẵng,Bác sĩ
Phạm Thị D,35,Hải Phòng,Luật sư`;
  
  const csvPath = path.join(testDir, "test.csv");
  await fs.writeFile(csvPath, csvContent, 'utf-8');
  
  return csvPath;
}

async function main() {
  console.log("🧪 Testing Text Extraction Service...\n");

  // Test 1: CSV extraction
  console.log("📝 Test 1: CSV Extraction");
  const csvPath = await createTestCSV();
  const csvResult = await extractTextFromFile(csvPath, "text/csv");
  
  if (csvResult.success) {
    console.log("✅ CSV extraction successful!");
    console.log("Extracted text length:", csvResult.text?.length);
    console.log("Row count:", csvResult.metadata?.rowCount);
    console.log("\nFirst 200 characters:");
    console.log(csvResult.text?.substring(0, 200));
  } else {
    console.log("❌ CSV extraction failed:", csvResult.error);
  }

  console.log("\n" + "=".repeat(60) + "\n");

  // Test 2: Unsupported format
  console.log("📝 Test 2: Unsupported File Type");
  const unsupportedResult = await extractTextFromFile("/tmp/test.txt", "text/plain");
  
  if (!unsupportedResult.success) {
    console.log("✅ Correctly rejected unsupported file type");
    console.log("Error:", unsupportedResult.error);
  } else {
    console.log("❌ Should have rejected unsupported file type");
  }

  console.log("\n✅ Text extraction tests completed!\n");
  
  // Cleanup
  await fs.rm(path.join(process.cwd(), "test-files"), { recursive: true, force: true });
}

main().catch(console.error);
