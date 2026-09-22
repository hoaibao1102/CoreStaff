# CoreStaff — Design Master

**Version:** 1.0  
**Date:** 2026-09-16  
**Status:** Active  
**Scope:** Web Application (React + Vite + TypeScript)

---

## A. Design Philosophy

### Phong cách tổng thể

Enterprise SaaS Web Application. Giao diện phải truyền cảm giác **chuyên nghiệp**, **tin cậy**, và **hiện đại**. Không theo phong cách landing page, startup demo, hay creative agency.

### UX Principles

| # | Nguyên tắc | Mô tả |
|---|-----------|-------|
| 1 | **Clarity > Decoration** | Mỗi phần tử phải phục vụ một mục đích rõ ràng. Không trang trí vô nghĩa. |
| 2 | **Consistency > Creativity** | Nhất quán về màu, spacing, typography, interaction pattern. |
| 3 | **Usability > Visual Effects** | Hiệu ứng chỉ khi cải thiện trải nghiệm. Không animation gây distraction. |
| 4 | **Progressive Disclosure** | Chỉ hiển thị thông tin cần thiết. Chi tiết mở ra khi user yêu cầu. |
| 5 | **Feedback Always** | Mọi hành động của user phải có phản hồi trực quan (loading, success, error). |
| 6 | **Density với Context** | Dashboard & table có mật độ cao. Form & detail page có nhiều whitespace. |
| 7 | **Vietnamese First** | UI text mặc định tiếng Việt. Pattern phù hợp với ngôn ngữ có từ dài hơn tiếng Anh. |

### Visual Principles

- **Neutral base:** Nền trắng/xám nhạt. Màu chỉ dùng để convey information hoặc guide action.
- **Single accent:** Một màu primary duy nhất (`oklch(0.55 0.22 250)` — xanh dương đậm).
- **Semantic color:** Success = green, Warning = amber, Danger = red, Info = blue. Dùng đúng ngữ cảnh.
- **Subtle depth:** Border nhẹ thay vì shadow mạnh. Shadow chỉ cho overlay/modal/dropdown.
- **Geometric:** Border-radius vừa phải (0.5rem–0.75rem). Không quá bo, không quá sắc.

### Consistency Principles

- **Shared components:** Một Button, một Input, một Card cho toàn app. Không `HRButton`, `AdminButton`.
- **Design tokens:** Mọi giá trị visual phải qua token system. Không hard-code hex/px tùy ý.
- **Pattern reuse:** CRUD module có cùng interaction pattern. List → Create → Detail → Edit.
- **Naming alignment:** Component names mô tả purpose, không appearance. `StatusBadge` không phải `GreenBadge`.

---

## B. Application Shell

### Desktop Layout (>= 1024px)

```
┌──────────────────────────────────────────────────────┐
│ Topbar / Header (h-20 / 80px)                        │
│ ├─ Logo ──────────────── Navigation Tabs ── User Menu│
│ └─ Active Tab Indicator                               │
├──────────────────────────────────────────────────────┤
│ Page Container (max-w-7xl / 1152px, px-4 sm:px-6)    │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ Page Header                                     │  │
│  │  Title + Description + Primary Action           │  │
│  ├────────────────────────────────────────────────┤  │
│  │ Optional Summary / Stats Row                    │  │
│  ├────────────────────────────────────────────────┤  │
│  │ Toolbar (Search, Filters, View Toggle)          │  │
│  ├────────────────────────────────────────────────┤  │
│  │ Main Content Area                               │  │
│  │                                                 │  │
│  ├────────────────────────────────────────────────┤  │
│  │ Pagination / Footer Actions (nếu cần)           │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Tablet Layout (640–1023px)

- Page container giữ max-width nhưng padding giảm.
- Navigation tabs vẫn inline (scroll nếu overflow).
- Grid chuyển từ 2–4 columns xuống 1–2 columns.
- Table giữ nguyên nhưng enable horizontal scroll.

### Mobile Layout (< 640px)

```
┌──────────────────────┐
│ Topbar (compact)     │
│ Logo   Hamburger     │
├──────────────────────┤
│ Page Container       │
│                      │
│  Page Header         │
│  (stacked)           │
│  ├─ Title            │
│  └─ Action (full)    │
│                      │
│  Main Content        │
│  (stacked)           │
│                      │
└──────────────────────┘
```

- Navigation chuyển thành hamburger menu (Sheet/Drawer).
- Buttons có thể full-width.
- Forms luôn 1 column.
- Table → card list hoặc horizontal scroll.

### Dimensions Reference

| Element | Value |
|---------|-------|
| Topbar height | 80px (`h-20`) |
| Nav tab height | ~40px nội trong topbar |
| Page container max-width | 1152px (`max-w-7xl`) |
| Page horizontal padding | 16px mobile → 24px sm → 32px lg |
| Content area min-height | `min-h-[calc(100dvh-200px)]` |

---

## C. Navigation

### Structure

Navigation hiện tại là **horizontal tab bar** nằm ngay dưới topbar. Đây là pattern phù hợp cho app có 3–7 mục chính.

```
Topbar
├─ Logo (trái)
├─ Navigation Tabs (giữa, flex-grow)
│  ├─ Tổng quan
│  ├─ Nhân viên
│  └─ Hồ sơ của tôi
└─ User Actions (phải)
   └─ Đăng xuất
```

### Navigation Item Rules

- **Icon + Label:** Luôn có icon 17–20px + text label. Không chỉ icon.
- **Active state:** Border-bottom 2px màu primary (`border-blue-600`), text màu primary.
- **Hover state:** Border-bottom màu `slate-200`, text `slate-900`.
- **Focus visible:** Outline 2px `outline-blue-600`.
- **Disabled/hidden:** Lọc hoàn toàn khỏi DOM. Không hiển thị disabled nav item.

### When NOT to use nested menus

- Số lượng mục chính <= 7 → dùng flat tab bar (current pattern).
- Số lượng mục > 7 → nhóm theo category với dropdown.
- Không nested > 2 levels.

### Role-Based Navigation

| Module | Admin | HR | Manager | Employee |
|--------|-------|----|---------|----------|
| Tổng quan | ✓ | ✓ | ✓ | ✓ |
| Nhân viên | ✓ | ✓ | ✓ (team only) | ✗ |
| Hồ sơ của tôi | ✓ | ✓ | ✓ | ✓ |
| Cài đặt | ✓ | ✗ | ✗ | ✗ |

Frontend filter dựa trên `user.role`. Backend vẫn enforce authorization.

### Department Manager Navigation — D36

Desktop sidebar dùng cấu trúc cố định:

```text
Cá nhân
├── Chấm công hôm nay
├── Lịch sử công
└── Nghỉ phép & OT

