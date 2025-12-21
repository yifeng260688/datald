# Design Guidelines: DRM Video Document Library Platform

## Design Approach

**Selected Approach:** Design System (Material Design inspired) + Platform References (YouTube, Udemy, Notion)

**Justification:** This is a utility-focused document library requiring efficient browsing, search, and video consumption. The interface prioritizes discoverability, quick scanning of content, and seamless video playback. Drawing from Material Design's structured approach while referencing successful content platforms ensures familiarity and optimal user experience.

**Core Principles:**
- Content-First: Cards and video player take visual priority
- Efficient Navigation: Clear search and filtering mechanisms
- Trust & Credibility: Professional presentation builds confidence in content
- Scannable Hierarchy: Users can quickly assess document relevance

---

## Typography

**Font Families:**
- Primary: Inter (clean, excellent Vietnamese diacritics support)
- Secondary: System UI fallback for performance

**Hierarchy:**
- Hero/Page Titles: text-4xl to text-5xl, font-bold
- Card Titles: text-xl, font-semibold
- Video Title (Detail Page): text-3xl, font-bold
- Body/Descriptions: text-base, font-normal, line-height relaxed
- Metadata (category, pages): text-sm, font-medium
- Search Input: text-base

---

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, 12, 16, 20 consistently
- Component padding: p-4 to p-6
- Section spacing: py-12 to py-20
- Card gaps: gap-6 to gap-8
- Video player margins: mx-auto with max-width constraints

**Grid System:**
- Homepage Cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
- Container: max-w-7xl mx-auto px-4 to px-8
- Detail Page: max-w-6xl mx-auto for video + info
- Related Documents: grid-cols-1 md:grid-cols-2 lg:grid-cols-3

---

## Component Library

### Navigation Header
- Fixed top navigation with backdrop blur
- Logo/brand on left
- Centered search bar (expandable on mobile)
- Right side: User avatar/login button, favorites count badge
- Height: h-16, shadow-sm
- Sticky positioning for persistent access

### Homepage Components

**Search Section:**
- Prominent search bar: w-full md:max-w-2xl, h-12 to h-14
- Search icon inside input (left side)
- Real-time filtering indicators
- Spacing: py-8 from navigation

**Document Cards:**
- Card structure: rounded-lg, shadow-md, hover:shadow-xl transition
- Cover image: aspect-video, object-cover, rounded-t-lg
- Image placeholder gradient if no cover
- Card padding: p-4
- Content layout (vertical stack with gap-3):
  - Category badge (top): rounded-full pill, text-xs, px-3, py-1
  - Title: text-xl, font-semibold, line-clamp-2
  - Description: text-sm, line-clamp-3
  - Footer row (flex justify-between):
    - Page count icon + number
    - Favorite button (heart icon, toggle state)
- Hover state: scale-102, smooth transition
- Clickable: entire card is interactive area

### Document Detail Page Components

**Top Information Section:**
- Full-width container: py-8
- Breadcrumb navigation: text-sm with category > document trail
- Document metadata grid: 2-column on desktop, stack on mobile
  - Left: Title (text-3xl), Description (text-base, max-w-3xl)
  - Right: Stats card with rounded-lg border - Category, Page count, Views (future), Favorite button (prominent, larger size)
- Spacing between metadata and video: py-6

**Video Player Section:**
- Centered container: max-w-5xl mx-auto
- Aspect ratio: aspect-video
- HTML5 video element with custom controls
- Player wrapper: rounded-lg, shadow-2xl for elevation
- DRM initialization indicators (loading states)
- Responsive: w-full with appropriate max-width

**Related Documents Section:**
- Section header: "Tài liệu liên quan" - text-2xl, font-bold, py-12
- Reuse homepage card design
- Grid: 3 columns desktop, 2 tablet, 1 mobile
- Limit to 6-9 related items
- Section background: subtle contrast from main content

### Authentication Components

**Login Modal/Page:**
- Centered card: max-w-md, rounded-xl, shadow-2xl
- Replit Auth integration buttons: full-width, h-12
- Social login icons (Google, GitHub) with provider branding
- Divider: "hoặc" text with horizontal lines
- Email/password inputs: h-11, rounded-lg, border focus states
- Submit button: w-full, h-12, font-semibold
- Links: "Đăng ký" / "Quên mật khẩu" - text-sm

**User Menu Dropdown:**
- Trigger: Avatar circle - w-10, h-10, rounded-full
- Dropdown: rounded-lg, shadow-xl, min-w-48
- Menu items: py-2, px-4, hover background
- Options: Profile, Favorites, Settings, Logout
- Dividers between sections

### Interactive Elements

**Favorite Button:**
- Icon-based: Heart outline (unfavorited), filled heart (favorited)
- Size: w-8 h-8 minimum for touch targets
- Animated transition on toggle
- Tooltip: "Thêm vào yêu thích" / "Đã lưu"
- Counter display when applicable

**Category Badges:**
- Pill shape: rounded-full
- Padding: px-3 py-1
- Text: text-xs to text-sm, font-medium
- Subtle background, slightly darker text
- Clickable: filters by category

**Search Input:**
- Left icon: Magnifying glass
- Placeholder: "Tìm kiếm tài liệu..."
- Clear button (X) when text entered
- Dropdown suggestions (future enhancement area)
- Border radius: rounded-lg
- Focus state: ring treatment

---

## Images

**Cover Images:**
- Each document card requires a cover image
- Dimensions: 16:9 aspect ratio (standard video thumbnail)
- Fallback: Gradient background with document icon if no cover provided
- Quality: Optimized for web, lazy loading

**User Avatars:**
- Circular crop: aspect-square
- Sizes: 40px (navigation), 80px (profile)
- Fallback: User initials on colored background

**Hero Section:** None required - content discovery is immediate priority

---

## Animations

**Minimal, purposeful motion:**
- Card hover: scale-102, duration-200, ease-out
- Favorite toggle: Heart scale pulse animation, duration-300
- Page transitions: Fade-in for new content, duration-150
- Video loading: Subtle spinner, positioned center
- No auto-playing effects or distracting movements

---

## Responsive Behavior

**Breakpoints:**
- Mobile: Stack all grids to single column, larger touch targets
- Tablet: 2-column card grid, search bar full width
- Desktop: 3-4 column grid, navigation items visible
- Large: 4-column grid maximum for optimal card size

**Mobile Optimizations:**
- Collapsible search (icon → full bar)
- Hamburger menu if needed for secondary navigation
- Video player: full width with safe area considerations
- Card images: slightly larger hit areas

---

## Accessibility

- WCAG AA contrast ratios throughout
- Focus indicators on all interactive elements (ring-2 on focus)
- Semantic HTML: article for cards, main/section structure
- Alt text for all images
- ARIA labels for icon-only buttons
- Keyboard navigation: Tab order logical, Enter activates
- Video player: Native controls accessible, captions support ready

---

## Vietnamese Language Considerations

- Inter font family fully supports Vietnamese diacritics
- Line-height: relaxed (1.6-1.75) for readability with diacritics
- Text rendering: antialiased for clarity
- Proper text truncation that respects Vietnamese word boundaries (line-clamp utilities)