# Mobile Design Master

> This document is the single source of truth for mobile UI/UX implementation in this project.  
> **Project:** CoreStaff Mobile (React Native + Expo)  
> **Version:** 1.0  
> **Date:** 2026-09-16  
> **Scope:** Employee-facing mobile application  

---

## Sources Used

- `Apps/mobile/App.tsx` — Current screen implementations & style definitions
- `Apps/mobile/src/auth.ts` — Auth flow patterns & error handling
- `Apps/mobile/src/config.ts` — API configuration
- `Apps/mobile/package.json` — Dependencies (Expo ~57.0.23, React Native 0.86.3)
- `Docs/DESIGN_MASTER.md` — Web app design system (reference for consistency)
- Project skill files (if any exist in `skills/`, `.skills/`, or `docs/`)

---

## 1. Design Philosophy

### Phong cách tổng thể

**Professional Enterprise Mobile App.** Giao diện phải truyền cảm giác **chuyên nghiệp**, **tin cậy**, và **hiện đại**. Tối ưu cho thao tác một tay trên thiết bị di động.

Mobile UI không được thiết kế giống website desktop thu nhỏ. Phải tối ưu cho:
- Thao tác một tay
- Vùng chạm (touch target) tối thiểu 44×44px
- Màn hình nhỏ
- Keyboard interaction
- Safe area (notch, dynamic island, home indicator)
- Bottom navigation / scroll patterns

### UX Principles

| # | Nguyên tắc | Mô tả |
|---|-----------|-------|
| 1 | **Clarity > Decoration** | Mỗi phần tử phải phục vụ một mục đích rõ ràng. Không trang trí vô nghĩa. |
| 2 | **Consistency > Creativity** | Nhất quán về màu, spacing, typography, interaction pattern. |
| 3 | **Usability > Visual Effects** | Hiệu ứng chỉ khi cải thiện trải nghiệm. Không animation gây distraction. |
| 4 | **Progressive Disclosure** | Chỉ hiển thị thông tin cần thiết. Chi tiết mở ra khi user yêu cầu. |
| 5 | **Feedback Always** | Mọi hành động của user phải có phản hồi trực quan (loading, success, error). |
| 6 | **Mobile-First Touch** | Tất cả interactive elements phải touch-friendly (min 44×44px). |
| 7 | **Vietnamese First** | UI text mặc định tiếng Việt. Pattern phù hợp với ngôn ngữ có từ dài hơn tiếng Anh. |

### Visual Principles

- **Neutral base:** Nền `#f6f8fc` (xám nhạt ấm). Màu chỉ dùng để convey information hoặc guide action.
- **Single accent:** Primary color `#2563eb` (blue-600). Một màu duy nhất cho toàn app.
- **Semantic color:** Success = green (`#16a34a`), Warning = amber, Danger = red (`#dc2626`), Info = blue (`#2563eb`).
- **Subtle depth:** Border nhẹ (`borderWidth: 1`, `borderColor: #e2e8f0`). Shadow chỉ cho card/modal.
- **Geometric radius:** Border-radius consistent: `12px` (input/button), `16–20px` (card). Không dùng radius ngẫu nhiên.

---

## 2. Screen Layout Master

### Standard Screen Structure

```
SafeAreaView (backgroundColor: '#f6f8fc')
└── KeyboardAvoidingView (iOS: padding, Android: undefined)
    └── ScrollView
        ├── Content Container (paddingHorizontal: 22px)
        │   ├── paddingTop: 42px
        │   ├── paddingBottom: 32px
        │   └── gap giữa sections: 16–24px
        │
        ├── Header Section (optional)
        │   ├── Eyebrow text (small, uppercase, primary color)
        │   ├── Title (large, bold)
        │   └── Description (optional, muted)
        │
        ├── Card / Content Area
        │   ├── backgroundColor: '#fff'
        │   ├── borderWidth: 1, borderColor: '#e2e8f0'
        │   ├── borderRadius: 16–20px
        │   ├── padding: 16–20px
        │   └── shadow (optional): opacity 0.06, offset {0, 8}
        │
        └── Footer / Actions
            └── Security note / version text (muted, small)
```

### Layout Dimensions Reference

| Element | Value | Usage |
|---------|-------|-------|
| SafeArea background | `#f6f8fc` | Toàn app |
| Horizontal page padding | `22px` | Auth screens, Home |
| Vertical padding top | `42px` | Auth screens |
| Vertical padding bottom | `32px` | Auth screens |
| Card internal padding | `16–20px` | Form cards, profile cards |
| Section gap | `16px` | Giữa các section |
| Field gap | `7–8px` | Label to input |
| Button minimum height | `48–50px` | All buttons |
| Input minimum height | `50px` | All text inputs |

### Scroll Behavior

- Luôn dùng `ScrollView` cho form screens (auth, change password).
- Luôn dùng `keyboardShouldPersistTaps="handled"` trên auth screens.
- Dùng `KeyboardAvoidingView` với `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`.
- Không nested `ScrollView` nếu không cần thiết.

### Home Screen Layout

```
ScrollView (contentContainerStyle: { padding: 22, paddingTop: 28, paddingBottom: 40, gap: 16 })
├── Header Row
│   ├── Greeting + Name (left, flex: 1)
│   └── Avatar (52×52, borderRadius: 18)
├── Shift/Status Card (dark theme: #172554)
│   ├── Eyebrow
│   ├── Title
│   ├── Description
│   └── Status Pill (rounded, with dot indicator)
├── Section Title
├── Profile Card (white, bordered)
│   └── Info Rows (label + value, separated by divider)
├── Menu Items (list of Pressable rows)
│   ├── Title + Description (left)
│   └── Chevron › (right)
└── Bottom Actions
    └── Secondary Button (logout)
```

---

## 3. Spacing System

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `spacing.micro` | `4px` | Ít dùng trong current impl |
| `spacing.xs` | `7–8px` | Label-input gap, status pill gap |
| `spacing.sm` | `12px` | Error banner padding, small gaps |
| `spacing.md` | `16px` | Card padding, section gap, field gap |
| `spacing.lg` | `20px` | Card internal padding, avatar gap |
| `spacing.xl` | `22px` | Page horizontal padding |
| `spacing[2]xl` | `24px` | Section gap (if needed) |
| `spacing[3]xl` | `28–32px` | Center screen padding, auth bottom padding |
| `spacing[4]xl` | `40–42px` | Auth top padding |

### Rules

- Không dùng random spacing như `13px`, `17px`, `23px`, `29px`.
- Ưu tiên giá trị chẵn: `4, 8, 12, 16, 20, 22, 24, 28, 32, 40, 42`.
- Consistent across screens: cùng loại element = cùng spacing.

---

## 4. Color System

