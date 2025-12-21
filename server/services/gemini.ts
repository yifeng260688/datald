import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI | null {
  if (genAI) return genAI;
  
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  
  if (!GOOGLE_API_KEY) {
    console.warn("⚠️  GOOGLE_API_KEY not found. AI metadata generation will be disabled.");
    return null;
  }
  
  genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
  return genAI;
}

export interface GeneratedMetadata {
  title: string;
  description: string;
}

export interface AIGenerationResult {
  success: boolean;
  metadata?: GeneratedMetadata;
  error?: string;
}

/**
 * Build system prompt with category context for better SEO optimization
 */
function buildSystemPrompt(category?: string): string {
  const categoryContext = category 
    ? `\n\nDANH MỤC DỮ LIỆU: "${category}"
Đây là dữ liệu khách hàng thuộc lĩnh vực "${category}". Hãy tạo tiêu đề và mô tả phù hợp với đặc thù của ngành ${category}, sử dụng các từ khóa SEO liên quan đến lĩnh vực này.

Gợi ý từ khóa theo danh mục:
- Casino: data casino, danh sách khách VIP casino, dữ liệu cược, người chơi casino
- Doanh Nghiệp: data doanh nghiệp, danh sách công ty, thông tin doanh nghiệp, CEO, giám đốc
- Bất Động Sản: data bất động sản, khách hàng mua nhà, nhà đầu tư BĐS, môi giới
- Ngân Hàng: data ngân hàng, khách hàng vay, tín dụng, thẻ ngân hàng
- Bảo Hiểm: data bảo hiểm, khách hàng bảo hiểm, hợp đồng bảo hiểm
- Email: danh sách email, email marketing, data email khách hàng
- Khác: data khách hàng, danh sách khách hàng, thông tin liên hệ`
    : '';

  return `Bạn là một chuyên gia phân tích tài liệu tiếng Việt và SEO chuyên về dữ liệu khách hàng. Nhiệm vụ của bạn là đọc nội dung tài liệu và tạo tiêu đề, mô tả chuẩn SEO cho thư viện tài liệu data khách hàng.${categoryContext}

Hãy trả về JSON với format sau (CHÍNH XÁC, không thêm markdown hoặc text khác):
{
  "title": "Tiêu đề ngắn gọn, có kèm từ khóa SEO (tối đa 100 ký tự)",
  "description": "Mô tả chi tiết nội dung tài liệu, có kèm từ khóa SEO (200-300 ký tự)"
}

Lưu ý:
- Title: Ngắn gọn, thu hút, bao gồm từ khóa "data" hoặc "dữ liệu" + lĩnh vực cụ thể, phản ánh chính xác nội dung
- Description: Mô tả rõ ràng về loại data, số lượng (nếu có), chất lượng dữ liệu, và lợi ích khi sử dụng
- Sử dụng ngôn ngữ chuyên nghiệp, hướng đến khách hàng B2B
- QUAN TRỌNG: KHÔNG ĐƯỢC tiết lộ nguồn dữ liệu trong Tiêu đề và Mô tả (ví dụ: không đề cập tên công ty, tổ chức, website, ứng dụng nơi dữ liệu được thu thập)
- QUAN TRỌNG: KHÔNG ĐƯỢC tiết lộ dữ liệu được lấy từ đâu trong Tiêu đề và Mô tả (ví dụ: không nói "lấy từ Facebook", "thu thập từ Zalo", "từ website X")
- QUAN TRỌNG: KHÔNG ĐƯỢC sử dụng các từ ngữ liên quan đến việc mua bán, cung cấp dữ liệu khách hàng (ví dụ: không dùng "mua data", "bán data", "cung cấp dữ liệu", "mua dữ liệu khách hàng", "bán thông tin", "kinh doanh data")
- Trả về CHÍNH XÁC format JSON, không thêm markdown hoặc giải thích`;
}

/**
 * Extract text preview from content (first 4000 characters)
 * This ensures we don't exceed Gemini's context limits
 */
function extractTextPreview(content: string): string {
  const MAX_CHARS = 4000;
  if (content.length <= MAX_CHARS) {
    return content;
  }
  return content.substring(0, MAX_CHARS) + "\n\n[... nội dung còn lại đã được cắt bớt để phân tích ...]";
}