Quản lý
└── Phòng ban
```

- `Phòng ban` là một destination cấp một, không tách `Queue phê duyệt` và `Đánh giá KPI phòng` thành hai sidebar items.
- Trong workspace Phòng ban dùng `Tabs`: **Phê duyệt** và **Đánh giá nhân sự**.
- “Đánh giá nhân sự” hiển thị subtitle **Đánh giá KPI kỳ lương**, tránh hiểu nhầm thành performance review đầy đủ.
- Profile/logout nằm trong account menu, không thêm vào ba mục Cá nhân đã chốt.

Mobile web (`< md`) dùng bottom navigation:

```text
Chấm công | Lịch sử | Đơn từ | Phòng ban
```

- `Phòng ban` mở màn hình full-width; hai tab con dùng segmented control sticky.
- Không đặt nested menu trong bottom navigation.
- React Native/Expo chỉ port pattern này sau khi responsive web đã được nghiệm thu.

### Breadcrumb

Dùng breadcrumb khi user navigate sâu >= 2 levels:

```
Tổng quan › Nhân viên › Danh sách
```

Format: `Current Module › Sub Module › Current Page`

---

## D. Page Layout Standard

### Anatomy of a Standard Page

```
┌─────────────────────────────────────────────────────┐
│ Page Header                                          │
│ ├─ Breadcrumb (optional, khi depth >= 2)            │
│ ├─ Title (text-2xl/3xl font-semibold)               │
│ ├─ Description (text-sm text-muted-foreground)      │
│ └─ Primary Action (nằm cùng row, bên phải)          │
├─────────────────────────────────────────────────────┤
│ Optional: Stats/Summary Row                          │
│ [Stat Card] [Stat Card] [Stat Card] [Stat Card]     │
├─────────────────────────────────────────────────────┤
│ Toolbar                                               │
│ ├─ Search Input                                      │
│ ├─ Filter Dropdowns                                  │
│ └─ Secondary Actions                                 │
├─────────────────────────────────────────────────────┤
│ Main Content                                         │
│ ├─ Table / List / Grid / Form                       │
│ └─ Pagination (nếu có dữ liệu phân trang)            │
└─────────────────────────────────────────────────────┘
```

### Page Header Rules

- **Title:** `text-2xl font-semibold sm:text-3xl tracking-tight text-foreground`
- **Description:** `text-sm text-muted-foreground mt-2` (tối đa 2 dòng)
- **Primary Action:** Button variant `default` (primary). Chỉ có MỘT primary action per page.
- **Row layout:** `flex flex-wrap items-start justify-between gap-4`

### Empty Page Header

Khi không có description hoặc action:

```
┌─────────────────────────────────────────────────────┐
│ Title (alone, centered or left-aligned)             │
└─────────────────────────────────────────────────────┘
```

---

## E. Design Tokens

### Colors

#### Semantic Color System

```css
/* Base — from shadcn oklch tokens */
--background:       oklch(1 0 0)          /* Trắng tinh — page background */
--foreground:       oklch(0.145 0 0)      /* Gần đen — primary text */
--card:             oklch(1 0 0)          /* Trắng — card surface */
--card-foreground:  oklch(0.145 0 0)      /* Card text */
--popover:          oklch(1 0 0)          /* Trắng — dropdown/modal bg */
--popover-foreground: oklch(0.145 0 0)    /* Popover text */
--primary:          [blue-oklch]          /* Accent duy nhất */
--primary-foreground: oklch(0.985 0 0)   /* Trắng — text on primary */
--secondary:        oklch(0.965 0.005 264) /* Xám rất nhạt — secondary bg */
--secondary-foreground: oklch(0.205 0)   /* Dark — text on secondary */
--muted:            oklch(0.965 0.005 264) /* Xám nhạt — muted bg */
--muted-foreground: oklch(0.55 0.01 264)  /* Xám trung — muted text */
--accent:           [blue-oklch-light]    /* Hover states */
--accent-foreground: oklch(0.205 0)      /* Dark — text on accent */
--destructive:      oklch(0.575 0.237 25) /* Đỏ — error/delete */
--destructive-foreground: oklch(0.97 0)  /* Trắng — text on destructive */
--border:           oklch(0.92 0.005 264) /* Xám nhạt — borders */
--input:            oklch(0.92 0.005 264) /* Input border/bg */
--ring:             [blue-oklch]          /* Focus ring */
```

#### Color Usage Rules

| Color | Purpose | Where |
|-------|---------|-------|
| **Primary (blue)** | Brand accent, primary actions, active states | Buttons, links, active nav, badges |
| **Foreground** | Primary text | Body text, headings, labels |
| **Muted foreground** | Secondary/de-emphasized text | Descriptions, captions, placeholders |
| **Border** | Subtle separation | Card borders, table rows, input borders |
| **Destructive** | Error/danger/warning deletion | Delete buttons, validation errors, danger badges |
| **Success (emerald)** | Positive confirmation | Active status, success messages |
| **Warning (amber)** | Caution/pending | Pending badges, warning alerts |
| **Background** | Page canvas | Page background, not component background |
| **Card** | Component surface | Card backgrounds, modal backgrounds |

**Không dùng:**

- Hard-coded hex colors ngoài token system.
- Gradient cho button/card/background.
- More than 1 accent color per page.
- Màu sắc cho decoration thuần túy.

### Brand Palette Extension

Project đang dùng các màu brand cụ thể. Design Master khuyến nghị giữ nhưng chuẩn hóa:

| Token | Current Value | Recommendation |
|-------|--------------|---------------|
| Brand Blue | `#174ea6` | Map to `--primary` via oklch equivalent |
| Page BG | `#f5f7fb` / `#f4f5f8` | Use `--background` consistently |
| Slate text | `#111827`, `#5c6170`, `#6b7280` | Map to `--foreground`, `--muted-foreground` |
| Slate border | `#d9dee8`, `#e4e7ec`, `#e5eaf3` | Map to `--border` |

---

## F. Typography

### Type Scale

| Level | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| **Page Title** | 28px (sm:32px) | 700 | 1.25 (36px) | H1 — Page headers, dashboard title |
| **Section Title** | 18px | 700 | 1.33 (24px) | H2 — Section headers within pages |
| **Card Title** | 16px | 600 | 1.375 (22px) | H3 — Card titles, dialog titles |
| **Body** | 15px (md:14px) | 400 | 1.6 (24px) | Paragraph text, table cells |
| **Body Strong** | 15px | 600 | 1.6 (24px) | Emphasized body, field values |
| **Small** | 13px | 400 | 1.53 (20px) | Helper text, captions, metadata |
| **Label** | 13px | 600 | 1 (16px) uppercase | Form labels, section headers, badges |
| **Caption** | 11–12px | 700 | 1.45 (16px) uppercase | Tracking, overline, ultra-small |

### Typography Rules

- **Font family:** `'Geist Variable', Inter, Segoe UI, sans-serif`
- **Headings:** `tracking-tight` hoặc `tracking-normal`. Không `tracking-wide` cho headings.
- **Body:** `leading-relaxed` (1.6). Không tight line-height cho body text.
- **Uppercase labels:** Chỉ dùng cho section headers, badges, meta info. Không cho body.
- **Font weight:** Chỉ dùng 400, 500, 600, 700. Không 300 hoặc 800+.
- **Line clamp:** Dùng `line-clamp-2` hoặc `line-clamp-3` cho text truncation. Không cắt cụt không dấu ba chấm.

---

## G. Spacing System

### Spacing Scale (based on 4px grid)

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `xs` | 4px | `space-x-1` / `p-1` | Icon padding, tight gaps |
| `sm` | 8px | `space-x-2` / `p-2` | Small component gaps |
| `md` | 12px | `space-x-3` / `p-3` | Inline element spacing |
| `base` | 16px | `space-x-4` / `p-4` | Default gap, form field gap |
| `lg` | 20px | `space-x-5` / `p-5` | Medium sections |
| `xl` | 24px | `space-x-6` / `p-6` | Card padding, section gap |
| `2xl` | 32px | `gap-8` / `p-8` | Large sections |
| `3xl` | 40px | `gap-10` | Page-level gaps |
| `4xl` | 48px | `gap-12` | Hero/layout splits |
| `5xl` | 64px | `gap-16` | Full-page divisions |

### Spacing Application Rules

| Context | Vertical Gap | Horizontal Gap | Padding |
|---------|-------------|----------------|---------|
| **Page sections** | 32px (`space-y-8`) | N/A | N/A |
| **Page header → content** | 24–32px | N/A | N/A |
| **Card internal** | var(--card-spacing, 16px) | N/A | 16–24px |
| **Form fields** | 16px (`space-y-4`) | 16–24px (cols) | 16–24px |
| **Table rows** | N/A | N/A | Cell: h-10, px-2 |
| **Button internal** | N/A | 6–8px (`gap-1.5`) | py-2 px-2.5 |
| **List items** | 16px | N/A | N/A |
| **Grid cols** | 16px (`gap-4`) | 16px | N/A |

**Không dùng:** Random spacing như `mt-3.5`, `pb-7`, `gap-5` trừ khi có lý do đặc biệt.

---

## H. Grid & Responsive System

### Breakpoints

| Name | Range | Tailwind | Device Reference |
|------|-------|----------|-----------------|
| **Mobile** | < 640px | `sm:` | iPhone SE, iPhone 12 mini |
| **Tablet** | 640–1023px | `md:` | iPad, iPad Pro |
| **Desktop** | >= 1024px | `lg:` | Laptop, Desktop |
| **Wide** | >= 1280px | `xl:` | Large monitor |

### Grid System

#### Page Grid

```
Mobile (<640px):  1 column, full width, px-4
Tablet (640+):    1–2 columns, px-6
Desktop (1024+):  Up to 4 columns, max-w-7xl, px-8
```

#### Card Grid Reference

| Columns | Breakpoint | Class |
|---------|-----------|-------|
| 1 | Mobile default | `grid` |
| 2 | Tablet+ | `md:grid-cols-2` |
| 3 | Desktop+ | `lg:grid-cols-3` |
| 4 | Wide desktop | `xl:grid-cols-4` |

#### Dashboard KPI Grid

```
Mobile: 1 column (stacked cards)
Tablet: 2 columns
Desktop: 3–4 columns (depending on KPI count)
```

#### Form Grid

```
Mobile: 1 column (always)
Desktop: 2 columns when fields are related
```

Class: `grid gap-4 sm:grid-cols-2` hoặc `grid gap-4 md:grid-cols-3`

### Responsive Behavior Rules

| Element | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| Sidebar/Nav | Drawer/Hamburger | Tabs (scrollable) | Tabs (fixed) |
| Page container | Full width, px-4 | Max-w-7xl, px-6 | Max-w-7xl, px-8 |
| Tables | Scroll or card view | Scroll | Full table |
| Forms | 1 column | 1–2 columns | 2 columns |
| Buttons | Full width optional | Auto width | Auto width |
| Cards | Stacked | 2 columns | 3–4 columns |
| Header actions | Stacked | Flex wrap | Same row |

### Test Reference Widths

| Width | What to verify |
|-------|---------------|
| 375px | No horizontal overflow, readable text, touch targets >= 44px |
| 768px | Grid adapts, nav still usable |
| 1024px | Full layout, all columns visible |
| 1280px | Optimal reading width, no stretched content |
| 1440px | Comfortable spacing, max-width respected |

---

## I. Border Radius