### Primary Colors

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#2563eb` | Buttons, links, eyebrow text, active states |
| `primary-dark` | `#1d4ed8` | Avatar text, strong emphasis |
| `primary-light` | `#3b82f6` | (if needed) |

### Background Colors

| Token | Value | Usage |
|-------|-------|-------|
| `bg.default` | `#f6f8fc` | Screen background (SafeAreaView) |
| `bg.surface` | `#ffffff` | Card background, input background |
| `bg.dark` | `#172554` | Special cards (shift card, dark theme sections) |
| `bg.divider` | `#f1f59` | Divider lines |
| `bg.border` | `#e2e8f0` | Card borders, input borders |
| `bg.border-light` | `#cbd5e1` | Input default border |
| `bg.border-danger` | `#fecaca` | Error input/banner border |
| `bg.success` | `#f0fdf4` | Success banner background |
| `bg.success-border` | `#bbf7d0` | Success banner border |
| `bg.warning` | *(define if needed)* | Warning states |
| `bg.info` | `#eff6ff` | Info notice background |
| `bg.info-border` | `#bfdbfe` | Info notice border |

### Text Colors

| Token | Value | Usage |
|-------|-------|-------|
| `text.primary` | `#0f172a` | Main titles, body text, values |
| `text.secondary` | `#334155` | Labels, secondary content |
| `text.muted` | `#64748b` | Descriptions, helper text |
| `text.quaternary` | `#94a3b8` | Placeholder, chevron, version text |
| `text.link` | `#2563eb` | Links, actionable text |
| `text.white` | `#ffffff` | Text on dark backgrounds |
| `text.on-dark` | `#cbd5e1` | Description on dark card |
| `text.status` | `#e2e8f0` | Text on status pill |

### Semantic Colors

| Token | Value | Usage |
|-------|-------|-------|
| `success.text` | `#166534` | Success banner text |
| `success.dot` | `#4ade80` | Active status dot |
| `danger.text` | `#b91c1c` / `#dc2626` | Error messages, danger buttons |
| `danger.banner-bg` | `#fef2f2` | Error banner background |
| `info.text` | `#1e40af` | Info notice text |

### Button States

| State | Primary | Secondary | Danger |
|-------|---------|-----------|--------|
| Default | `bg: #2563eb`, `text: #fff` | `bg: #fff`, `border: #cbd5e1`, `text: #334155` | `border: #fecaca`, `text: #dc2626` |
| Pressed | `opacity: 0.78` | `opacity: 0.78` | `opacity: 0.78` |
| Disabled | `opacity: 0.55` | `opacity: 0.55` | `opacity: 0.55` |
| Loading | `ActivityIndicator color: #fff` | `ActivityIndicator color: #334155` | `ActivityIndicator color: #dc2626` |

### Rules

- Không hard-code màu rải rác trong component.
- Tất cả màu phải qua `StyleSheet.create` và có token name rõ ràng.
- Semantic colors phải dùng đúng ngữ cảnh (success, error, warning, info).

---

## 5. Typography System

### Font Tokens

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `eyebrow` | `10–11px` | `800` (ExtraBold) | `1.2–1.4` | Section labels, uppercase badges |
| `title.large` | `28–30px` | `800` (ExtraBold) | `1.2–1.3` | Screen titles, brand name |
| `title.medium` | `22–24px` | `800` (ExtraBold) | `1.25` | Page headers, user name |
| `title.small` | `20px` | `800` (ExtraBold) | `1.3` | Card titles, section headers |
| `body.large` | `15px` | `800` (ExtraBold) | `1.0` | Button text |
| `body` | `14px` | `600–700` | `1.4–1.5` | Body text, info values, menu titles |
| `body.small` | `13px` | `600–700` | `1.4–1.5` | Labels, links, helper text |
| `caption` | `11–12px` | `700` | `1.5–1.7` | Security notes, field actions, captions |
| `icon` | `17–32px` | `800` | `1.0` | Logo letter, avatar initials |

### Rules

- Weight chính: `800` (ExtraBold) cho titles, `700` (Bold) cho labels/buttons, `600` (SemiBold) cho body.
- Không dùng quá nhiều font-size khác nhau.
- Titles luôn `fontWeight: '800'`.
- Body text `lineHeight` phải >= `fontSize * 1.4` để readability.
- Ellipsis/numberOfLines cần dùng cho text dài (user names, descriptions).

---

## 6. Touch Target & Interactive Elements

### Minimum Touch Targets

| Element | Min Size | Current Implementation |
|---------|----------|----------------------|
| Button | `48×48px` | `minHeight: 48–50px`, full width |
| Input field | `50px height` | `height: 50px`, full width |
| Menu row | `68px height` | `minHeight: 68px`, full width |
| Icon button | `44×44px` | (if needed, define explicitly) |
| Link text | `auto height`, min `20px` | `fontSize: 13`, padding implicit |

### Press Feedback

- Tất cả `Pressable` elements phải có pressed state: `opacity: 0.78`.
- Không dùng animation phức tạp cho press feedback.
- Khoảng cách giữa các action >= `8px` để tránh bấm nhầm.

### Rules

- Tất cả control phải touch-friendly (min 44×44px).
- Không tạo icon button quá nhỏ.
- Button full-width trên auth screens.
- Menu items có minHeight `68px` cho comfortable tap.

---

## 7. Button Master

### Button Types

#### Primary Button

```tsx
<PrimaryButton label="Đăng nhập" loading={busy} disabled={busy} onPress={submit} />
```

- `minHeight: 50px`
- `borderRadius: 12px`
- `backgroundColor: #2563eb`
- `textAlign: center`, `justifyContent: center`
- Text: `color: #fff`, `fontSize: 15px`, `fontWeight: '800'`
- Full width (trong card container)

#### Secondary Button

```tsx
<SecondaryButton label="Đăng xuất" danger onPress={signOut} />
```

- `minHeight: 48px`
- `borderRadius: 12px`
- `backgroundColor: #fff`
- `borderWidth: 1`, `borderColor: #cbd5e1`
- Text: `color: #334155`, `fontSize: 14px`, `fontWeight: '700'`
- Variant `danger`: `borderColor: #fecaca`, `textColor: #dc2626`

### Button States

| State | Visual |
|-------|--------|
| Default | Full color/border |
| Pressed | `opacity: 0.78` |
| Disabled | `opacity: 0.55` |
| Loading | `ActivityIndicator` thay thế text, centered |

### Rules

- Không tạo mỗi screen một kiểu button.
- Ưu tiên reusable `PrimaryButton` và `SecondaryButton`.
- Button luôn có `accessibilityRole="button"`.
- Loading state hiển thị spinner, disable press.
- Danger variant chỉ dùng cho destructive actions (logout, delete).

