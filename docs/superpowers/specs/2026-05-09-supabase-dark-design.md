# Supabase Dark Theme — Design Spec

**Date:** 2026-05-09  
**Source:** [Supabase DESIGN.md](https://getdesign.md/supabase/design-md) from awesome-design-md  
**Scope:** Restyle existing components with Supabase dark theme. Layout structure unchanged.

## Design Tokens

### Colors

| Token | Value | CSS Variable | Usage |
|-------|-------|-------------|-------|
| Primary | `#3ecf8e` | `--color-primary` | Active tabs, primary buttons, status dot, accent borders |
| Canvas | `#1c1c1c` | `--color-canvas` | Card backgrounds, header, nav |
| Canvas Soft | `#202020` | `--color-canvas-soft` | Main content area background |
| Log BG | `#0d0d0d` | `--color-log-bg` | Log stream terminal background |
| Text Primary | `#ffffff` | `--color-text` | Headings, body text |
| Text Muted | `#9a9a9a` | `--color-text-muted` | Secondary text, labels, placeholders |
| Border | `#333333` | `--color-border` | Card borders, dividers |
| Accent Purple | `#6b01c2` | `--color-accent` | Reserved for future use |

Status colors (semantic):
- Success/Active: `#3ecf8e` (primary green)
- Warning: `#ffdb13` (yellow)
- Error/Disconnected: `#ff2201` (tomato)
- Inactive/Neutral: `#707070` (ink-mute)

### Typography

Font family: `Inter, system-ui, -apple-system, sans-serif`  
Monospace: `ui-monospace, Menlo, Monaco, Consolas, monospace`

| Level | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| Heading LG | 18px | 600 | 1.2 | Page title |
| Heading MD | 15px | 600 | 1.2 | Card titles |
| Body MD | 14px | 400/500 | 1.5 | Card content, form labels |
| Body SM | 13px | 400 | 1.45 | Secondary text, tab labels |
| Caption | 12px | 400 | 1.45 | Metadata, timestamps |
| Micro | 11px | 400 | 1.45 | Badges, tags, log entries |

### Spacing (Tailwind compatible)

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Gap between inline items |
| sm | 8px | Card list gap |
| md | 12px | Internal padding |
| lg | 16px | Card padding |
| xl | 24px | Section padding |
| xxl | 32px | Large section spacing |

### Rounded Corners

| Token | Value | Usage |
|-------|-------|-------|
| sm | 6px | Buttons, inputs, tabs |
| md | 8px | Small cards, code blocks |
| lg | 12px | Cards |
| full | 9999px | Pills, badges, status tags |

## Component Specifications

### 1. Dashboard Page (`tabs/dashboard.tsx`)

**Header bar:**
- bg: canvas `#1c1c1c`, border-bottom: 1px `#333`
- Title: 16px, weight 600, color white, letter-spacing -0.3px
- Connection dot: 7px diameter, `#3ecf8e` with `box-shadow: 0 0 6px #3ecf8e88` (glow effect)
- Connection label: 12px, color `#9a9a9a`

**Navigation tabs:**
- Active: bg `#3ecf8e`, text `#171717` (dark), rounded 6px, weight 500, 13px
- Inactive: text `#9a9a9a`, transparent bg
- "+ New Task" button: same as active tab, right-aligned

**Main content area:**
- bg: canvas-soft `#202020`, padding 24px

### 2. Task List (`dashboard/task-list.tsx`)

**Task card:**
- bg: canvas `#1c1c1c`, border: 1px `#333`, rounded: 12px, padding: 16px 20px
- Route name: 14px, weight 500, color white
- Date/metadata: 12px, color `#9a9a9a`
- Status dot: 6px, glow effect for active
- Active task: green dot + green text "监控中"
- Inactive task: `#707070` dot + text, reduced opacity
- Hover: subtle border lightening
- Gap between cards: 8px

**Empty state:**
- Centered text, color `#9a9a9a`, 14px

### 3. Solution Board (`dashboard/solution-board.tsx`)

**Solution card:**
- bg: canvas `#1c1c1c`, border: 1px `#333`, rounded: 12px, padding: 20px
- Available solution: green border tint `#3ecf8e44`
- Train number: 18px, weight 600, color white
- Plan type badge: pill (rounded full), bg `#202020`, border 1px `#333`, 11px, color `#9a9a9a`
- Ticket status badge:
  - 可购 (available): pill, bg `#3ecf8e22`, color `#3ecf8e`
  - 已售 (sold): pill, bg `#ff220122`, color `#ff2201`
  - 待定 (pending): pill, bg `#70707022`, color `#9a9a9a`
- Price: 20px, weight 600, color `#3ecf8e` (primary)
- Segment info: separated by border-top 1px `#333`, 13px, color `#9a9a9a`

**Empty state:**
- "请选择一个任务查看方案", centered, color `#9a9a9a`

### 4. Log Stream (`dashboard/log-stream.tsx`)

**Log container:**
- bg: log-bg `#0d0d0d`, rounded: 8px, padding: 12px
- Monospace font, 11px
- Auto-scroll to bottom

**Log lines:**
- Default: color `#4ade80` (green-400)
- Timestamp: color `#707070`
- Event name: color `#9a9a9a` by default
- `ticket_found` event: color `#ffdb13` (accent yellow), weight 600

**Empty state:**
- "等待日志...", centered, monospace, color `#707070`

### 5. Task Form Modal (`dashboard/task-form.tsx`)

**Overlay:**
- bg: `#00000088` (50% black), fixed inset-0

**Form card:**
- bg: canvas `#1c1c1c`, border: 1px `#333`, rounded: 12px
- Max width: 480px, max height: 80vh with scroll
- Title "新建监控任务": 18px, weight 600, color white

**Form inputs:**
- bg: `#202020`, border: 1px `#333`, rounded: 6px
- Text color: white, placeholder: `#707070`
- Focus: border `#3ecf8e`
- Labels: 13px, weight 500, color `#9a9a9a`

**Select dropdowns (station):**
- Same styling as text inputs
- Dark option backgrounds

**Toggle buttons (seat types, strategies):**
- Unselected: bg `#202020`, border 1px `#333`, text `#9a9a9a`, rounded 6px
- Selected: bg `#3ecf8e22`, border `#3ecf8e44`, text `#3ecf8e`, rounded 6px

**Buttons:**
- Submit: bg `#3ecf8e`, text `#171717`, weight 500, rounded 6px, py 8px px 20px
- Cancel: bg transparent, border 1px `#333`, text `#9a9a9a`, rounded 6px

### 6. Popup (`popup.tsx`)

**Pop-up card:**
- bg: canvas `#1c1c1c`, border: 1px `#333`
- Title "EasyHome": 16px, weight 600, color white
- "打开控制台" button: bg `#3ecf8e`, text `#171717`, rounded 6px, weight 500

## Tailwind Config Changes

Add to `tailwind.config.js`:
```js
theme: {
  extend: {
    fontFamily: {
      sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      mono: ['ui-monospace', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
    },
    colors: {
      // Supabase dark palette
      canvas: '#1c1c1c',
      'canvas-soft': '#202020',
      'log-bg': '#0d0d0d',
      primary: '#3ecf8e',
      'primary-deep': '#24b47e',
      'text-muted': '#9a9a9a',
      border: '#333333',
    }
  }
}
```

## Files Changed

| File | Changes |
|------|---------|
| `tailwind.config.js` | Add font family, custom colors |
| `src/style.css` | Add Inter font import, base dark styles |
| `src/tabs/dashboard.tsx` | Header, nav, layout colors |
| `src/dashboard/task-list.tsx` | Card styles, status indicators |
| `src/dashboard/solution-board.tsx` | Card styles, badges, price display |
| `src/dashboard/log-stream.tsx` | Terminal dark theme, log line colors |
| `src/dashboard/task-form.tsx` | Modal dark theme, form inputs, toggles |
| `src/popup.tsx` | Dark card, button |

## Not in Scope

- Layout restructure (sidebars, panels)
- New components or features
- Animation/transitions (beyond hover states)
- Responsive breakpoints (desktop-only extension dashboard)
- Dark/light mode toggle (dark only)
- Font loading optimization (Inter may be bundled or loaded via CDN)