### Radius Scale

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `sm` | `var(--radius-sm)` ≈ 6px | `rounded-sm` | Table cells, small inputs |
| `md` | `var(--radius-md)` ≈ 8px | `rounded-md` | Dropdowns, popovers |
| `base` | `var(--radius)` ≈ 8px | `rounded-lg` | Buttons, inputs, cards |
| `lg` | `var(--radius-lg)` ≈ 8px | `rounded-lg` | Card corners, dialogs |
| `xl` | `var(--radius-xl)` ≈ 12px | `rounded-xl` | Stat cards, feature cards |
| `2xl` | `var(--radius-2xl)` ≈ 16px | `rounded-2xl` | Large containers, modals |

### Component Radius Rules

| Component | Radius | Notes |
|-----------|--------|-------|
| Button | `rounded-lg` (base) | Consistent across all variants |
| Input | `rounded-lg` (base) | Including select, textarea |
| Card | `rounded-xl` | Not too round, not sharp |
| Dialog/Modal | `rounded-xl` or `rounded-2xl` | Matches card but slightly larger |
| Badge | `rounded-4xl` (shadcn default) | Pill shape |
| Avatar | `rounded-full` | Always circular |
| Dropdown menu | `rounded-lg` (md) | Slightly tighter |
| Stat/Feature card | `rounded-2xl` | For emphasis cards |

**Không dùng:** Radius khác nhau cho cùng loại component ở các page khác nhau.

---

## J. Shadows & Borders

### Shadow System

| Level | Usage | Implementation |
|-------|-------|---------------|
| **None** | Default cards, body elements | `shadow-none` |
| **Subtle** | Elevated cards on hover | `hover:shadow-md` |
| **Dropdown/Menu** | Popover, dropdown, select | `shadow-md` + `ring-1 ring-foreground/10` |
| **Modal** | Dialog overlay | `shadow-xl` |
| **Toast** | Notification | `shadow-lg` |

### Border Rules

| Element | Border | Width | Color |
|---------|--------|-------|-------|
| Card | Yes | 1px | `border-border` (oklch-based) |
| Input | Yes | 1px | `border-input` |
| Table row | Yes | 1px bottom | `border-border` |
| Button | Primary: none | 0px | Transparent (bg-primary) |
| Button | Outline/Ghost | 1px | `border-border` |
| Section dividers | Yes | 1px bottom | `border-slate-100` or `border-border` |

### Focus State

```css
focus-visible:border-ring
focus-visible:ring-3
focus-visible:ring-ring/50
```

**Luôn có focus visible.** Không bao giờ `outline-none` tanpa alternative.

---

## K. Components

### Buttons

#### Variants

| Variant | Background | Text | Border | Usage |
|---------|-----------|------|--------|-------|
| **Default (Primary)** | `bg-primary` | `text-primary-foreground` | none | Main CTA per page |
| **Secondary** | `bg-secondary` | `text-secondary-foreground` | none | Less prominent action |
| **Outline** | `bg-background` | `text-foreground` | `border-border` | Alternative action |
| **Ghost** | transparent | `text-foreground` (on hover) | none | Tertiary, icon-only in toolbars |
| **Destructive** | `bg-destructive/10` | `text-destructive` | none | Delete, remove, danger |
| **Link** | transparent | `text-primary` | underline on hover | Text-link style |

#### Sizes

| Size | Height | Padding | Font | Icon | Usage |
|------|--------|---------|------|------|-------|
| **XS** | 24px (`h-6`) | px-2 | xs (12px) | 12px (`size-3`) | Tight spaces, badge-adjacent |
| **SM** | 28px (`h-7`) | px-2.5 | sm (13px) | 14px (`size-3.5`) | Toolbar, compact tables |
| **Default** | 32px (`h-8`) | px-2.5 | sm/base | 16px (`size-4`) | Standard form/page action |
| **LG** | 36px (`h-9`) | px-2.5 | base | 16px | Hero CTAs, prominent actions |
| **Icon** | 32px (`size-8`) | — | — | 16px | Icon-only buttons |
| **Icon SM** | 28px (`size-7`) | — | — | 14px | Compact icon buttons |
| **Icon XS** | 24px (`size-6`) | — | — | 12px | Tight icon buttons |

#### States

| State | Visual |
|-------|--------|
| **Default** | Variant base styles |
| **Hover** | `hover:bg-primary/80` (primary), `hover:bg-muted` (others) |
| **Active/Pressed** | `active:translate-y-px` (only for non-popup buttons) |
| **Focus** | `focus-visible:border-ring focus-visible:ring-3 ring-ring/50` |
| **Disabled** | `opacity-50 pointer-events-none cursor-not-allowed` |
| **Loading** | Spinner inside button, disable interactions |

#### Button Rules

- **One primary action per page/section.** Không có 2+ primary buttons cạnh nhau.
- **Icon position:** Icon trước text (`gap-1.5`). `data-icon="inline-start"` hoặc `inline-end`.
- **Minimum touch target:** 32px height default, 44px on mobile.
- **Text:** Action verb + object. "Create Employee", "Save Changes". Không "OK", "Submit".
- **Icon-only:** Phải có `aria-label`. Không bao giờ chỉ icon vô danh.

### Inputs

#### Types

- Text Input
- Textarea (multi-line)
- Select (dropdown)
- Checkbox
- Radio
- Switch/Toggle
- Date Picker
- Search Input
- Number Input
- File Upload

#### Structure

```
┌─ Label (required indicator *) ─────────┐
│  ┌──────────────────────────────┐       │
│  │ Input field                  │       │
│  └──────────────────────────────┘       │
│  Helper text / Validation message       │
└─────────────────────────────────────────┘
```

#### States

| State | Visual |
|-------|--------|
| **Default** | `border-input bg-transparent` |
| **Hover** | Subtle border darkening |
| **Focus** | `border-ring ring-3 ring-ring/50` |
| **Filled** | Same as focus until blur |
| **Error** | `border-destructive ring-3 ring-destructive/20` |
| **Success** | Green border (if applicable) |
| **Disabled** | `opacity-50 cursor-not-allowed bg-input/50` |
| **Readonly** | Same as default, no edit |

#### Input Rules

- **Always use `<Label>`**, never placeholder-only.
- **Helper text** below input for hints.
- **Validation message** in destructive color, below helper text.
- **Height:** 32px (`h-8`) default, 28px (`h-7`) for compact.
- **Padding:** `py-1 px-2.5` mobile, consistent spacing.
- **Font:** Inherit from root (`font: inherit`). MD: `text-sm`.

### Cards

#### Anatomy

```
┌─ Card ───────────────────────────────────┐
│ ┌─ CardHeader (optional)                 │
│ │  ┌─ CardTitle                         │
│ │  └─ CardDescription                   │
│ ├─ CardContent                           │
│ │  ... content ...                       │
│ ├─ CardAction (optional, top-right)      │
│ └─ CardFooter (optional, border-top)     │
└──────────────────────────────────────────┘
```

#### Card Rules

| Property | Value |
|----------|-------|
| Border | `ring-1 ring-foreground/10` or `border-border` |
| Radius | `rounded-xl` |
| Shadow | `shadow-none` by default, `hover:shadow-md` on interactive |
| Padding | `--card-spacing` (16px default, 12px for `size="sm"`) |
| Background | `bg-card` (white) |

#### When NOT to use Card

- Simple list items without elevation need.
- Table rows (use row styling instead).
- Within another card (avoid card-in-card nesting).
- As a mere wrapper (use `<div>` with spacing classes).

### Badges

#### Variants

| Variant | Background | Text | Usage |
|---------|-----------|------|-------|
| **Default (Primary)** | `bg-primary` | `text-primary-foreground` | Active, confirmed |
| **Secondary** | `bg-secondary` | `text-secondary-foreground` | Neutral status |
| **Destructive** | `bg-destructive/10` | `text-destructive` | Error, rejected, deleted |
| **Outline** | transparent | `text-foreground` | `border-border` | Low-priority status |
| **Ghost** | transparent | `text-foreground` | On hover → `bg-muted` | Temporary/dismissed |

#### Status Badge Semantics

| Status | Tone | Example |
|--------|------|---------|
| Active / Approved | Emerald/Green | Employment status |
| Inactive / Disabled | Slate/Gray | Account status |
| Pending / Reviewing | Amber/Yellow | Leave request |
| Rejected / Error | Red | Approval denied |
| Draft | Slate | Document state |
| Completed / Done | Emerald | Task finished |

**Không hard-code status strings.** Dùng enum labels từ backend (`EMPLOYMENT_STATUS_LABELS`).

### Avatar

#### Sizes

| Size | Dimension | Badge | Fallback Text |
|------|-----------|-------|---------------|
| **XS** | 24px (`size-6`) | Hidden | `text-xs` |
| **Default** | 32px (`size-8`) | 10px (`size-2.5`) | `text-sm` |
| **Large** | 40px (`size-10`) | 12px (`size-3`) | `text-sm` |

#### Features

- **Image:** `object-cover rounded-full`
- **Fallback:** Initials (first letter of first name + last name), uppercase, Vietnamese-aware.
- **Badge:** Online/active indicator at bottom-right corner.
- **Group:** `-space-x-2` with ring background separation.

### Table

#### Anatomy