---

## 8. Input & Form Master

### Field Structure

```
┌─ Field ─────────────────────────────────┐
│ Label                    [Action]       │  ← flexDirection: 'row', justifyContent: 'space-between'
│ [Input placeholder...]                  │
└─────────────────────────────────────────┘
```

### Field Props Standard

| Prop | Type | Required | Example |
|------|------|----------|---------|
| `label` | `string` | Yes | `"Số điện thoại"` |
| `value` | `string` | Yes | `"0912345678"` |
| `onChangeText` | `function` | Yes | `(text) => setPhone(text)` |
| `placeholder` | `string` | No | `"VD: 0912345678"` |
| `secureTextEntry` | `boolean` | No | `true` (password) |
| `keyboardType` | `KeyboardType` | No | `'email-address'`, `'phone-pad'`, `'numeric'` |
| `autoCapitalize` | `string` | No | `'none'` (most fields) |
| `autoCorrect` | `boolean` | No | `false` (most fields) |
| `editable` | `boolean` | No | `!busy` (during loading) |
| `action` | `string` | No | `"Hiện"` / `"Ẩn"` (password toggle) |
| `onAction` | `function` | No | `() => setVisible(!visible)` |

### Field Styling

| Element | Style |
|---------|-------|
| Container | `gap: 7px` |
| Label | `color: #334155`, `fontSize: 13px`, `fontWeight: '700'` |
| Input | `height: 50px`, `borderWidth: 1`, `borderColor: #cbd5e1`, `borderRadius: 12px`, `paddingHorizontal: 14px`, `backgroundColor: #fff`, `color: #0f172a`, `fontSize: 15px` |
| Placeholder | `color: #94a3b8` |
| Action text | `color: #2563eb`, `fontSize: 12px`, `fontWeight: '700'` |

### Form Validation Rules

- Field bắt buộc phải có `*` indicator (nếu cần, current impl chưa có).
- Label luôn hiển thị, **không dùng placeholder thay label**.
- Error inline dưới field hoặc banner trên form.
- `keyboardType` đúng theo field type:
  - Email: `'email-address'`, `autoCapitalize: 'none'`
  - Phone: `'phone-pad'`
  - Number: `'numeric'`
- AutoCapitalize: `'none'` cho most fields (email, password, code).
- Error message dùng ngôn ngữ người dùng, không technical error.

### Banner Types

| Type | Background | Border | Text Color | Usage |
|------|------------|--------|------------|-------|
| Error | `#fef2f2` | `#fecaca` | `#b91c1c` | Validation errors, API errors |
| Success | `#f0fdf4` | `#bbf7d0` | `#166534` | Confirmation messages |
| Info/Notice | `#eff6ff` | `#bfdbfe` | `#1e40af` | Informational messages |

---

## 9. Mobile Keyboard UX

### Keyboard Handling Pattern

```tsx
<KeyboardAvoidingView 
  style={styles.flex} 
  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
>
  <ScrollView 
    contentContainerStyle={styles.authScroll}
    keyboardShouldPersistTaps="handled"
  >
    {/* Form content */}
  </ScrollView>
</KeyboardAvoidingView>
```

### Rules

- Luôn wrap form screens trong `KeyboardAvoidingView`.
- iOS: `behavior="padding"`, Android: không cần behavior.
- `keyboardShouldPersistTaps="handled"` để dismiss keyboard khi tap ngoài.
- ScrollView phải scroll tự động khi input focus.
- Keyboard không che button submit (ScrollView handles this).
- Tap vào vùng trống → dismiss keyboard.

---

## 10. Card Design

### Card Types

#### Standard Card (White)

```tsx
<View style={{
  backgroundColor: '#fff',
  borderWidth: 1,
  borderColor: '#e2e8f0',
  borderRadius: 20,
  padding: 20,
  gap: 16,
  // Optional shadow:
  shadowColor: '#0f172a',
  shadowOpacity: 0.06,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3, // Android
}}>
```

#### Dark Card (Shift Card)

```tsx
<View style={{
  backgroundColor: '#172554',
  borderRadius: 20,
  padding: 20,
  gap: 7–16px,
}}>
```

#### Profile Card (Compact)

```tsx
<View style={{
  backgroundColor: '#fff',
  borderWidth: 1,
  borderColor: '#e2e8f0',
  borderRadius: 16,
  paddingHorizontal: 16,
}}>
```

### Card Rules

- Border radius: `12px` (input/button), `16–20px` (card).
- Shadow: chỉ cho card nổi bật, opacity `0.06`, không lạm dụng.
- Android: thêm `elevation: 3` tương đương shadow.
- Card padding: `16–20px` tùy nội dung density.
- Không biến tất cả nội dung thành card. Chỉ dùng khi cần grouping.

---

## 11. List Design

### Menu Item Pattern (Current Implementation)

```tsx
<Pressable style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]} onPress={...}>
  <View>
    <Text style={styles.menuTitle}>Đổi mật khẩu</Text>
    <Text style={styles.menuDescription}>Cập nhật thông tin bảo mật</Text>
  </View>
  <Text style={styles.chevron}>›</Text>
</Pressable>
```

### Menu Item Styling

| Element | Style |
|---------|-------|
| Container | `minHeight: 68px`, `backgroundColor: #fff`, `borderWidth: 1`, `borderColor: #e2e8f0`, `borderRadius: 16px`, `paddingHorizontal: 16px`, `flexDirection: 'row'`, `alignItems: 'center'`, `justifyContent: 'space-between'` |
| Title | `color: #0f172a`, `fontSize: 14px`, `fontWeight: '700'` |
| Description | `color: #64748b`, `fontSize: 12px`, `marginTop: 3px` |
| Chevron | `color: #94a3b8`, `fontSize: 28px`, `fontWeight: '300'` |
| Pressed | `opacity: 0.78` |

### Rules for FlatList/SectionList (Future Implementation)

- List dài phải dùng `FlatList`, không `map` trong `ScrollView`.
- List item nên có: Leading (icon/avatar), Title, Subtitle (optional), Trailing (chevron/badge).
- Separator: `borderHeight: 1`, `backgroundColor: #f1f5f9`.
- Pressed state: `opacity: 0.78` hoặc background highlight.

---

## 12. Header / App Bar

### Auth Screen Header Pattern

```
Logo (centered, large)
└─ Eyebrow (uppercase, primary color, small)
└─ Title (large, bold)
└─ Description (muted, smaller)
```

### Home Screen Header Pattern

```
┌─ Greeting + Name (left) ──────┐
│ Xin chào,                      │
│ Nguyễn Văn A                   │
│              [Avatar 52×52]    │
└────────────────────────────────┘
```

### Rules