/**
 * Retry function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on certain errors
      if (error.message?.includes("API key") || error.message?.includes("quota")) {
        throw error;
      }
      
      // If not last attempt, wait and retry
      if (attempt < maxRetries - 1) {
        const delay = initialDelayMs * Math.pow(2, attempt);
        console.log(`⏳ Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Generate metadata from document text content using Gemini AI
 * @param content - Text content extracted from the document
 * @param fileType - Type of file (PDF, Excel, CSV) for context
 * @param category - Category of the document for better SEO optimization
 * @returns AIGenerationResult with metadata or error
 */
export async function generateMetadataFromText(
  content: string,
  fileType: string = "document",
  category?: string
): Promise<AIGenerationResult> {
  const ai = getGenAI();
  if (!ai) {
    return {
      success: false,
      error: "Google API key not configured. AI metadata generation is disabled.",
    };
  }

  try {
    console.log(`🤖 Starting AI metadata generation for ${fileType}${category ? ` (category: ${category})` : ''}...`);
    
    // Validate input
    if (!content || content.trim().length === 0) {
      return {
        success: false,
        error: "Content is empty. Cannot generate metadata from empty content.",
      };
    }

    // Extract preview to avoid context limits
    const textPreview = extractTextPreview(content);
    
    // Build system prompt with category context
    const systemPrompt = buildSystemPrompt(category);
    
    // Create user prompt with category hint
    const categoryHint = category ? ` thuộc danh mục "${category}"` : '';
    const userPrompt = `Phân tích tài liệu ${fileType}${categoryHint} sau và tạo metadata SEO:\n\n${textPreview}`;

    // Call Gemini API with retry
    const model = ai.getGenerativeModel({ model: "gemini-2.5-pro" });
    
    const result = await retryWithBackoff(async () => {
      const response = await model.generateContent([
        { text: systemPrompt },
        { text: userPrompt }
      ]);
      return response.response;
    });

    const responseText = result.text();
    console.log("📝 Gemini response:", responseText);

    // Parse JSON response
    let metadata: GeneratedMetadata;
    try {
      // Remove markdown code blocks if present
      const cleanedText = responseText
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      
      metadata = JSON.parse(cleanedText);
    } catch (parseError: any) {
      console.error("❌ JSON parse error:", parseError.message);
      return {
        success: false,
        error: `Failed to parse AI response as JSON: ${parseError.message}`,
      };
    }

    // Validate metadata structure
    if (!metadata.title || !metadata.description) {
      return {
        success: false,
        error: "AI response missing required fields (title or description)",
      };
    }

    // Truncate if needed
    metadata.title = metadata.title.substring(0, 200);
    metadata.description = metadata.description.substring(0, 500);

    console.log("✅ AI metadata generated successfully:", metadata);

    return {
      success: true,
      metadata,
    };

  } catch (error: any) {
    console.error("❌ Gemini AI error:", error);
    
    // Provide user-friendly error messages
    let errorMessage = "Failed to generate metadata using AI";
    if (error.message) {
      if (error.message.includes("API key")) {
        errorMessage = "Invalid Google API key";
      } else if (error.message.includes("quota")) {
        errorMessage = "API quota exceeded. Please try again later.";
      } else if (error.message.includes("timeout")) {
        errorMessage = "AI request timed out. Please try again.";
      } else {
        errorMessage = `AI error: ${error.message}`;
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Test function to verify Gemini API connection
 */
export async function testGeminiConnection(): Promise<boolean> {
  const ai = getGenAI();
  if (!ai) {
    console.error("❌ Google API key not configured");
    return false;
  }

  try {
    const testResult = await generateMetadataFromText(
      "Đây là một tài liệu test về công nghệ thông tin và lập trình.",
      "PDF"
    );
    
    if (testResult.success) {
      console.log("✅ Gemini AI connection test successful!");
      return true;
    } else {
      console.error("❌ Gemini AI test failed:", testResult.error);
      return false;
    }
  } catch (error: any) {
    console.error("❌ Gemini AI connection test error:", error.message);
    return false;
  }
}