```
┌─ Table Container (overflow-x-auto) ─────┐
│ ┌─ TableHeader                           │
│ │  ┌─ TableRow (th cells)                │
│ │  │  Column 1    Column 2    ...  ⋮    │
│ │  └─────────────────────────────────── │
│ ├─ TableBody                             │
│ │  ┌─ TableRow (td cells)                │
│ │  │  Value 1       Value 2     ...  ⋮  │
│ │  └─────────────────────────────────── │
│ │  ... more rows ...                     │
│ ├─ TableFooter (optional)                │
│ └─ Pagination                            │
└──────────────────────────────────────────┘
```

#### Table Rules

| Property | Value |
|----------|-------|
| Header row height | 40px (`h-10`) |
| Body row height | Auto, min 44px |
| Cell padding | `px-2` horizontal |
| Font size | `text-sm` |
| Hover | `hover:bg-muted/50` |
| Selected | `data-[state=selected]:bg-muted` |
| Sorting | Sort indicator icon in header |
| Alignment | Left-aligned text, right-aligned numbers/actions |

#### Row Actions

- **Contextual primary action** visible (e.g., "View", "Edit").
- **Overflow menu** (`⋮`) for secondary actions (Delete, Duplicate, etc.).
- **Maximum 2–3 visible actions** per row. Rest in overflow.
- **Destructive actions** only in overflow menu, never directly visible.

#### Table States

| State | Display |
|-------|---------|
| Loading | Skeleton rows (same column structure) |
| Empty | Empty state component (icon + title + description + action) |
| Error | Error state with retry |
| Data present | Normal table |

### Modal / Dialog

#### Dimensions

| Property | Value |
|----------|-------|
| Width (sm) | 400px (`max-w-sm`) |
| Width (default) | 600px (`max-w-lg`) |
| Width (large) | 800px (`max-w-2xl`) |
| Width (fullscreen) | Full screen (mobile) |
| Padding | 24px (`p-6`) |
| Radius | `rounded-xl` |
| Shadow | `shadow-xl` |

#### Anatomy

```
┌─ Modal Header ─────────────────────────┐
│  Title                    [Close ×]    │
├─────────────────────────────────────────┤
│  Body                                   │
│  ... content ...                        │
├─────────────────────────────────────────┤
│  Modal Footer                           │
│  [Cancel]  [Confirm Action]             │
└─────────────────────────────────────────┘
```

#### Rules

- **Header:** Title + close button (X) top-right.
- **Body:** Scrollable if content exceeds viewport.
- **Footer:** Actions aligned right. Cancel left, Confirm right.
- **Destructive:** Confirm button in destructive variant.
- **Width limit:** Không dùng modal cho form > 10 fields. Dùng page/drawer thay thế.
- **Mobile:** Full-screen or bottom sheet.

### Drawer / Sheet

#### Use Cases

- Slide-over forms (create/edit).
- Side panels for detail viewing.
- Mobile navigation replacement.

#### Dimensions

| Property | Desktop | Mobile |
|----------|---------|--------|
| Width | 360–480px | Full screen |
| Position | Right side | Bottom sheet or full |
| Overlay | Yes (backdrop) | Yes |

### Tabs

#### Variants

| Variant | Background | Active Indicator | Usage |
|---------|-----------|-----------------|-------|
| **Default** | `bg-muted` | `bg-background` inset | Grouped content sections |
| **Line** | transparent | Bottom border line | Navigation tabs, minimal |

#### Rules

- **When to use:** 3–7 related content sections.
- **When NOT to use:** Only 2 options (use toggle/segmented control). More than 7 (use sidebar/navigation).
- **Active state:** Background fill (default) or underline (line variant).
- **Overflow:** Horizontal scroll with hidden scrollbar.
- **Mobile:** Scrollable, same as desktop.

### Dropdown / Menu

#### Anatomy

```
┌─ Dropdown Menu ────────────────────────┐
│  Item 1              [icon]            │
│  Item 2              [check]           │
│  ───────────────────────────────────── │
│  Group Label                            │
│  Item 3              [icon]            │
│  Item 4 (destructive)                  │
└────────────────────────────────────────┘
```

#### Rules

| Property | Value |
|----------|-------|
| Item height | 36–40px |
| Item padding | `px-1.5 py-1.5` or `px-2 py-1.5` |
| Icon size | 16px (`size-4`) |
| Selected indicator | Check icon on right |
| Destructive item | Red text, red bg on hover |
| Divider | Between logical groups |
| Label | `text-xs font-medium text-muted-foreground` |
| Radius | `rounded-lg` |
| Shadow | `shadow-md ring-1 ring-foreground/10` |
| Width | Match trigger (`w-(--anchor-width)`) |

### Tooltip

#### Rules

- **Only** for icon-only buttons or abbreviated text that may be unclear.
- **Not** for explaining every icon.
- **Position:** Auto-detected (avoid overflow).
- **Trigger:** Hover + focus.
- **Content:** Max 2 lines. Short and descriptive.

### Toast / Notification

#### Variants

| Type | Icon | Color | Duration | Usage |
|------|------|-------|----------|-------|
| **Success** | Check circle | Emerald/Green | 3–4s | Action completed |
| **Error** | Alert triangle | Red | 5s | Action failed, show message |
| **Warning** | Alert circle | Amber | 4s | Action may have partial result |
| **Info** | Info circle | Blue | 3s | Informational message |

#### Rules

- **Position:** Top-right (desktop), bottom-center (mobile).
- **Content:** Title (optional) + description. Action button (optional: "Undo", "Retry").
- **Duration:** 3s default, 5s for errors, auto-dismiss for success.
- **Not for:** Every minor interaction. Only meaningful events.
- **Stack:** Max 3 visible, older ones dismiss automatically.

### Skeleton / Loading

#### Patterns

| Context | Pattern |
|---------|---------|
| **Page** | Shimmer blocks matching page structure |
| **Card** | Rectangle with `animate-pulse rounded-xl bg-muted` |
| **Table** | Row skeletons with same column widths |
| **Avatar** | Circular skeleton |
| **Button** | `disabled` state + spinner icon |

#### Rules

- **Match final layout:** Skeleton structure must match loaded content structure.
- **Animate:** `animate-pulse` with `bg-muted`.
- **Duration:** Show while API is loading. Minimum 300ms (avoid flicker).
- **Never** show blank page during load.

### Empty State

#### Anatomy

```
┌─ Empty State ──────────────────────────┐
│  [Icon / Illustration — 48–64px]       │
│                                         │
│  Title (text-lg font-semibold)          │
│                                         │
│  Description (text-sm text-muted)       │
│                                         │
│  [Primary Action Button] (optional)     │
└─────────────────────────────────────────┘
```

#### Rules

- **Centered** vertically and horizontally.
- **Icon:** Relevant to context (inbox for empty messages, users for empty team).
- **Title:** Clear statement. "Chưa có nhân viên nào".
- **Description:** Explain why empty + what to do.
- **Action:** Primary button to create first item (if applicable).

### Error State

#### Anatomy

```
┌─ Error State ──────────────────────────┐
│  [Alert Triangle / X Circle]            │
│                                         │
│  Title (text-lg font-semibold)          │
│                                         │
│  Description (text-sm text-muted)       │
│                                         │
│  [Retry Button] [Contact Support]       │
└─────────────────────────────────────────┘
```

#### Rules

- **Never** show raw backend error (`undefined`, `null`, exception stack).
- **User-friendly** message in Vietnamese.
- **Retry** action when appropriate (network error, transient failure).
- **Different** messages for different error types (403 vs 500 vs network).

---

## L. Forms

### Form Layouts

#### Single Column

```
┌─ Form ─────────────────────────────────┐
│  Field 1                                │
│  Field 2                                │
│  Field 3                                │
│                                         │
│  [Cancel]  [Save Changes]              │
└─────────────────────────────────────────┘
```

Use for: Create/Edit pages with many fields, mobile view.

#### Two Columns

```
┌─ Form ─────────────────────────────────┐
│  Field 1    │  Field 2                  │
│  Field 3    │  Field 4                  │
│  Field 5    │  Field 6                  │
│                                         │
│  [Cancel]  [Save Changes]              │
└─────────────────────────────────────────┘
```

Use for: Desktop view, related field pairs (name fields, date fields).

Class: `grid gap-4 md:grid-cols-2`

#### Sectioned Form

```
┌─ Form ─────────────────────────────────┐
│  ── Personal Information ─────────      │
│  Field 1    │  Field 2                  │
│  Field 3    │  Field 4                  │
│                                             │
│  ── Employment Details ──────────        │
│  Field 5    │  Field 6                  │
│  Field 7    │  Field 8                  │
│                                             │
│  [Cancel]  [Save Changes]               │
└─────────────────────────────────────────┘
```

Use for: Long forms with logical groupings.

### Form Field Rules

| Rule | Detail |
|------|--------|
| **Label always** | Never rely on placeholder alone |
| **Required indicator** | `*` after label, styled in destructive |
| **Helper text** | Below label or below input (for hints) |
| **Validation** | Inline, below input, destructive color |
| **Error state** | Border destructive + ring + message |
| **Field width** | `w-full`, respect two-column grid |
| **Textarea** | Min-height 100px, resizable vertical only |
| **Select** | Same height as input (`h-8`) |
| **Date picker** | Same styling as input, calendar icon trigger |