- Auth screens: Logo + centered header, eyebrow → title → description.
- Home screens: Row layout, greeting left, avatar right.
- Screen title: `fontSize: 24–30px`, `fontWeight: '800'`, `color: #0f172a`.
- Eyebrow: `fontSize: 10–11px`, `fontWeight: '800'`, `letterSpacing: 1.2–1.4`, `color: #2563eb`.
- Không đặt quá nhiều action trên header mobile.
- Header phải hỗ trợ Safe Area (via `SafeAreaView`).

---

## 13. Modal & Bottom Sheet

### Current Implementation Status

**Chưa có modal/bottom sheet implementation trong current codebase.**

### Guidelines (For Future Implementation)

#### When to use Modal

- Confirm critical actions (delete, logout confirmation).
- Short forms (< 5 fields).
- Quick display (terms, info).

#### When to use Bottom Sheet

- Quick actions (menu, filter, select).
- Contextual actions.
- Medium forms (5–8 fields).

#### When to use Full Screen

- Long forms (> 8 fields).
- Complex workflows.
- Multi-step processes.

### Rules

- Không dùng modal cho form quá dài.
- Mobile ưu tiên bottom sheet cho contextual actions.
- Full screen cho complex workflows.
- Future implementation should use library like `react-native-bottom-sheet` or `@gorhom/bottom-sheet`.

---

## 14. Loading State

### Loading Patterns

#### Screen Loading (Initial)

```tsx
<SafeAreaView style={center}>
  <Logo large />
  <ActivityIndicator color="#2563eb" size="large" />
  <Text style={muted}>Đang kết nối hệ thống…</Text>
</SafeAreaView>
```

- Centered layout.
- Logo + spinner + descriptive text.
- Không để màn hình trắng khi loading.

#### Button Loading

```tsx
<PrimaryButton label="Đăng nhập" loading={busy} disabled={busy} onPress={submit} />
```

- Spinner thay thế text trong button.
- Disable button khi loading.
- Chống submit nhiều lần.

#### Rules

- Không dùng loading spinner toàn màn hình cho mọi tình huống.
- Button loading: spinner + disabled.
- Initial loading: logo + spinner + message.
- Hiển thị descriptive loading message (tiếng Việt, user-friendly).

---

## 15. Empty State

### Empty State Pattern (Connection Error Example)

```tsx
<SafeAreaView style={center}>
  <View style={errorIcon}>
    <Text style={errorIconText}>!</Text>
  </View>
  <Text style={stateTitle}>Không thể kết nối</Text>
  <Text style={stateMessage}>{message}</Text>
  <PrimaryButton label="Thử kết nối lại" onPress={onRetry} />
</SafeAreaView>
```

### Empty State Styling

| Element | Style |
|---------|-------|
| Icon container | `width: 56px`, `height: 56px`, `borderRadius: 28`, `backgroundColor: #fee2e2`, centered |
| Icon text | `color: #dc2626`, `fontSize: 28px`, `fontWeight: '800'` |
| Title | `color: #0f172a`, `fontSize: 22px`, `fontWeight: '800'`, `textAlign: 'center'` |
| Description | `color: #64748b`, `fontSize: 14px`, `lineHeight: 21`, `textAlign: 'center'`, `marginTop: 8px`, `marginBottom: 24px`, `maxWidth: 340px` |
| Action | Primary button below description |

### Rules

- Empty state phải có: Icon/Illustration → Title → Description → CTA (nếu cần).
- Message tiếng Việt, user-friendly.
- Luôn có action (retry, go back, add new).
- Centered layout cho error/empty states.

---

## 16. Error State

### Error Display Pattern

```tsx
{error && <ErrorBanner message={error} />}
```

### Error Banner Styling

| Property | Value |
|----------|-------|
| Background | `#fef2f2` |
| Border | `1px solid #fecaca` |
| Border Radius | `12px` |
| Padding | `12px` |
| Text Color | `#b91c1c` |
| Font Size | `13px` |
| Line Height | `19px` |

### Rules

- **Không hiển thị technical errors:** `500`, `Network Error`, `Request failed`, `AxiosError`.
- **Hiển thị ngôn ngữ user-friendly:** "Không thể tải danh sách nhân viên. Vui lòng kiểm tra kết nối và thử lại."
- Error banner hiển thị inline trên form (dưới header, trên fields).
- Validation errors: inline dưới field (future enhancement).
- Luôn có retry action cho network errors.

---

## 17. Icon System

### Current Icon Approach

**Project hiện tại KHÔNG dùng icon library.** Đang dùng:

- **Text-based icons:** Logo letter `"C"`, avatar initials `"NV"`, chevron `›`.
- **Emoji/symbols:** Exclamation mark `!` for error icons.
- **No external icon library installed.**

### Icon Styling

| Element | Size | Weight | Color | Usage |
|---------|------|--------|-------|-------|
| Logo letter | `18px` (default), `32px` (large) | `800` | `#fff` | Brand logo |
| Avatar initials | `17px` | `800` | `#1d4ed8` | User avatar |
| Error icon | `28px` | `800` | `#dc2626` | Error state |
| Chevron | `28px` | `300` | `#94a3b8` | Navigation indicator |

### Rules (For Future)

- Nếu thêm icon library, chọn một và dùng nhất quán (ví dụ: `@expo/vector-icons`).
- Không mix nhiều icon library.
- Icon sizes: `16px`, `20px`, `24px`, `28px` theo context.
- Icon button phải có `accessibilityLabel`.
- Không dùng emoji làm icon UI production nếu sẽ có icon library.

---

## 18. Images & Avatar

### Avatar Pattern

```tsx
<View style={{
  width: 52,
  height: 52,
  borderRadius: 18,
  backgroundColor: '#dbeafe',
  alignItems: 'center',
  justifyContent: 'center',
}}>
  <Text style={{ color: '#1d4ed8', fontSize: 17, fontWeight: '800' }}>
    {initials}
  </Text>
</View>
```

### Avatar Rules

- Size: `52×52px` (home screen).
- Border radius: `18px` (near circular).
- Background: `#dbeafe` (light blue), text: `#1d4ed8` (dark blue).
- Initials: lấy từ `fullName`, split by whitespace, take last 2 characters, uppercase.
- Fallback: `"NV"` nếu không có name.
- Future: Khi có image, dùng `Image` component với fallback initials.
- Ảnh phải có loading state và fallback.

---

## 19. Border Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `radius.sm` | `8px` | Ít dùng |
| `radius.md` | `12px` | Input, Button, Error banner, Success banner |
| `radius.lg` | `16px` | Profile card, Menu row, List items |
| `radius.xl` | `18px` | Avatar (near circle) |
| `radius[2]xl` | `20px` | Auth card, Shift card, Dark card |

