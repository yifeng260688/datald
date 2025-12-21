# Customer Data Document Library Platform

## Overview
This platform is a Vietnamese-language document library specializing in customer data ("Data khách hàng"). It allows users to browse, search, favorite, and view documents with associated image galleries generated from Excel files. The project features automated Excel-to-PNG conversion with watermarks and data masking, dynamic category management, and real-time chat support.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework & Build System**: React 18 with TypeScript, Vite, Wouter for routing, TanStack Query for server state.
- **UI Component System**: Shadcn/ui (Radix UI), Tailwind CSS (New York style, neutral palette), Inter font.
- **State Management**: React Query for server state (aggressive caching), React hooks for local UI state.
- **Image Gallery**: Custom ImageGallery component with navigation, thumbnails, and lightbox zoom functionality.

### Backend Architecture
- **Server Framework**: Express.js with TypeScript and Node.js (ESM).
- **API Design**: RESTful endpoints, middleware for logging and error handling, JSON format.
- **Data Access Layer**: `IStorage` interface abstraction, implemented with MongoDB Atlas and Mongoose ODM.
- **Image Pipeline**: Excel → PNG (Python with watermarks/masking) → Document with image URLs array.

### Database Architecture
- **Database**: MongoDB Atlas Cluster (datald.h332t8m.mongodb.net).
- **Collections**: `users`, `documents`, `favorites`, `tags`, `documenttags`, `useruploads`, `adminuploads`, `sessions`, `categories`.
- **Document Schema**: Documents use `imageUrls` array (stored as JSON string) instead of video URLs.
- **AI Metadata Fields**: `aiStatus`, `aiGeneratedTitle`, `aiGeneratedDescription`, `aiGeneratedAt`, `aiError` for uploads.
- **Category System**: Documents store category names (strings) validated against centralized category list. 7 default categories auto-seeded: Casino, Doanh Nghiệp, Bất Động Sản, Ngân Hàng, Bảo Hiểm, Email, Khác.
- **Query Patterns**: Mongoose populate, atomic updates (`$inc`), compound indexes, category-based filtering, delete protection.

### Authentication & Authorization
- **Authentication**: Replit Auth via OIDC (Passport.js), session-based state management (connect-mongo).
- **Security**: HTTP-only secure cookies, session secret, CSRF protection, 401 error handling.
- **Points Legitimacy Whitelist**: Only super admin (yifeng260688@gmail.com) can award legitimate points. All awards are tracked in LegitimatePoints collection.
- **Auto-Block System**: Users with more points than their whitelist allowance are automatically blocked when attempting to redeem. Blocked users cannot access protected content.

### Admin Panel Features
- **System Logs Dashboard**: Track points awards (member ID, points received, reason) and document redemptions (member ID, document ID, points deducted) via dedicated logs page. Uses PointsAuditLog and RedemptionLog collections.
- **Bulk Upload System**: Admin-only, up to 10 files, 500MB limit per file, supports PDF, CSV, XLSX, real-time progress, pipeline status tracking, manual category selection.
- **User Upload Approval Workflow**: Review and approve/reject user submissions (max 10 per user, 10MB limit), three-state approval, mandatory category selection during approval. Admin can view Excel files as HTML in new tab or download any file type.
- **Upload Requirements System**: Category-specific data requirements shown in user upload dialog:
  - Casino: requires 3 of 6 fields (phone, name, username, email, game site, account number)
  - Doanh Nghiệp: requires 4 of 7 fields (phone, name, company, address, tax code, email, website)
  - Other categories: requires 3 of 7 fields (phone, name, address, gender, DOB, email)
  - Warning: accounts blocked after 2 invalid uploads.
- **Excel-to-PNG Pipeline**: Automated conversion using Python (Pandas, Jinja2, Playwright, Pillow) with:
  - Watermark grid (5x3 pattern)
  - Data masking for sensitive information
  - Data leakage detection with auto-retry
  - Cover photo generation
- **Category Management System**: Admin can create/delete categories with logo upload capability (2MB limit). Delete protection prevents removal if documents reference it. Supports subcategories with expandable category rows.
- **Subcategory System**: Each category can have multiple subcategories. Admin can create/edit/delete subcategories via the Categories management page. Subcategories stored in separate collection with compound unique index on (categoryId, name).
- **User Points Check Page**: Admin page to view all users with points >= 1, with filtering and search capabilities.
- **Document Gallery Controls**: Zoom in/out buttons in DocumentDetail page for image viewing.
- **Notification System**: Admin can send notifications to all users or individual users. Users see notification bell icon with unread count in header. Notifications tracked per-user with read status.