### Form Actions

| Order | Button | Variant |
|-------|--------|---------|
| Left | Cancel / Back | Ghost or secondary |
| Right | Save Changes / Create | Primary (default) |

For destructive forms (delete confirmation):

| Order | Button | Variant |
|-------|--------|---------|
| Left | Cancel | Secondary |
| Right | Delete / Confirm | Destructive |

### Form States

| State | Behavior |
|-------|----------|
| **Initial** | All fields empty/default, disabled submit (if required) |
| **Filling** | Fields populated, validate on blur/change |
| **Invalid** | Show validation errors, prevent submit |
| **Submitting** | Disable button, show loading spinner |
| **Success** | Toast notification, redirect or reset |
| **Error** | Toast + inline errors, re-enable form |
| **Readonly** | All fields disabled, show values as text |
| **Disabled** | Entire form grayed out, explain why |

---

## M. CRUD Page Pattern

### List Page

```
┌─ Breadcrumb (optional) ──────────────────┐
│                                           │
│  Title                    [+ Create]     │
│  Description                              │
│                                           │
│  ── Stats Row (optional) ─────────────── │
│  [Total] [Active] [Pending] [Inactive]   │
│                                           │
│  ── Toolbar ──────────────────────────── │
│  [Search...]  [Filter ▼]  [View ▼]       │
│                                           │
│  ── Table ────────────────────────────── │
│  | Col 1 | Col 2 | Col 3 | Actions |   │
│  |-------|-------|-------|---------|   │
│  | data  | data  | data  | ⋮       |   │
│  | data  | data  | data  | ⋮       |   │
│                                           │
│  ── Pagination ───────────────────────── │
│  < 1 2 3 ... 10 >                        │
└──────────────────────────────────────────┘
```

**Rules:**

- Title + description at top.
- Primary action (Create) in top-right.
- Search + filters in toolbar row.
- Table with contextual actions + overflow menu.
- Pagination at bottom (or infinite scroll for small datasets).

### Create Page

```
┌─ Breadcrumb: [List] › Create ────────────┐
│                                           │
│  Create [Resource]                        │
│  Add a new [resource] to the system.      │
│                                           │
│  ── Form ─────────────────────────────── │
│  Field 1    │  Field 2                  │
│  Field 3    │  Field 4                  │
│                                             │
│  [← Back to List]  [Create]              │
└──────────────────────────────────────────┘
```

**Rules:**

- Breadcrumb back to list.
- Clear title: "Create [Resource]".
- Form in single column (mobile) or two columns (desktop).
- Two actions at bottom: Cancel/Back (left), Create (right, primary).
- Submit disabled until required fields filled (optional).

### Detail Page

```
┌─ Breadcrumb: [List] › [Item] ────────────┐
│                                           │
│  [Name]                       [Edit]     │
│  Status badge · Created date              │
│                                           │
│  ── Summary Row (optional) ───────────── │
│  [Metric] [Metric] [Metric]              │
│                                           │
│  ── Sections ─────────────────────────── │
│  ── Personal Information ─────────       │
│  Field: Value        Field: Value        │
│  Field: Value        Field: Value        │
│                                             │
│  ── Employment Information ──────        │
│  Field: Value        Field: Value        │
│                                             │
│  ── Related Data ─────────────────        │
│  [Related Table/List]                     │
│                                           │
│  ── Activity History ────────────        │
│  Timeline of changes/events               │
│                                           │
│  ── Actions ──────────────────────        │
│  [Edit] [Delete] (contextual)             │
└──────────────────────────────────────────┘
```

**Rules:**

- Header with name, status, primary action (Edit).
- Group information into logical sections.
- Primary information first, metadata second.
- Related data in sub-sections or tabs.
- Activity/history at bottom.
- Actions contextual: Edit (primary), Delete (destructive, in overflow or secondary).

### Edit Page

```
┌─ Breadcrumb: [List] › [Item] › Edit ─────┐
│                                           │
│  Edit [Resource]                          │
│  Update [resource] information.           │
│                                           │
│  ── Form ─────────────────────────────── │
│  Field 1    │  Field 2                  │
│  Field 3    │  Field 4                  │
│                                             │
│  [← Cancel]  [Save Changes]              │
└──────────────────────────────────────────┘
```

**Rules:**

- Pre-populate form with existing data.
- Readonly fields shown as disabled or as text.
- Two actions: Cancel (left, ghost), Save Changes (right, primary).
- Validate on submit, show inline errors.
- On success: redirect to detail page or list page.

---

## N. Dashboard Pattern

### Dashboard Anatomy

```
┌─ Page Header ────────────────────────────┐
│  Welcome, [Name].                       │
│  Chúc bạn một ngày làm việc hiệu quả.    │
└──────────────────────────────────────────┘

┌─ KPI / Summary Metrics ──────────────────┐
│  [Total] [Active] [New This Month]       │
│  [Pending Approval] [On Leave Today]     │
└──────────────────────────────────────────┘

┌─ Main Content ───────────────────────────┐
│  ┌─ Recent Activity        ┌─ Quick Links│
│  │  · Item 1               │  · Link 1   │
│  │  · Item 2               │  · Link 2   │
│  │  · Item 3               │             │
│  └─────────────────────────┴─────────────┘
└──────────────────────────────────────────┘
```

### Dashboard Rules

- **Max 4–6 KPI cards** per row. Fewer is better.
- **Each metric has a purpose.** No vanity metrics.
- **Charts optional.** Only if they drive decisions.
- **Recent activity:** Last 5–10 items with timestamps.
- **Quick actions:** Max 3–4 shortcuts.
- **No clutter.** If a widget doesn't serve a daily task, remove it.
- **Empty dashboard:** Show "Get started" guidance, not just empty space.

---

## O. Profile Page Pattern

### Anatomy

```
┌─ Profile Header ─────────────────────────┐
│                                           │
│  [Avatar]  [Full Name]        [Edit]     │
│            [Role] · [Department]          │
│            [Status Badge]                 │
│                                           │
└──────────────────────────────────────────┘

┌─ Sections (View Mode) ───────────────────┐
│  ── Personal Information ─────────────── │
│  Email: user@example.com                 │
│  Phone: +84 xxx xxx xxx                  │
│  Date of Birth: DD/MM/YYYY               │
│                                           │
│  ── Employment Information ───────────── │
│  Employee Code: EMP-001                  │
│  Department: Engineering                  │
│  Position: Senior Developer               │
│  Employment Type: Full-time               │
│                                           │
│  ── Account Information ──────────────── │
│  Status: Active                          │
│  Last Login: DD/MM/YYYY HH:MM            │
│  Two-Factor: Enabled / Disabled           │
│                                           │
│  ── Security ─────────────────────────── │
│  [Change Password] [Manage Sessions]     │
└──────────────────────────────────────────┘
```

### Profile Rules

- **Default mode: View.** Not edit. User must explicitly click "Edit".
- **Avatar:** Large (40–48px), with status indicator if applicable.
- **Name + Role** in header. Department if relevant.
- **Sections:** Logical grouping. Personal → Employment → Account → Security.
- **Field display:** Label (uppercase small) + Value (bold, break-words).
- **Edit mode:** Sections convert to form fields. Save/Cancel at bottom.
- **Sensitive data:** Mask phone/email partially in view mode. Reveal on click.

---

## P. Detail Page Pattern

### Information Hierarchy

```
Level 1: Header (Name, Status, Primary Action)
Level 2: Summary (Key metrics at a glance)
Level 3: Main Information (Core entity data)
Level 4: Related Information (Linked entities)
Level 5: History / Activity (Audit trail)
```

### Rules

- **Header:** Always visible (sticky if page is long).
- **Status:** Prominent badge next to name/title.
- **Primary action:** Most common next step (Edit, Approve, Assign).
- **Summary:** 3–4 key metrics if applicable.
- **Main info:** Grouped in sections with clear headings.
- **Related data:** Tabs or expandable sections.
- **History:** Timeline format, reverse chronological.
- **Actions:** Contextual, not overwhelming. Max 3 visible.

---

## Q. Role-Based UI

### Principle

> UI chỉ hiển thị những gì user có quyền thực hiện. Không có menu item, button, hoặc link cho action user không được phép.

### Permission Enforcement

| Layer | Responsibility |
|-------|---------------|
| **Backend** | Enforce authorization. Return 403 for forbidden. |
| **Frontend** | Hide UI elements based on role/permissions. |
| **Both** | Frontend hiding is UX optimization, NOT security. |

### Rules

- **Centralized permission model.** One source of truth (`canViewEmployees`, `canViewProfile`, etc.).
- **No hard-coded roles in JSX.** Use permission functions/hooks.
- **Hide, don't just disable.** Forbidden items should not appear.
- **Graceful degradation.** If permission check fails, show appropriate message.
- **Backend is ultimate authority.** Frontend permissions are UX layer only.

### Common Role Patterns

| Role | Access Level | Special UI |
|------|-------------|------------|
| **Super Admin** | Full access | System settings, user management |
| **Admin** | Organization admin | Team management, reports |
| **HR** | HR operations | Employee directory, approvals |
| **Manager** | Team lead | Team overview, approve requests |
| **Employee** | Self-service | My profile, my requests |

