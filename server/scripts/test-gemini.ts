import { testGeminiConnection, generateMetadataFromText } from "../services/gemini";

async function main() {
  console.log("🧪 Testing Gemini AI Service...\n");

  // Test 1: Connection test
  console.log("📝 Test 1: Connection Test");
  const connectionOk = await testGeminiConnection();
  
  if (!connectionOk) {
    console.error("\n❌ Connection test failed. Stopping tests.");
    process.exit(1);
  }

  console.log("\n" + "=".repeat(60) + "\n");

  // Test 2: Vietnamese document
  console.log("📝 Test 2: Vietnamese Document");
  const vietnameseTest = await generateMetadataFromText(
    `Hướng dẫn sử dụng Microsoft Excel cho người mới bắt đầu
    
    Microsoft Excel là phần mềm bảng tính mạnh mẽ được sử dụng rộng rãi trong các doanh nghiệp. 
    Tài liệu này hướng dẫn các chức năng cơ bản như:
    - Tạo và định dạng bảng tính
    - Sử dụng công thức và hàm
    - Tạo biểu đồ và đồ thị
    - Phân tích dữ liệu với Pivot Table
    
    Phù hợp cho người mới học Excel từ cơ bản đến nâng cao.`,
    "Excel"
  );

  if (vietnameseTest.success) {
    console.log("✅ Success!");
    console.log("Title:", vietnameseTest.metadata?.title);
    console.log("Description:", vietnameseTest.metadata?.description);
    console.log("Category:", vietnameseTest.metadata?.category);
  } else {
    console.log("❌ Failed:", vietnameseTest.error);
  }

  console.log("\n" + "=".repeat(60) + "\n");

  // Test 3: Business document
  console.log("📝 Test 3: Business Document");
  const businessTest = await generateMetadataFromText(
    `Báo cáo tài chính quý 4 năm 2024
    
    Tổng quan:
    - Doanh thu: 150 tỷ VNĐ (tăng 25% so với cùng kỳ)
    - Lợi nhuận sau thuế: 30 tỷ VNĐ
    - Tổng tài sản: 500 tỷ VNĐ
    
    Phân tích:
    Công ty đã có sự tăng trưởng ấn tượng nhờ vào chiến lược mở rộng thị trường 
    và cải thiện hiệu quả hoạt động. Các chỉ số tài chính đều đạt mục tiêu đề ra.`,
    "PDF"
  );

  if (businessTest.success) {
    console.log("✅ Success!");
    console.log("Title:", businessTest.metadata?.title);
    console.log("Description:", businessTest.metadata?.description);
    console.log("Category:", businessTest.metadata?.category);
  } else {
    console.log("❌ Failed:", businessTest.error);
  }

  console.log("\n✅ All tests completed!\n");
}

main().catch(console.error);