### Rules

- Không dùng radius ngẫu nhiên như `13px`, `17px`, `23px`.
- Input/Button: `12px` (consistent).
- Card: `16–20px` tùy importance.
- Avatar: `18px` (near circle).
- Giữ consistency: cùng loại element = cùng radius.

---

## 20. Shadow / Elevation

### Shadow Tokens

| Element | shadowColor | shadowOpacity | shadowRadius | shadowOffset | elevation |
|---------|-------------|---------------|--------------|--------------|-----------|
| Auth card | `#0f172a` | `0.06` | `18` | `{0, 8}` | `3` |

### Rules

- Shadow chỉ dùng cho card nổi bật (auth card).
- Shadow nhẹ: opacity `0.06`, không dùng shadow mạnh.
- Android: `elevation: 3` tương đương shadow.
- Không lạm dụng shadow. Hầu hết card dùng border thay vì shadow.
- Floating action button (future): shadow nhẹ, offset `{0, 4}`.

---

## 21. Safe Area

### Safe Area Implementation

```tsx
<SafeAreaView style={styles.safeArea}>
  {/* App content */}
</SafeAreaView>
```

### Safe Area Styling

| Property | Value |
|----------|-------|
| `flex` | `1` |
| `backgroundColor` | `#f6f8fc` |

### Rules

- Root wrapper luôn `SafeAreaView`.
- Không để content/button sát đáy màn hình.
- paddingBottom trên home content: `40px` (account for home indicator).
- StatusBar: `<StatusBar style="dark" />` (dark icons on light background).
- Chú ý: Notch, Dynamic Island, Status bar, Home indicator.

---

## 22. Scrolling

### Scrolling Rules

- Auth screens: `ScrollView` với `contentContainerStyle` cho padding.
- Home screen: `ScrollView` với `flex: 1` container.
- Không nested `ScrollView` nếu không cần thiết.
- List dài (future): dùng `FlatList`, không `map` trong `ScrollView`.
- `keyboardShouldPersistTaps="handled"` trên auth screens.
- Scroll padding: `horizontal: 22px`, `top: 42px`, `bottom: 32px` (auth).

### FlatList Guidelines (Future Implementation)

- Dùng `FlatList` cho list > 10 items.
- renderItem phải memoized (`React.memo`).
- KeyExtractor trả về unique id.
- Enable `pullToRefresh` nếu cần.
- Pagination: load thêm khi gần cuối list.

---

## 23. Accessibility

### Requirements

- Đủ contrast: text color vs background color tuân thủ WCAG AA.
- Touch target đủ lớn: min `44×44px` (current: `48–50px` for buttons, `68px` for menu rows).
- `accessibilityRole="button"` cho tất cả interactive elements.
- `accessibilityLabel` cho icon buttons (future).
- Không dùng màu là tín hiệu duy nhất (kết hợp icon/text cho status).
- Text scaling không làm vỡ layout (lineHeight linh hoạt).
- Screen reader friendly: semantic structure, role attributes.

### Current Accessibility

| Element | Accessibility |
|---------|---------------|
| Buttons | `accessibilityRole="button"` |
| Error banners | `accessibilityRole="alert"` |
| Inputs | Native accessibility (TextInput) |
| Links | Native accessibility (Pressable) |

---

## 24. Mobile Navigation Pattern

### Current Navigation (Screen-based)

```
App Root
├─ login (LoginScreen)
├─ forgot (ForgotScreen)
├─ reset (ResetScreen)
├─ change-password (ChangePasswordScreen)
└─ home (EmployeeHome)
```

### Navigation Flow

```
Login → [Successful] → Home
              ↓
      [mustChangePassword]
              ↓
      Change Password → Home

Login → [Forgot] → Forgot → [Sent] → Reset → [Done] → Login

[Home] → [Logout] → Login
[Home] → [Change Password] → Change Password → Home
```

### Navigation Rules

- Current implementation: state-based navigation (not router).
- Each screen is a component rendered conditionally.
- Clear back navigation: screens có `onBack` prop.
- Auth flow: linear, không nested.
- Future: Nếu dùng Expo Router, define clear route structure.

### Route Protection

- Logged-in user → skip login, go directly to home/change-password.
- Not logged-in → redirect to login.
- Session expired → clear session, redirect to login.
- Non-employee role → show message, force logout.

---

## 25. Screen Types

### A. Auth Screen (Login, Forgot, Reset, Change Password)

**Layout:**
```
SafeAreaView
└── KeyboardAvoidingView
    └── ScrollView
        ├── Logo (centered)
        ├── Header
        │   ├── Eyebrow
        │   ├── Title
        │   └── Description
        └── Card
            ├── Error Banner (optional)
            ├── Fields (3–5 inputs)
            ├── Links (forgot password, etc.)
            ├── Primary Button (submit)
            └── Secondary Button (optional, cancel/back)
        └── Footer (security note)
```

**Components:** Logo, Eyebrow, Field, PrimaryButton, SecondaryButton, ErrorBanner, SuccessBanner, Pressable (links)

**Notes:** Full-width buttons, centered layout, keyboard-aware.

### B. Home Screen (Employee Dashboard)

**Layout:**
```
ScrollView
├── Header Row (Greeting + Avatar)
├── Status/Shift Card (dark theme)
├── Section Title
├── Profile Card (info rows)
├── Menu Items (list of Pressable rows)
└── Bottom Actions (secondary button)
```

**Components:** Avatar, InfoRow, MenuRow, PrimaryButton, SecondaryButton, StatusPill

**Notes:** Scrollable, no fixed header, avatar right-aligned.

### C. Error/Empty Screen (Connection Error)

**Layout:**
```
SafeAreaView (centered)
├── Icon Container (circle, colored)
├── Title
├── Description
└── Primary Button (action)
```

**Components:** ErrorIcon, Title, Description, PrimaryButton

**Notes:** Centered, minimal, action-oriented.

---

## 26. Sticky Bottom Action

### Current Implementation

**Chưa có sticky bottom action trong current codebase.**

Buttons đều nằm trong scroll flow.

### Guidelines (For Future Implementation)

#### When to use sticky bottom action

- Long forms (> 8 fields).
- Multi-section forms.
- Confirmation screens with summary.

#### Pattern

```
ScrollView (content, scrollable)
└── Sticky Bottom Bar
    ├── Divider/shadow nhẹ
    ├── Hủy (secondary, left)
    └── Lưu (primary, right)
```

### Rules

- Bottom bar phải trên safe area.
- Không bị keyboard che (KeyboardAvoidingView handles this).
- Có divider hoặc shadow nhẹ để tách khỏi content.
- Full-width trên mobile.

---

## 27. Search & Filter

### Current Implementation Status