---

## R. Data States

Every screen that fetches data from API must handle these states:

| State | Display | User Can |
|-------|---------|----------|
| **Initial** | Empty or pre-filled form | Start action |
| **Loading** | Skeleton / spinner | Wait (disable controls) |
| **Success** | Normal rendered content | Interact normally |
| **Empty** | Empty state component | Create first item |
| **Error** | Error state with retry | Retry, contact support |
| **Forbidden** | "You don't have permission" | Contact admin, go back |
| **Partial/Missing** | Show `—` for missing, partial data | View what's available |

### State Transition Rules

```
Initial → Loading → Success
                 → Error → (Retry) → Loading → Success
                          → (Cancel) → Initial
                 
Loading → (data arrives empty) → Empty
Error → (retry succeeds) → Success
Forbidden → (static message, no retry)
```

**Never skip Loading state.** Even with cached data, show minimum 200–300ms skeleton to avoid jarring transitions.

---

## S. Responsive UX

### Desktop (>= 1024px)

- Full navigation (tabs or sidebar).
- Multi-column layouts (2–4 columns).
- Full table with all columns.
- Hover states visible.
- Maximum content width: `max-w-7xl`.

### Tablet (640–1023px)

- Navigation: Tabs with horizontal scroll OR hamburger.
- Grid: Reduced columns (1–2).
- Table: Horizontal scroll enabled.
- Cards: 2-column grid.
- Forms: Consider 1 column for longer forms.
- Touch targets: >= 44px.

### Mobile (< 640px)

- Navigation: Hamburger menu → Sheet/Drawer.
- Layout: Everything stacked (1 column).
- Buttons: Full width acceptable for primary actions.
- Forms: Always 1 column.
- Table: Card list view OR horizontal scroll.
- Toolbar: Stack or scroll filters/search.
- Header: Logo + hamburger (no full nav tabs).
- **No horizontal page overflow.** Ever.

### Mobile-Specific Rules

| Rule | Detail |
|------|--------|
| Touch targets | Minimum 44×44px |
| Font size | Minimum 14px body, 16px input (prevent zoom on iOS) |
| Swipe | Don't rely on swipe for critical actions |
| Keyboard | Ensure form is accessible with keyboard open |
| Safe areas | Respect notch/home indicator on modern phones |

---

## T. Accessibility

### Requirements

| Area | Standard | Implementation |
|------|----------|---------------|
| **Semantic HTML** | WCAG 2.1 AA | Use `<header>`, `<main>`, `<nav>`, `<section>`, `<article>` |
| **Input labels** | 1.3.1 | Every input has associated `<Label>` or `aria-label` |
| **Button names** | 2.4.1 | Visible text OR `aria-label` for icon-only |
| **Icon accessibility** | 1.1.1 | `aria-hidden="true"` + sibling text OR `aria-label` |
| **Focus state** | 2.4.7 | Visible focus ring on all interactive elements |
| **Keyboard nav** | 2.1.1 | All features operable via keyboard |
| **Color contrast** | 1.4.3 | Minimum 4.5:1 for text, 3:1 for large text |
| **Modal focus** | 4.1.2 | Focus trapped in modal, restored on close |
| **Alt text** | 1.1.1 | Meaningful alt for informative images |
| **ARIA roles** | 4.1.2 | Proper roles for custom widgets |
| **Disabled state** | 2.5.8 | `pointer-events-none`, `opacity-50`, explain why |

### Focus Management

```css
/* Global focus style (from shadcn) */
focus-visible:border-ring
focus-visible:ring-3
focus-visible:ring-ring/50
```

**Never remove focus outline without providing alternative.**

### Screen Reader Guidelines

- Use `aria-label` for icon-only buttons.
- Use `aria-current="page"` for active navigation.
- Use `aria-describedby` for helper text / validation messages.
- Use `role="alert"` for toast notifications.
- Use `aria-live="polite"` for dynamic content updates.
- Avoid `aria-hidden="true"` on elements with interactive children.

---

## U. Icons

### Library

**Lucide React** (`lucide-react`). Only this library. No mixing with other icon sets.

### Standard Sizes

| Size | Value | Usage |
|------|-------|-------|
| **XS** | 12px (`size-3`) | Badge-adjacent, tight spaces |
| **SM** | 14px (`size-3.5`) | Button icons, inline |
| **Base** | 16px (`size-4`) | Standard button, toolbar |
| **MD** | 20px (`size-5`) | Card icons, section headers |
| **LG** | 24px (`size-6`) | Empty states, hero icons |

### Icon Usage Rules

| Context | Size | With Text | Alone |
|---------|------|-----------|-------|
| Navigation | 17–20px | Required | Never |
| Button | 16px (`size-4`) | Preferred | Must have `aria-label` |
| Badge | 12–14px | Optional | Rarely |
| Empty state | 48–64px | N/A | Required |
| Status indicator | 12–16px | Optional | With label |
| Card feature | 20–24px | Optional | Acceptable |

### Icon Rules

- **Always** `aria-hidden="true"` when icon is decorative.
- **Never** use icon purely for decoration without meaning.
- **Consistent** icon style (all Lucide, no mixing with FontAwesome, Material, etc.).
- **Pass `className`** for color/size overrides when needed.
- **Size via props** (`size={16}`) or className (`className="h-4 w-4"`), not both.

---

## V. Content Guidelines

### Button Text

| Do | Don't |
|----|-------|
| Create Employee | OK |
| Save Changes | Click Here |
| Delete Record | Submit |
| View Details | Go |
| Send Invitation | Proceed |
| Cancel | Back (when not going back) |

### Error Messages

| Do | Don't |
|----|-------|
| Không thể đăng nhập. Vui lòng kiểm tra email và mật khẩu. | Error 500 |
| Bạn không có quyền thực hiện thao tác này. | undefined |
| Đã xảy ra lỗi khi tải dữ liệu. | null |
| Vui lòng thử lại sau. | Raw API exception string |

### Missing Data

- Display: `—` (em dash)
- CSS: `text-muted-foreground`
- Never display: `undefined`, `null`, empty string, or "N/A"

### Status Labels

- Use backend enum labels (`EMPLOYMENT_STATUS_LABELS`).
- Capitalize first letter: `"Đang hoạt động"`, not `"đang hoạt động"`.
- Consistent terminology across all screens.

### Form Labels

- Clear and specific: "Email công việc", not just "Email".
- Required indicator: `*` after label text.
- Helper text for clarification: "Nhập email đăng ký tại công ty."

---

## W. Motion

### Animation Durations

| Context | Duration | Easing |
|---------|----------|--------|
| **Hover** | 150ms | `ease-out` |
| **Dropdown open/close** | 150–200ms | `ease-in-out` |
| **Modal open/close** | 200ms | `ease-out` / `ease-in` |
| **Drawer slide** | 250ms | `ease-out` |
| **Page transition** | 200ms | `ease-out` |
| **Skeleton shimmer** | 1.5s continuous | — |
| **Spinner** | 1s rotation | linear |

### When to Animate

| Use | Example |
|-----|---------|
| State change feedback | Button press, tab switch |
| Spatial relationship | Dropdown appearing from trigger |
| Loading indication | Skeleton, spinner |
| Completion feedback | Toast slide-in |

### When NOT to Animate