### Image Pipeline Details
- **Script Location**: `server/pipeline/excel_to_png.py`
- **Output Format**: PNG images with watermarks uploaded to Digital Ocean Spaces
- **Cover Image**: First page/sheet used as `coverImageUrl`
- **Image Structure**: Each image has `{sheet, page, url, isBlurred}` properties
- **Blur Protection**: Images after first 10 are blurred (COVER_BLUR_RADIUS = 8, FREE_PREVIEW_IMAGES = 10)
- **Original Files**: Saved to `Original-Files/` folder with PostID prefix (e.g., `1234567890-filename.xlsx`)
- **Large File Splitting**: Files with >5000 data rows automatically split into multiple posts (max 500 pages/5000 rows per post) with P1-, P2-, P3- prefixes added to titles
- **PDF Support**: PDF files are automatically converted to Excel before pipeline processing using pdf-parse library. Text is extracted and parsed into tabular format.

### Digital Ocean Spaces Integration
- **Bucket**: data-ld1
- **Region**: sgp1 (Singapore)
- **CDN URL**: https://data-ld1.sgp1.cdn.digitaloceanspaces.com (NEVER exposed to frontend)
- **Folder Naming**: `PostID-OriginalFileName/` (e.g., `1234567890-CustomerData/`)
- **Image Naming**: `001_SheetName_page1.png`, `002_SheetName_page2.png`, etc.
- **Service Location**: `server/services/doSpaces.ts`
- **Environment Variables**: `DO_ACCESS_KEY`, `DO_SECRET_KEY`

### Storage URL Security (Critical)
- **Proxy Endpoints**: All DO Spaces URLs are hidden from frontend via proxy endpoints:
  - `/api/documents/:id/cover` - Streams cover images
  - `/api/documents/:id/images/:index` - Streams gallery images  
  - `/api/user/redeemed-files/:id/download` - Streams redeemed original files
- **API Response Mapping**: `convertToProxyUrls()` in mongo-storage.ts rewrites all DO CDN URLs to proxy paths before sending to frontend
- **Internal Methods**: `getDocumentByIdRaw()` returns raw DO URLs for server-side use only
- **Original Files Protection**: `getUserRedeemedFiles()` does NOT return `filePath` - only metadata. Download uses proxy endpoint
- **Security Guarantee**: No DO Spaces URLs ever appear in browser devtools, network tab, or source code

## External Dependencies

### Third-Party Services
- **Replit Auth**: OIDC identity provider.
- **MongoDB Atlas**: Cloud-hosted MongoDB database cluster.
- **Google Gemini AI**: `gemini-flash-lite-latest` model for automatic metadata generation with category-aware SEO optimization.

### AI Metadata Generation
- **Model**: Google Gemini Flash Lite
- **Category-Aware Prompts**: AI receives category context (Casino, Doanh Nghiệp, Bất Động Sản, Ngân Hàng, Bảo Hiểm, Email, Khác) to generate more relevant SEO titles and descriptions
- **SEO Keywords**: Category-specific keyword suggestions (e.g., "data casino", "khách VIP", "dữ liệu doanh nghiệp") help AI create optimized content
- **Output**: Vietnamese SEO-optimized title (max 100 chars) and description (200-300 chars)
- **Service Location**: `server/services/gemini.ts`, `server/services/aiProcessor.ts`

### Media & Content
- PNG images with watermarks (generated from Excel files).
- Cover images (first page of document or static assets).

### Build & Development Tools
- **Mongoose**: MongoDB object modeling.
- **pdf-parse**: PDF text extraction.
- **xlsx**: Excel file parsing.
- **csv-parse**: CSV file parsing.
- **ESBuild**: Server-side bundling (production).
- **TSX**: TypeScript execution (development).
- **PostCSS with Autoprefixer**: CSS processing.
- **Python Libraries**: Pandas, Jinja2, Playwright, Pillow for Excel-to-PNG pipeline.

## Key File Locations
- **Image Pipeline**: `server/pipeline/runner.ts`, `server/pipeline/excel_to_png.py`
- **Document Model**: `server/models/index.ts` (DocumentModel with imageUrls array)
- **Storage Layer**: `server/mongo-storage.ts` (handles imageUrls serialization)
- **Frontend Gallery**: `client/src/pages/DocumentDetail.tsx` (ImageGallery component)
- **Schema**: `shared/schema.ts` (documents table with imageUrls text field)