**Chưa có search/filter trong current codebase.**

### Guidelines (For Future Implementation)

#### Search Bar Pattern

```
┌─ [Search icon] [Placeholder...] [Clear ×] ─┐
│  backgroundColor: #fff                     │
│  borderWidth: 1, borderColor: #cbd5e1     │
│  borderRadius: 12px                        │
│  paddingHorizontal: 14px                   │
│  height: 44–48px                           │
└────────────────────────────────────────────┘
```

#### Filter Pattern

- Filter mobile nên dùng Bottom Sheet.
- Hiển thị active filter bằng chip/badge.
- Debounce search nếu gọi API (không search mỗi keystroke).

### Rules

- Không search mỗi keystroke nếu backend nặng.
- Filter dùng bottom sheet, không popup dropdown.
- Clear button trên search bar khi có input.

---

## 28. Status Badge

### Current Implementation

**Chưa có status badge component trong current codebase.**

Current: Status hiển thị qua text + visual indicators (status pill với dot).

### Status Pill Pattern (Shift Card Example)

```tsx
<View style={{
  alignSelf: 'flex-start',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 7px,
  backgroundColor: 'rgba(255,255,255,0.1)',
  borderRadius: 999,
  paddingHorizontal: 10px,
  paddingVertical: 7px,
}}>
  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80' }} />
  <Text style={{ color: '#e2e8f0', fontSize: 11, fontWeight: '700' }}>
    Tài khoản đang hoạt động
  </Text>
</View>
```

### Guidelines (For Future Status Badge)

| Status | Background | Text Color | Dot Color |
|--------|------------|------------|-----------|
| Active | `#f0fdf4` | `#166534` | `#4ade80` (green) |
| Pending | `#fffbeb` | `#92400e` | `#f59e0b` (amber) |
| Inactive | `#f8fafc` | `#64748b` | `#94a3b8` (gray) |
| Rejected | `#fef2f2` | `#b91c1c` | `#dc2626` (red) |
| Completed | `#f0fdf4` | `#166534` | `#22c55e` (green) |

### Rules

- Status phải có: background nhẹ, text rõ, semantic color.
- Không dùng màu quá gắt.
- Không chỉ dựa vào màu để phân biệt trạng thái (thêm icon/text).
- Pill shape: `borderRadius: 999` (fully rounded).

---

## 29. Responsive / Adaptive

### Current Implementation

**Current app là mobile-only (React Native + Expo).** Không có responsive breakpoints như web.

### Guidelines

- Không hard-code width dựa trên một thiết bị.
- Dùng `flex`, `padding`,百分比 (nếu applicable).
- Tránh `width: 390` chỉ để fit một screenshot.
- Test trên nhiều device sizes (small phone, standard, large).
- Dùng `Dimensions` API khi thực sự cần.

### Tablet Considerations (Future)

- Nếu support tablet: dùng `maxWidth` cho content container.
- Grid layouts chuyển từ 1 column → 2 columns.
- Navigation vẫn giữ mobile pattern.

---

## 30. Animation

### Current Animation

**Current implementation không có animation.** Chỉ dùng opacity change cho pressed state.

### Guidelines (For Future)

#### Approved animations

- Pressed feedback: instant opacity change (current pattern).
- Modal transition: slide up/fade in.
- Bottom sheet: spring animation.
- Skeleton: shimmer effect.
- Expand/collapse: height transition.

#### Avoid

- Không thêm animation thừa gây chậm app.
- Không animate những thứ không cần thiết.
- Performance-first: animation phải smooth (60fps).

### Rules

- Animation chỉ dùng để tăng UX.
- Simple là best: opacity, transform.
- Avoid heavy layout animations.
- Use `Reanimated` library for complex animations.

---

## 31. Performance Rules

### Guidelines

- List dài: dùng `FlatList`, không `map` trong `ScrollView`.
- Memoize expensive components: `React.memo`.
- Image optimization: resize, cache, lazy load.
- Pagination: load thêm khi cần, không render hàng trăm items.
- Tránh rerender toàn screen: split components, use context wisely.
- Lazy load routes/screens (nếu dùng router).

### Current Performance

- Small app, minimal performance concerns.
- All screens render inline (no routing overhead).
- Future: optimize when lists grow.

---

## 32. Design Consistency Rule

### Before Creating New Component

1. **Tìm component tương tự** trong project.
2. **Nếu có**, tái sử dụng.
3. **Nếu thiếu feature**, mở rộng component.
4. **Chỉ tạo component mới** nếu thực sự khác biệt.

### Do NOT duplicate

- Button (use `PrimaryButton`, `SecondaryButton`)
- Input (use `Field` component)
- Modal/BottomSheet (implement when needed, use library)
- Header (follow pattern per screen type)
- Card (use consistent styling)
- Badge (implement when needed, use consistent pattern)
- Toast/Snackbar (implement when needed)

---

## 33. Anti-Patterns

### ❌ Cấm nghiêm trọng

- Hard-code random color (phải dùng token).
- Hard-code random spacing (13px, 17px, 23px).
- Inline style quá nhiều (phải extract to StyleSheet).
- One-screen-one-design (phải reuse components).
- Desktop UI thu nhỏ (mobile phải tối ưu riêng).
- Modal quá dài (form dài → full screen).
- Nested ScrollView (gây performance issues).
- Tiny touch target (< 44×44px).
- Placeholder thay label (label phải luôn hiển thị).
- Technical error message (500, Network Error, AxiosError).
- One-screen-one-component (1000+ dòng code trong 1 file).
- Duplicate UI component (tạo Button mới thay vì reuse).
- Mix nhiều design style (giữ consistency).
- Button không có pressed/loading/disabled state.

### ⚠️ Hạn chế tối đa

- Animation thừa (chỉ khi cải thiện UX).
- Shadow mạnh (chỉ dùng subtle shadow).
- Card overload (không biến tất cả thành card).
- Nested navigation rối (giữ flow đơn giản).
- Search mỗi keystroke (debounce nếu gọi API).

---

## 34. Screen Implementation Checklist

Mỗi screen mới phải kiểm tra:

- [ ] Có `SafeAreaView` wrapper
- [ ] Header đúng chuẩn (theo screen type)
- [ ] Padding đúng design system (horizontal: 22px)
- [ ] Typography đúng (titles: 800, labels: 700, body: 600–700)
- [ ] Không hard-code màu (dùng token từ StyleSheet)
- [ ] Không hard-code spacing ngẫu nhiên
- [ ] Component reusable (PrimaryButton, Field, Card)
- [ ] Loading state (initial + button loading)
- [ ] Empty state (nếu applicable)
- [ ] Error state (banner + retry)
- [ ] Keyboard handling (KeyboardAvoidingView + ScrollView)
- [ ] Mobile responsive (không hard-code device width)
- [ ] Touch target đủ lớn (buttons: 48–50px, menu: 68px)
- [ ] Form validation rõ ràng (labels, errors, keyboardType)
- [ ] iOS/Android đều không vỡ UI (test trên cả 2 platforms)
- [ ] Accessibility: `accessibilityRole` cho interactive elements

