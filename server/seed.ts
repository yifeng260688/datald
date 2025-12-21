import { db } from "./db";
import { documents } from "@shared/schema";

const sampleDocuments = [
  {
    title: "Báo cáo Tài chính Doanh nghiệp Q4 2024",
    description: "Phân tích chi tiết về tình hình tài chính doanh nghiệp trong quý 4 năm 2024. Bao gồm báo cáo thu chi, lợi nhuận, và dự báo cho năm tiếp theo.",
    category: "Tài chính",
    pageCount: 45,
    coverImageUrl: "/attached_assets/generated_images/Financial_document_cover_navy_6a14393a.png",
    imageUrls: null,
  },
  {
    title: "Chiến lược Marketing Số 2025",
    description: "Hướng dẫn toàn diện về các chiến lược marketing số hiện đại, bao gồm SEO, social media, content marketing và email campaigns.",
    category: "Marketing",
    pageCount: 67,
    coverImageUrl: "/attached_assets/generated_images/Business_document_cover_blue_a6330d07.png",
    imageUrls: null,
  },
  {
    title: "Kỹ thuật Lập trình Web Hiện đại",
    description: "Khóa học về lập trình web với React, Node.js, và TypeScript. Từ cơ bản đến nâng cao với các ví dụ thực tế và best practices.",
    category: "Công nghệ",
    pageCount: 120,
    coverImageUrl: "/attached_assets/generated_images/Technology_document_cover_green_3f0ac92b.png",
    imageUrls: null,
  },
  {
    title: "Phương pháp Giảng dạy Hiệu quả",
    description: "Tài liệu hướng dẫn các phương pháp giảng dạy hiệu quả cho giáo viên, bao gồm kỹ thuật tương tác, đánh giá học sinh và quản lý lớp học.",
    category: "Giáo dục",
    pageCount: 88,
    coverImageUrl: "/attached_assets/generated_images/Education_document_cover_orange_62237e7d.png",
    imageUrls: null,
  },
  {
    title: "Quản trị Dự án Agile & Scrum",
    description: "Hướng dẫn chi tiết về phương pháp quản trị dự án Agile và Scrum framework. Phù hợp cho project managers và team leaders.",
    category: "Quản lý",
    pageCount: 95,
    coverImageUrl: "/attached_assets/generated_images/Business_document_cover_blue_a6330d07.png",
    imageUrls: null,
  },
  {
    title: "Phân tích Dữ liệu với Python",
    description: "Khóa học toàn diện về phân tích dữ liệu sử dụng Python, Pandas, NumPy và Matplotlib. Bao gồm machine learning cơ bản.",
    category: "Công nghệ",
    pageCount: 156,
    coverImageUrl: "/attached_assets/generated_images/Technology_document_cover_green_3f0ac92b.png",
    imageUrls: null,
  },
  {
    title: "Kế hoạch Kinh doanh Startup",
    description: "Template và hướng dẫn chi tiết để xây dựng business plan cho startup. Bao gồm market research, financial projections và pitch deck.",
    category: "Kinh doanh",
    pageCount: 72,
    coverImageUrl: "/attached_assets/generated_images/Financial_document_cover_navy_6a14393a.png",
    imageUrls: null,
  },
  {
    title: "Thiết kế UI/UX Chuyên nghiệp",
    description: "Nguyên tắc và thực hành thiết kế UI/UX hiện đại. Bao gồm user research, wireframing, prototyping và usability testing.",
    category: "Thiết kế",
    pageCount: 134,
    coverImageUrl: "/attached_assets/generated_images/Education_document_cover_orange_62237e7d.png",
    imageUrls: null,
  },
  {
    title: "Kỹ năng Giao tiếp Hiệu quả",
    description: "Phát triển kỹ năng giao tiếp trong công việc và cuộc sống. Bao gồm presentation skills, negotiation và conflict resolution.",
    category: "Kỹ năng mềm",
    pageCount: 58,
    coverImageUrl: "/attached_assets/generated_images/Business_document_cover_blue_a6330d07.png",
    imageUrls: null,
  },
  {
    title: "Đầu tư Chứng khoán Cơ bản",
    description: "Hướng dẫn từ A-Z về đầu tư chứng khoán cho người mới bắt đầu. Bao gồm phân tích cơ bản, phân tích kỹ thuật và quản lý rủi ro.",
    category: "Tài chính",
    pageCount: 103,
    coverImageUrl: "/attached_assets/generated_images/Financial_document_cover_navy_6a14393a.png",
    imageUrls: null,
  },
  {
    title: "Cloud Computing với AWS",
    description: "Khóa học về Amazon Web Services, bao gồm EC2, S3, RDS, Lambda và các dịch vụ cloud computing phổ biến khác.",
    category: "Công nghệ",
    pageCount: 178,
    coverImageUrl: "/attached_assets/generated_images/Technology_document_cover_green_3f0ac92b.png",
    imageUrls: null,
  },
  {
    title: "Tâm lý học Tổ chức",
    description: "Nghiên cứu về hành vi con người trong môi trường tổ chức. Bao gồm motivation, leadership và organizational culture.",
    category: "Giáo dục",
    pageCount: 91,
    coverImageUrl: "/attached_assets/generated_images/Education_document_cover_orange_62237e7d.png",
    imageUrls: null,
  },
];

async function seed() {
  try {
    console.log("Starting database seed...");
    
    // Insert sample documents
    for (const doc of sampleDocuments) {
      await db.insert(documents).values(doc);
      console.log(`Inserted: ${doc.title}`);
    }
    
    console.log("Database seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
}

seed();