- Page load content reveal (unless it adds clarity).
- Every hover effect.
- List item entrance (unless it's a new item being added).
- Icon rotation (unless it indicates state change, e.g., chevron).
- Background color changes (unless highlighting selection).

### Reduced Motion

Respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## X. Z-Index Strategy

### Z-Index Layers

| Layer | Value | Element |
|-------|-------|---------|
| **base** | 0 | Page content, default flow |
| **sticky** | 10 | Sticky header, topbar |
| **dropdown** | 50 | Dropdown menu, select popup, tooltip |
| **sidebar** | 60 | Sidebar (if implemented) |
| **drawer-overlay** | 90 | Backdrop overlay for drawer/sheet |
| **modal** | 100 | Modal/dialog |
| **modal-overlay** | 95 | Backdrop overlay for modal |
| **toast** | 110 | Toast notifications |
| **portal** | 999 | Generic portal content |

### Rules

- **Never use:** `9999`, `99999`, or random high numbers.
- **Use CSS variables** for z-index layers if possible.
- **Document** any z-index override with comment explaining why.
- **Test overlap:** Ensure dropdowns don't appear behind modals.

---

## Y. UX Rules

### DO

- [ ] Keep consistency across all pages.
- [ ] Reuse shared components (`Button`, `Input`, `Card`, `Badge`, `Table`).
- [ ] Use visual hierarchy (size, weight, color) to guide attention.
- [ ] Prioritize whitespace — don't cram content.
- [ ] Use semantic colors (primary, destructive, success, warning).
- [ ] Handle all UI states (loading, empty, error, forbidden).
- [ ] Make forms accessible with proper labels.
- [ ] Test responsive at 375px, 768px, 1024px, 1440px.
- [ ] Use design tokens, not hard-coded values.
- [ ] Write Vietnamese content naturally.
- [ ] Provide meaningful empty states.
- [ ] Show loading skeletons, not blank pages.
- [ ] Use one primary action per page/section.
- [ ] Keep navigation flat and discoverable.

### DON'T

- [ ] Don't cardify everything. Not every section needs a card.
- [ ] Don't use gradients arbitrarily.
- [ ] Don't use more than one primary button per section.
- [ ] Don't show raw backend errors to users.
- [ ] Don't hard-code user data in components.
- [ ] Don't duplicate components (no `HRButton`, `AdminButton`).
- [ ] Don't create different layouts for similar pages.
- [ ] Don't use random spacing values.
- [ ] Don't use more than 2–3 colors beyond neutral palette.
- [ ] Don't nest cards unnecessarily.
- [ ] Don't hide navigation items without permission logic.
- [ ] Don't remove focus outlines without alternative.
- [ ] Don't use placeholder as the only label.
- [ ] Don't create horizontal page overflow on mobile.
- [ ] Don't use too many border-radius values.
- [ ] Don't animate for animation's sake.

---

## Z. Component Reuse Rules

### Before Creating a New Component

Ask:

1. **Does an existing shared component cover this?** Check `components/` first.
2. **Is this truly a new pattern, or just a variant?** Use CVA variants, not new files.
3. **Will this be used in 3+ places?** If only 1–2 places, consider inline or page-local component.
4. **Am I copying-pasting instead of abstracting?** Look for repeated patterns.

### Shared Component Inventory

| Component | Location | Purpose |
|-----------|----------|---------|
| `Button` | `components/button.tsx` | All buttons (6 variants, 7 sizes) |
| `Input` | `components/input.tsx` | Text inputs |
| `Textarea` | `components/textarea.tsx` | Multi-line inputs |
| `Select` | `components/select.tsx` | Dropdown selects |
| `Label` | `components/label.tsx` | Form labels |
| `Card` | `components/card.tsx` | Contained content blocks |
| `Badge` | `components/badge.tsx` | Status indicators |
| `Avatar` | `components/avatar.tsx` | User avatars |
| `Table` | `components/table.tsx` | Data tables |
| `Tabs` | `components/tabs.tsx` | Tabbed content |
| `DropdownMenu` | `components/dropdown-menu.tsx` | Context menus |
| `Skeleton` | `components/skeleton.tsx` | Loading placeholders |
| `Separator` | `components/separator.tsx` | Visual dividers |
| `Sheet` | `components/sheet.tsx` | Mobile nav / side panels |
| `EmployeeDataState` | `components/EmployeeDataState.tsx` | Data state wrapper |

### Naming Convention

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `EmployeeTable`, `StatusBadge` |
| Hooks | `use` + PascalCase | `useEmployees`, `useAttendance` |
| Services | PascalCase | `hrService`, `authService` |
| Types/Interfaces | PascalCase | `EmployeeProfile`, `DataState` |
| Constants | UPPER_SNAKE_CASE | `MAX_PAGE_SIZE` |
| Design tokens | kebab-case, semantic | `--color-primary`, `--radius-lg` |
| Files | PascalCase (components), camelCase (others) | `EmployeeTable.tsx`, `hrService.ts` |

### Anti-Patterns

**Don't create:**

```tsx
// BAD: Visual-specific naming
function RedButton() {}
function BigCard() {}
function GreenBadge() {}

// BAD: Role-specific duplication
function HRButton() {}
function AdminTable() {}
function EmployeeProfileCard() {} // if generic ProfileCard exists
```

**Do create:**

```tsx
// GOOD: Purpose-based naming
function StatusBadge({ variant }: BadgeProps) {}
function DataTable({ columns, data }: TableProps) {}
function ProfileCard({ user }: ProfileProps) {}
```

---

## AA. Example Screen Blueprints

### 1. Dashboard

```
┌──────────────────────────────────────────────────────────┐
│ Topbar: Logo │ Tổng quan  Nhân viên  Hồ sơ │ User       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Chào, Nguyễn Văn A.                                    │
│  Chúc bạn một ngày làm việc hiệu quả.                   │
│                                                          │
│  ── Thống kê ────────────────────────────────────────── │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐           │
│  │ 156    │ │ 142    │ │ 8      │ │ 6      │           │
│  │ Tổng   │ │ Đang   │ │ Chờ   │ │ Nghỉ   │           │
│  │ NV     │ │ hoạt   │ │ duyệt │ │ hôm nay│           │
│  └────────┘ └────────┘ └────────┘ └────────┘           │
│                                                          │
│  ── Nghiệp vụ nhân sự ───────────────────────────────── │
│  ┌──────────────────────────┐ ┌──────────────────────┐ │
│  │  Việc cần làm             │ │  Truy cập nhanh      │ │
│  │  · Phê duyệt 3 đơn        │ │  [Danh bạ NV]        │ │
│  │  · Xem báo cáo tháng      │ │  [Hồ sơ của tôi]     │ │
│  │  · Cập nhật phòng ban     │ │                      │ │
│  └──────────────────────────┘ └──────────────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 2. List / Table Page

```
┌──────────────────────────────────────────────────────────┐
│ Topbar                                                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Danh bạ nhân viên                    [+ Thêm nhân viên] │
│  Quản lý thông tin nhân viên trong tổ chức               │
│                                                          │
│  ── Bộ lọc ──────────────────────────────────────────── │
│  🔍 Tìm kiếm...    Phòng ban ▼   Trạng thái ▼   🡳      │
│                                                          │
│  ── Bảng dữ liệu ────────────────────────────────────── │
│  │ Tên          │ Phòng ban   │ Trạng thái    │ ⋮     │
│  │──────────────│─────────────│───────────────│───────│
│  │ Nguyễn Văn A │ Kỹ thuật    │ ● Hoạt động  │ ⋮     │
│  │ Trần Thị B   │ Nhân sự     │ ● Hoạt động  │ ⋮     │
│  │ Lê Văn C     │ Kinh doanh  │ ◐ Chờ duyệt  │ ⋮     │
│                                                          │
│  ── Phân trang ──────────────────────────────────────── │
│  <  1  2  3  ...  10  >  156 mục                       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 3. Create / Edit Form

```
┌──────────────────────────────────────────────────────────┐
│ Topbar                                                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Danh sách › Thêm nhân viên mới                          │
│                                                          │
│  Thêm nhân viên mới                                      │
│  Điền thông tin để tạo hồ sơ nhân viên mới.              │
│                                                          │
│  ── Thông tin cá nhân ───────────────────────────────── │
│  Họ và tên          │ Email công việc                   │
│  [____________]     │ [____________]                    │
│  Ngày sinh          │ Số điện thoại                     │
│  [____/____/____]   │ [____________]                    │
│  Giới tính          │ CCCD/CMND                         │
│  [Nam ▼]            │ [____________]                    │
│                                                          │
│  ── Thông tin công việc ─────────────────────────────── │
│  Mã nhân viên         │ Phòng ban                       │
│  [____________]       │ [Chọn phòng ban ▼]              │
│  Chức danh            │ Loại hợp đồng                   │
│  [____________]       │ [Toàn thời gian ▼]              │
│  Ngày bắt đầu         │ Lương                           │
│  [____/____/____]     │ [____________]                  │
│                                                          │
│  [← Về danh sách]          [Tạo nhân viên]              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 4. Detail Page

```
┌──────────────────────────────────────────────────────────┐
│ Topbar                                                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Danh sách › Nguyễn Văn A                                │
│                                                          │
│  [Avatar]  Nguyễn Văn A                       [Chỉnh sửa]│
│            Kỹ thuật viên senior    ● Hoạt động            │
│                                                          │
│  ── Thông tin cá nhân ───────────────────────────────── │
│  EMAIL          : user@example.com                       │
  ĐIỆN THOẠI    : +84 90 xxx xxx                         │
  NGÀY SINH       : 15/03/1990                             │
  CCCD            : 0123456789                             │
│                                                          │
│  ── Thông tin công việc ─────────────────────────────── │
│  MÃ NV            : EMP-001                             │
  PHÒNG BAN       : Kỹ thuật                             │
  CHỨC DANH        : Kỹ thuật viên senior                 │
  LOẠI HĐ          : Toàn thời gian                       │
  NGÀY BẮT ĐẦU    : 01/01/2023                           │
│                                                          │
│  ── Lịch sử hoạt động ───────────────────────────────── │
│  • 15/09/2026 10:30 — Cập nhật thông tin bởi HR        │
│  • 01/09/2026 09:00 — Chuyển phòng ban                  │
│  • 15/01/2023 08:00 — Tạo hồ sơ                         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 5. Profile Page

```
┌──────────────────────────────────────────────────────────┐
│ Topbar                                                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Hồ sơ của tôi                                            │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  [Avatar]  Nguyễn Văn A              [Chỉnh sửa]  │  │
│  │            Kỹ thuật viên senior                    │  │
│  │            ● Hoạt động                             │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ── Thông tin tài khoản ─────────────────────────────── │
│  EMAIL          : user@example.com                       │
  MÃ NV         : EMP-001                                │
  TRẠNG THÁI    : Đang hoạt động                          │
  ĐĂNG NHẬP CUỐI: 16/09/2026 08:30                       │
│                                                          │
│  ── Bảo mật ─────────────────────────────────────────── │
│  [Đổi mật khẩu]  [Quản lý phiên đăng nhập]              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 6. Mobile Page

```
┌────────────────────┐
│ ☰    CoreStaff    │  ← Hamburger + Logo
├────────────────────┤
│                    │
│  Danh sách NV   [+]│  ← Title + Action (stacked)
│  Quản lý nhân viên │
│                    │
│ ┌─ Bộ lọc ─────────┐
│ │ 🔍 Tìm kiếm...   │
│ │ Phòng ban ▼      │
│ │ Trạng thái ▼     │
│ └──────────────────┘
│                    │
│ ┌─ Nguyễn Văn A ───┐
│ │ Kỹ thuật    ● HD  │
│ │ Xem chi tiết →    │
│ └──────────────────┘
│ ┌─ Trần Thị B ─────┐
│ │ Nhân sự     ● HD  │
│ │ Xem chi tiết →    │
│ └──────────────────┘
│                    │
│    < 1 2 3 >       │  ← Pagination
│                    │
└────────────────────┘
```

### 7. Department Manager — Phòng ban

#### Desktop

```text
┌─ Phòng ban ──────────────────────────────────────────┐
│ Department selector (nếu quản lý > 1 phòng)          │
│ [Nhân viên] [Công chờ duyệt] [OT chờ duyệt] [KPI]  │
│ [ Phê duyệt ] [ Đánh giá nhân sự ]                  │
│ ──────────────────────────────────────────────────── │
│ Toolbar + table + pagination                         │
└──────────────────────────────────────────────────────┘
```

- Approval table mở dialog/side sheet chi tiết.
- KPI tái sử dụng pattern table hiện có nhưng chỉ load managed scope.
- Không hiển thị trường salary/contract/private identifiers.

#### Mobile web

```text
┌──────────────────────┐
│ Phòng ban      [ENG▼]│
│ [Phê duyệt|Đánh giá] │ ← sticky segmented control
│ 🔍 Tìm kiếm   [Lọc]  │
│ ┌─ Request card ────┐│
│ │ NV · loại · ngày  ││
│ │ trạng thái        ││
│ │ Xem chi tiết →    ││
│ └───────────────────┘│
│                      │
│ Chấm │ LS │ Đơn │ PB │ ← bottom navigation
└──────────────────────┘
```

- Queue/KPI dùng card list, không horizontal table.
- Filter dùng Sheet/full-screen modal; department selector ở header.
- Detail là full-screen sheet/page; approval actions nằm trong sticky bottom action bar.
- Nội dung phải có bottom padding bằng tổng chiều cao bottom nav/action bar + safe spacing.
- Test tối thiểu 360px và các breakpoint 375/768/1024/1440px.
- Expo không bắt đầu cho đến khi blueprint desktop/mobile web này được nghiệm thu.

---

## BB. Design Consistency Checklist

Use this checklist before marking any UI task as complete.

### Layout & Structure

- [ ] Page uses standard App Shell (Topbar + Content)
- [ ] Page Header follows pattern (Title + Description + Primary Action)
- [ ] Breadcrumb used when navigation depth >= 2
- [ ] Content wrapped in appropriate container (`max-w-7xl`)
- [ ] Page padding consistent (`px-4 sm:px-6 lg:px-8`)

### Typography & Spacing

- [ ] Typography follows type scale (no arbitrary sizes)
- [ ] Heading weights consistent (700 for H1, 600 for H2/H3)
- [ ] Spacing uses scale values (8px grid)
- [ ] No random spacing (`mt-3.5`, `pb-7`)
- [ ] Section gaps consistent (`space-y-8` for major sections)

### Components

- [ ] Uses shared components (`Button`, `Input`, `Card`, `Badge`, `Table`)
- [ ] No duplicated components (`HRButton`, `AdminTable`)
- [ ] Button variants used correctly (one primary per section)
- [ ] Badge variants match status semantics
- [ ] Card usage justified (not wrapping everything)

### Colors & Styling

- [ ] Uses design tokens (CSS variables), not hard-coded hex
- [ ] Single accent color per page
- [ ] Semantic colors used correctly (destructive for errors)
- [ ] Border radius consistent per component type
- [ ] Shadows subtle (no heavy shadows on cards)

### Forms

- [ ] All inputs have labels (not placeholder-only)
- [ ] Required fields marked with `*`
- [ ] Validation messages visible and descriptive
- [ ] Form actions clearly ordered (Cancel left, Save right)
- [ ] Form responsive (1 column mobile, 2 columns desktop)

### Data States

- [ ] Loading state implemented (skeleton or spinner)
- [ ] Empty state implemented with actionable message
- [ ] Error state with retry option
- [ ] Forbidden/access-denied state handled
- [ ] Missing data shows `—` (not `null` or `undefined`)

### Responsive

- [ ] No horizontal overflow at any breakpoint
- [ ] Tested at 375px, 768px, 1024px, 1440px
- [ ] Touch targets >= 44px on mobile
- [ ] Navigation adapts (hamburger on mobile)
- [ ] Grid columns adapt (1 col mobile → multi col desktop)

### Accessibility

- [ ] Semantic HTML elements used
- [ ] All interactive elements have accessible names
- [ ] Focus visible on all interactive elements
- [ ] Icons have `aria-hidden` or `aria-label`
- [ ] Color contrast meets WCAG 2.1 AA
- [ ] Keyboard navigation works

### Code Quality

- [ ] No TypeScript errors
- [ ] No lint errors from new code
- [ ] Build succeeds
- [ ] No console warnings
- [ ] No hard-coded data (uses API)
- [ ] No horizontal overflow in console
- [ ] Permissions checked correctly

---

## CC. Rules for AI Coding Agents

When implementing UI tasks, AI coding agents MUST:

### Pre-Implementation

1. **Read this Design Master** before making any UI changes.
2. **Inspect existing components** in `src/components/`. Reuse before creating.
3. **Inspect data/API/types** in `src/services/` and `src/lib/`. Understand the data shape.
4. **Check existing screens** for patterns already established. Follow them.

### Implementation

5. **Never create design styles** that contradict this Design Master.
6. **Reuse shared components.** If `Button` exists, don't create `CustomButton`.
7. **Never hard-code data.** Use API responses, services, or mock data only during prototype.
8. **Never break business logic** to make UI look better.
9. **Never change API contracts** without explicit requirement.
10. **Implement responsive** for all new pages. Mobile-first where possible.
11. **Implement all data states:** loading, empty, error, forbidden.
12. **Use design tokens** for colors, spacing, radius. No hard-coded values.

### Post-Implementation

13. **Run type-check:** `npm run lint` (TypeScript compilation check).
14. **Run build:** `npm run build` to verify no errors.
15. **Verify responsive** at 375px, 768px, 1024px, 1440px.
16. **Check accessibility:** focus states, aria labels, keyboard nav.
17. **Review against checklist** in Section BB (Design Consistency Checklist).

### Conflict Resolution

If a task requirement conflicts with this Design Master:

- **Task requirements take priority** but maintain maximum consistency.
- **Note the deviation** in your implementation summary.
- **Propose a Design Master update** if the deviation should become standard.

---

## DD. Definition of Done

An UI feature is considered **complete** when ALL of the following are true:

### Functional

- [ ] Meets all functional requirements
- [ ] Correct API integration (no mock data when API exists)
- [ ] Permissions/roles enforced correctly
- [ ] No broken links or navigation

### Visual

- [ ] Follows Design Master specifications
- [ ] Consistent with existing pages
- [ ] Visual hierarchy clear and intentional
- [ ] Proper spacing and typography
- [ ] Responsive at all breakpoints

### States

- [ ] Loading state implemented (skeleton/spinner)
- [ ] Empty state implemented with actionable message
- [ ] Error state with retry/contact option
- [ ] Forbidden state handled gracefully
- [ ] All form validation states working

### Quality

- [ ] No TypeScript errors
- [ ] No lint errors from new code
- [ ] Build succeeds (`npm run build`)
- [ ] No console warnings or errors
- [ ] No horizontal overflow at any breakpoint

### Code

- [ ] Reuses existing components (no duplication)
- [ ] Uses design tokens (no hard-coded values)
- [ ] Clean, readable code with proper naming
- [ ] No commented-out code
- [ ] No debug statements left in

### Accessibility

- [ ] Semantic HTML used correctly
- [ ] All interactive elements accessible
- [ ] Focus states visible
- [ ] Screen reader friendly
- [ ] Keyboard navigation works

---

## EE. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-09-16 | — | Initial creation based on CoreStaff web application audit |

---

## FF. How to Use This Document

### For Developers

1. **Before starting any UI task:** Read relevant sections of this document.
2. **While implementing:** Refer to component guidelines, token values, and patterns.
3. **Before completing:** Run through the Design Consistency Checklist.

### For AI Coding Agents

1. **Prompt template:** `"Read DESIGN_MASTER.md and implement TASK-XXX"`
2. **Agent will:** Inspect this document, inspect existing code, implement following standards.
3. **Verification:** Agent runs checklist before marking task complete.

### For Design Reviews

1. **Compare** existing pages against this document.
2. **Identify** inconsistencies and prioritize corrections.
3. **Update** this document when new patterns emerge that should become standard.