---

## 35. Form Checklist

Mỗi form phải kiểm tra:

- [ ] Required field có `*` indicator
- [ ] Error nằm dưới field hoặc banner trên form
- [ ] Error dùng ngôn ngữ người dùng (tiếng Việt, không technical)
- [ ] keyboardType phù hợp (email-address, phone-pad, numeric)
- [ ] Button loading state
- [ ] Chống submit nhiều lần (disabled khi loading)
- [ ] Keyboard không che field (KeyboardAvoidingView)
- [ ] Keyboard không che submit (ScrollView + keyboardShouldPersistTaps)
- [ ] Invalid field có visual state (borderColor: error color)
- [ ] Focus hợp lý (autoFocus trên first field nếu cần)
- [ ] Label luôn hiển thị (không placeholder thay label)
- [ ] AutoCapitalize/AutoCorrect phù hợp

---

## 36. Component Checklist

Mỗi reusable component phải có:

- [ ] Purpose rõ ràng (docstring/comments)
- [ ] Props interface defined (TypeScript types)
- [ ] States: default, pressed, disabled, loading
- [ ] Size consistent với design system
- [ ] Spacing consistent với design system
- [ ] Typography consistent với design system
- [ ] Accessibility: `accessibilityRole`, `accessibilityLabel`
- [ ] Usage example trong documentation
- [ ] Tested trên iOS và Android

---

## 37. File Structure Recommendation

### Current Structure

```
Apps/mobile/
├── App.tsx                    # All screens + components (single file)
├── index.ts                   # Entry point
├── package.json
├── tsconfig.json
├── assets/                    # Icons, splash images
│   ├── icon.png
│   ├── splash-icon.png
│   └── ...
└── src/
    ├── auth.ts                # Auth API functions + types
    └── config.ts              # API configuration
```

### Recommended Structure (Future Enhancement)

```
Apps/mobile/
├── app/                       # Expo Router (if migrating)
│   ├── (auth)/
│   │   ├── login.tsx
│   │   ├── forgot.tsx
│   │   └── reset.tsx
│   ├── (app)/
│   │   ├── index.tsx          # Home screen
│   │   └── profile.tsx
│   └── _layout.tsx
│
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx     # PrimaryButton, SecondaryButton
│   │   │   ├── Field.tsx      # TextInput wrapper
│   │   │   ├── Card.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Banner.tsx     # ErrorBanner, SuccessBanner
│   │   ├── feedback/
│   │   │   ├── Loading.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── ErrorState.tsx
│   │   └── navigation/
│   │       ├── Avatar.tsx
│   │       └── StatusPill.tsx
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── screens/
│   │   │   ├── components/
│   │   │   └── services/
│   │   └── employee/
│   │       ├── screens/
│   │       ├── components/
│   │       └── services/
│   │
│   ├── theme/
│   │   ├── colors.ts          # All color tokens
│   │   ├── spacing.ts         # Spacing scale
│   │   ├── typography.ts      # Font tokens
│   │   └── radius.ts          # Border radius scale
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   └── useLoading.ts
│   │
│   ├── services/
│   │   ├── api.ts             # Base API client
│   │   └── auth.ts            # Auth API (move from src/auth.ts)
│   │
│   ├── utils/
│   │   ├── validators.ts
│   │   └── helpers.ts
│   │
│   └── types/
│       └── index.ts           # Global types
│
├── assets/
│   ├── icons/
│   ├── images/
│   └── fonts/
│
├── App.tsx                    # Root (if not using Expo Router)
└── index.ts
```

### Migration Notes

- Không ép đổi architecture nếu current structure hoạt động tốt.
- Khi app complexity tăng, refactor từng phần.
- Extract components trước, sau đó chia features.
- Expo Router chỉ khi cần deep linking/hydrated navigation.

---

## 38. Design Tokens

### Color Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#2563eb` | Buttons, links, eyebrow, active states |
| `primary-dark` | `#1d4ed8` | Avatar text, strong emphasis |
| `bg.default` | `#f6f8fc` | Screen background |
| `bg.surface` | `#ffffff` | Card, input background |
| `bg.dark` | `#172554` | Dark theme cards |
| `bg.divider` | `#f1f5f9` | Divider lines |
| `bg.border` | `#e2e8f0` | Card/input borders |
| `bg.border-light` | `#cbd5e1` | Input default border |
| `bg.border-danger` | `#fecaca` | Error borders |
| `bg.success-bg` | `#f0fdf4` | Success banner bg |
| `bg.success-border` | `#bbf7d0` | Success banner border |
| `bg.info-bg` | `#eff6ff` | Info notice bg |
| `bg.info-border` | `#bfdbfe` | Info notice border |
| `bg.error-bg` | `#fef2f2` | Error banner bg |
| `text.primary` | `#0f172a` | Titles, body, values |
| `text.secondary` | `#334155` | Labels |
| `text.muted` | `#64748b` | Descriptions |
| `text.quaternary` | `#94a3b8` | Placeholder, chevron |
| `text.link` | `#2563eb` | Links |
| `text.white` | `#ffffff` | On dark backgrounds |
| `success.text` | `#166534` | Success text |
| `success.dot` | `#4ade80` | Active status dot |
| `danger.text` | `#dc2626` | Error/danger text |
| `danger.banner` | `#b91c1c` | Error banner text |
| `info.text` | `#1e40af` | Info notice text |

### Spacing Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `spacing.xs` | `7–8px` | Label-input gap, small gaps |
| `spacing.sm` | `12px` | Banner padding |
| `spacing.md` | `16px` | Card padding, section gap |
| `spacing.lg` | `20px` | Card internal padding |
| `spacing.xl` | `22px` | Page horizontal padding |
| `spacing[2]xl` | `24px` | Section gap |
| `spacing[3]xl` | `28–32px` | Center padding, auth bottom |
| `spacing[4]xl` | `40–42px` | Auth top padding |

### Typography Tokens

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `eyebrow` | `10–11px` | `800` | Section labels, badges |
| `title.large` | `28–30px` | `800` | Screen titles, brand |
| `title.medium` | `22–24px` | `800` | Page headers, user name |
| `title.small` | `20px` | `800` | Card titles |
| `body.large` | `15px` | `800` | Button text |
| `body` | `14px` | `600–700` | Body, values, menu titles |
| `body.small` | `13px` | `600–700` | Labels, links, helpers |
| `caption` | `11–12px` | `700` | Notes, field actions |

