# Design

## Overview

SiteDeck PM is a construction project management dashboard. The visual system is built around **navy authority** and **orange action** — a high-contrast pairing that reads instantly in outdoor, high-glare conditions. The interface is dense but hierarchical: status color (green/amber/red) is the primary navigation signal, not decoration.

The current frontend is a Vite + React SPA. A leftover Vite template CSS file (`index.css`) with purple accent variables and a 1126px root width is present but **not in use** by the actual app components; it should be removed or replaced. The real styling lives in `frontend/src/styles/design-system.ts` and inline component styles.

## Palette

### Primary
- **Navy** `#1B2A4A` — sidebar, headers, primary surfaces
- **Navy Light** `#2A3F6B` — hover states, secondary navy surfaces
- **Navy Dark** `#121D33` — deep backgrounds, gradients

### Accent
- **Orange** `#E8720C` — buttons, CTAs, active states, section accents
- **Orange Light** `#F08A30` — hover on orange elements
- **Orange Dark** `#C55E0A` — pressed states

### Status (Semantic)
- **Green** `#22A06B` — on track, complete, healthy
- **Amber** `#D68A00` — at risk, attention needed
- **Red** `#C9372D` — late, overrun, action required
- **Gray** `#9CA3AF` — closed, archived, neutral

### Neutral
- **White** `#FFFFFF` — content backgrounds, cards
- **Off White** `#F7F8FA` — page background
- **Gray 100** `#F0F1F3` — subtle backgrounds, dividers
- **Gray 200** `#E2E4E8` — borders, inactive track backgrounds
- **Gray 300** `#C4C8D0` — secondary borders
- **Gray 400** `#8C929D` — muted text, placeholders
- **Gray 500** `#5A6072` — secondary text
- **Gray 600** `#3D4457` — tertiary text, labels
- **Black** `#111827` — primary text (used sparingly; navy carries most headings)

### Text
- **Primary** `#1B2A4A` — headings, active nav, key data
- **Secondary** `#5A6072` — body, descriptions, metadata
- **Muted** `#8C929D` — placeholders, timestamps, tertiary labels

## Typography

- **Family:** system stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`)
- **Weights:** 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- **Scale:**
  - xs: 12px — timestamps, badges, micro-labels
  - sm: 14px — body secondary, form labels, tile summaries
  - md: 16px — primary body, button labels, nav items
  - lg: 18px — section labels, subheadings
  - xl: 24px — card headings, stat values
  - xxl: 32px — page titles, hero metrics
  - display: 48px — login brand mark (rare)

**Rules:**
- Navy headings, gray body. No pure black body text.
- Tile headings are `xl` semibold; summaries are `sm` regular.
- Dashboard metric numbers are `xl` bold in their status color.

## Spacing

- Base unit: 4px
- Common increments: 4, 8, 12, 16, 20, 24, 32, 40, 48
- Card padding: 20–24px
- Tile gaps: 16–20px
- Sidebar width: ~64px (icon-only) or ~240px (expanded)
- Content max-width: none (dashboards are full-bleed within the content area)

## Shape

- **Radii:**
  - sm: 6px — inputs, small buttons, badges
  - md: 8px — cards, tiles, modals
  - lg: 12px — large cards, feature panels
  - xl: 16px — login card, onboarding panels
- **Shadows:**
  - sm: `0 1px 2px rgba(27, 42, 74, 0.06)` — subtle elevation
  - md: `0 4px 12px rgba(27, 42, 74, 0.08)` — cards, tiles
  - lg: `0 8px 24px rgba(27, 42, 74, 0.12)` — dropdowns, modals
  - xl: `0 16px 48px rgba(27, 42, 74, 0.18)` — login overlay

## Components

### Sidebar
- Navy background (`#1B2A4A`), white icons
- Active item: orange left border + orange icon
- Collapsed by default; icon + label on hover/focus
- Bottom section: user avatar, logout, help

### Morning Dashboard Tiles
- Six-tile grid: Safety | Schedule | Cost | Materials | Client Issues | Field Issues
- Each tile: status-colored top border (4px), title, summary line, mini chart or stat
- Green tile: green top border, subtle green tint background
- Red tile: red top border, subtle red tint background, higher shadow
- Amber tile: amber top border, subtle amber tint background
- Tappable: full tile is a click target; cursor pointer

### Status Badges
- Pill shape, 6px radius
- Green: `#22A06B` bg, white text
- Amber: `#D68A00` bg, white text
- Red: `#C9372D` bg, white text
- Gray: `#9CA3AF` bg, white text

### Mini Charts (Dashboard)
- **Donut:** 120px, 14px stroke, navy/orange/gray segments. Center shows total.
- **Mini Bar:** Planned = gray track, Actual = colored bar. Label + value pair above.
- **Circular Stat:** 72px circle with 3px colored border. Center value in navy bold.
- **Gauge:** SVG arc, needle position based on 0–1 value. Green zone left, amber middle, red right.

### Data Tables / Lists
- Alternating row backgrounds: white / gray-100
- Status column: colored dot + text
- Hover: gray-100 background
- Action links: orange, underline on hover

### Forms / Inputs
- 12–14px padding, 8px radius
- Border: gray-300 default, orange on focus
- Labels: sm semibold, navy
- Error state: red border + redLight background

## Layout

### App Shell
```
[ Sidebar | Content Area ]
```
- Sidebar: fixed left, full height, navy
- Content: scrollable, off-white background, 20–24px padding
- No max-width constraint on dashboard content

### Dashboard Layout
- Top bar: project switcher (breadcrumb style), alerts bell, user avatar
- KPI strip: CPI / SPI gauges, project value, completion %
- Six-tile grid: 3 columns desktop, 2 columns tablet, 1 column mobile
- Below tiles: health tiles row, communications/issue lists side-by-side

### Responsive Strategy
- Desktop (≥1024px): full sidebar + 3-column tile grid
- Tablet (768–1023px): collapsed sidebar + 2-column grid
- Mobile (<768px): bottom nav or hamburger, 1-column stacked tiles
- Touch targets: minimum 44×44px

## Motion

- **Transitions:** 200ms ease for border-color, background-color, opacity
- **Shadow hover:** tiles lift with md→lg shadow on hover, 200ms
- **Spinner:** simple CSS rotate on orange arc
- **Reduced motion:** disable hover lifts and spinners; instant state changes

## Token Reference (Code)

All tokens are exported from `frontend/src/styles/design-system.ts`:

```ts
COLORS.navy, COLORS.orange, COLORS.green, COLORS.amber, COLORS.red
COLORS.gray100 … COLORS.gray600
COLORS.white, COLORS.offWhite, COLORS.black
COLORS.textPrimary, COLORS.textSecondary, COLORS.textMuted

FONTS.family, FONTS.weight.{regular,medium,semibold,bold}
FONTS.size.{xs,sm,md,lg,xl,xxl,display}

SHADOWS.{sm,md,lg,xl}
BORDERS.radius.{sm,md,lg,xl}
STATUS_COLORS.{green,amber,red}
```