### Radius Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `radius.md` | `12px` | Input, button, banner |
| `radius.lg` | `16px` | Profile card, menu row |
| `radius.xl` | `18px` | Avatar |
| `radius[2]xl` | `20px` | Auth card, shift card |

---

## 39. Component Master Table

| Component | Purpose | Variants | Usage |
|-----------|---------|----------|-------|
| `PrimaryButton` | Main CTA | Default, Loading, Disabled | Submit forms, main actions |
| `SecondaryButton` | Alternative actions | Default, Danger, Loading, Disabled | Cancel, logout, back |
| `Field` | Form input wrapper | Text, Password, Email, Phone | All form inputs |
| `Card` | Content grouping | White, Dark, Compact | Form containers, info blocks |
| `ErrorBanner` | Error display | Error, Success, Info | Form errors, API errors |
| `Logo` | Brand identity | Default, Large | Auth screens, loading |
| `Avatar` | User identification | Initials, Image (future) | Home header, list items |
| `InfoRow` | Key-value display | Default | Profile info, details |
| `StatusPill` | Status indicator | Active, Pending, Inactive (future) | Shift status, record status |
| `MenuRow` | Navigation item | Default with Chevron | Settings, action lists |

### Component Props Standard

#### PrimaryButton

```tsx
interface PrimaryButtonProps {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}
```

#### SecondaryButton

```tsx
interface SecondaryButtonProps {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onPress: () => void;
}
```

#### Field

```tsx
interface FieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  action?: string;
  onAction?: () => void;
}
```

---

## 40. Screen Master Table

| Screen Type | Layout | Main Components | Notes |
|-------------|--------|-----------------|-------|
| Auth (Login, Forgot, Reset, Change Password) | Centered + Card | Logo, Field, PrimaryButton, SecondaryButton, ErrorBanner | Full-width buttons, keyboard-aware, centered |
| Home (Employee Dashboard) | Scrollable list | Avatar, ShiftCard, InfoRow, MenuRow, SecondaryButton | Scrollable, no fixed header, avatar right |
| Error/Empty | Centered minimal | Icon, Title, Description, PrimaryButton | Minimal, action-oriented, retry |

---

## 41. Current UI Inconsistencies & Recommendations

### Issues Found

1. **Single file architecture**: `App.tsx` chứa tất cả screens + components (~300+ lines). Khi app phát triển, khó maintain.
   - **Recommendation**: Tách components ra files riêng khi số lượng screens > 5.

2. **No status badge component**: Status hiển thị inline (status pill trong shift card) nhưng không reusable.
   - **Recommendation**: Tạo `StatusBadge` component khi có nhiều status cần display.

3. **No icon library**: Đang dùng text-based icons (`›`, `!`, `"C"`).
   - **Recommendation**: Thêm `@expo/vector-icons` khi cần nhiều icons.

4. **No navigation library**: State-based navigation trong `App.tsx`.
   - **Recommendation**: Cân nhắc Expo Router khi cần deep linking/handle back button.

5. **No toast/snackbar**: Error hiển thị qua banner inline, không có global toast.
   - **Recommendation**: Tạo `Toast` component khi có nhiều async actions cần feedback.

6. **No form validation visual state**: Error hiển thị banner trên form, không có field-level error styling.
   - **Recommendation**: Thêm `error` prop vào `Field` component để highlight border.

7. **No dark mode support**: App chỉ có light theme.
   - **Recommendation**: Nếu cần, implement dark mode tokens trong `theme/colors.ts`.

8. **Inconsistent radius**: Card dùng `20px`, profile card dùng `16px`, menu row dùng `16px`.
   - **Recommendation**: Chuẩn hóa: important card = `20px`, regular card = `16px`.

### Priority Order for Fixes

1. **High**: Extract components (maintainability).
2. **High**: Add field-level error styling (UX).
3. **Medium**: Add status badge component (consistency).
4. **Medium**: Add toast notification (feedback).
5. **Low**: Add icon library (visual polish).
6. **Low**: Add dark mode (nice-to-have).

---

## 42. Quick Reference: Common Patterns

### Create New Screen

```tsx
function NewScreen({ onBack }: { onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 22, paddingTop: 42, paddingBottom: 32, gap: 16 }}>
          
          {/* Header */}
          <View style={{ marginBottom: 22 }}>
            <Text style={eyebrow}>EYEBROW</Text>
            <Text style={titleLarge}>Screen Title</Text>
            <Text style={description}>Description</Text>
          </View>

          {/* Card */}
          <View style={authCard}>
            {error && <ErrorBanner message={error} />}
            
            <Field label="Field Label" value="" onChangeText={() => {}} />
            
            <PrimaryButton label="Submit" loading={busy} disabled={busy} onPress={submit} />
            <SecondaryButton label="Back" onPress={onBack} />
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

### Form Field Template

```tsx
<Field 
  label="Email đăng nhập"
  value={email}
  onChangeText={setEmail}
  placeholder="ten@congty.vn"
  keyboardType="email-address"
  autoCapitalize="none"
  editable={!busy}
/>
```

### Button Template

```tsx
<PrimaryButton 
  label="Lưu thay đổi"
  loading={busy}
  disabled={busy}
  onPress={handleSubmit}
/>

<SecondaryButton 
  label="Hủy" 
  onPress={handleCancel} 
  disabled={busy}
/>

<SecondaryButton 
  label="Xóa" 
  onPress={handleDelete} 
  danger
/>
```

---

## 43. Glossary (Vietnamese → English)

| Vietnamese | English | Usage |
|------------|---------|-------|
| Đăng nhập | Login | Auth screen |
| Đăng xuất | Logout | Home screen |
| Quên mật khẩu | Forgot password | Auth flow |
| Đặt lại mật khẩu | Reset password | Auth flow |
| Đổi mật khẩu | Change password | Account management |
| Mã nhân viên | Employee code | User info |
| Nhân viên | Employee | Role |
| Hồ sơ | Profile/Record | Data entity |
| Danh sách | List | View type |
| Thêm | Add | Action |
| Sửa | Edit | Action |
| Xóa | Delete | Action |
| Lưu | Save | Action |
| Hủy | Cancel | Action |
| Tiếp tục | Continue | Action |
| Thử lại | Retry | Action |
| Hoạt động | Active | Status |
| Chờ xử lý | Pending | Status |
| Không hoạt động | Inactive | Status |

---

## 44. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-09-16 | AI Assistant | Initial creation based on `Apps/mobile/App.tsx` analysis |

---

> **End of Mobile Design Master**  
> Use this document as the single source of truth for all mobile UI/UX decisions in CoreStaff Mobile.
