# PeyajFlow Design System: Onion Red & Liquid Glass

This document details the visual identity, token architecture, typography hierarchy, liquid glass recipes, and component specifications for the **PeyajFlow** web app.

---

## 1. Design Direction & Brand Identity

PeyajFlow tracks the journey of onions from farm storage in Pabna to markets in Dhaka.
The visual identity is grounded in four core pillars:
1. **Modern and Classy, Not AI-Looking**: Editorial layout, asymmetric compositions, confident typography, hairline rules (1px), subtle onion-ring concentric motifs, and genuine photography without purple/cyan tech cliches.
2. **Onion-Red Theme Everywhere**: A cool-leaning wine-crimson ramp (`--onion-50` through `--onion-950`) accented with warm dry-skin gold (`--skin-300` through `--skin-700`).
3. **Apple-Style Liquid Glass**: Translucent, layered, precise surfaces featuring specular highlights, soft inner borders, and high-saturate backdrop blurs.
4. **Editorial Typography**: A dual-script typographic system prioritizing legibility, tabular numerals for trade, and authentic Bengali conjunct rendering.

---

## 2. Color System & Tokens (`tokens.css`)

### Light Mode Canvas & Ink
- `--canvas`: `#FBF6F3` (Warm pale wheat canvas)
- `--canvas-2`: `#F6EBE6` (Secondary tint for sections)
- `--ink`: `#22121A` (Deep wine ink for maximum text contrast)
- `--ink-2`: `#5E4A53` (Secondary body ink)
- `--ink-3`: `#8D7A82` (Muted caption ink)

### Onion Crimson Ramp (Primary)
- `--onion-50`: `#FDF3F6`
- `--onion-100`: `#FBE4EB`
- `--onion-200`: `#F5C6D4`
- `--onion-300`: `#EC9BB4`
- `--onion-400`: `#DE6A8F`
- `--onion-500`: `#C9416F`
- `--onion-600`: `#A82A55` **(Primary Brand Accent)**
- `--onion-700`: `#8A2045`
- `--onion-800`: `#6A1835`
- `--onion-900`: `#4A1025`
- `--onion-950`: `#2C0916`

### Dry-Skin Gold Accent (Supporting)
- `--skin-300`: `#E9C28A`
- `--skin-500`: `#C98F3F`
- `--skin-700`: `#8A5A1E`

### Semantic Tokens
- `--success`: `#2F7D57` (Reserved for verified weights and received payments)
- `--warning`: `#B7791F` (Alerts and notices)
- `--danger`: `#D4441C` (Hot orange-red for destructive operations)
- `--info`: `#3B6EA5` (Synthetic badges and informational notices)

### Dark Mode (Pure `#000000` Canvas)
As specifically requested, dark mode features a pure black background:
- `--canvas`: `#000000`
- `--canvas-2`: `#0A0407`
- `--surface`: `#120509`
- `--ink`: `#F8EAEE`
- `--primary`: `var(--onion-500)`

---

## 3. Liquid Glass System (`glass.css`)

The glass system adheres to a maximum of 3 overlapping blur levels for performance on mobile and throttled devices:

| Level | Component | Blur | Saturate | Fill (Light) | Fill (Dark) |
|---|---|---|---|---|---|
| **Glass-1** | Cards, panels, metrics | 14px | 1.4 | `rgba(255,255,255, 0.58)` to `0.38` | `rgba(60,10,25, 0.52)` |
| **Glass-2** | Sidebar, topbar, pill nav | 24px | 1.8 | `rgba(255,255,255, 0.66)` to `0.44` | `rgba(60,10,25, 0.62)` |
| **Glass-3** | Modals, sheets, signin form | 36px | 1.8 | `rgba(255,255,255, 0.76)` to `0.54` | `rgba(60,10,25, 0.72)` |

### Fallbacks & Accessibility
- `@supports not (backdrop-filter: blur(1px))` provides opaque, high-contrast tinted fills.
- `@media (prefers-reduced-transparency: reduce)` disables blurs in favor of solid surface colors.
- Throttled mobile profiles (`max-width: 639px`) reduce blur radii to prevent frame drops.

---

## 4. Typography Hierarchy

Fonts are self-hosted via `@fontsource-variable` packages:

- **Display & Headlines (Latin)**: Fraunces Variable (weight 400–600, optical size auto)
- **Display & Headlines (Bangla)**: Noto Serif Bengali Variable (500–700)
- **UI & Body (Latin)**: Instrument Sans Variable / Lexend Variable
- **UI & Body (Bangla)**: Anek Bangla Variable (500/600)
- **Data, IDs & Financials**: IBM Plex Mono 400 (`tabular-nums`, `font-feature-settings: "tnum"`)

### Bangla Typography Rules
- Letter spacing is strictly `0` (negative tracking breaks conjuncts).
- Line height is at least `1.6` for body text and `1.35` for display headings.
- Uppercase transformations are disabled under `:lang(bn)`.
- No faux bold or faux italic.

---

## 5. Layout Architectures

### Public Site (`app/[locale]/page.tsx`)
- Framed hero card with dark burgundy-to-black onion photography overlay.
- Concentric onion-ring interactive papercut motif (dismissible on tap/click).
- Floating Glass-2 centered pill navigation.
- 6-step onion journey diagram (`Store` → `Inspect` → `Decide` → `Trade` → `Deliver` → `Record`).
- Asymmetric editorial grid for user personas (Farmers, Buyers, Field Agents, Operators).

### Workspace Shell (`app/[locale]/workspace/[[...section]]/page.tsx`)
- **Desktop**: Glass-2 left fixed sidebar with logo, navigation destinations with sliding active indicator, user identity chip, and signout trigger.
- **Topbar**: Glass-2 sticky header featuring page title, `QuickSearch` (Ctrl+K shortcut dialog), unread alerts bell, `ThemeToggle` (light/dark segmented switch), and language switcher.
- **Mobile**: Fixed bottom Glass-2 tab bar with 44px+ touch targets for primary actions.
- **Split Sign-In / Sign-Up**: Distinct tabbed modes (`?mode=signin` vs `?mode=signup`), providing dedicated, uncluttered views for credentials vs 7-field farmer/buyer registration.

### Modern Analytical Dashboard (`components/workspace/dashboard.tsx`)
- Welcome Glass-1 banner with location indicator, primary role action, and Bangla voice assistant button.
- 4 KPI metric cards with micro-trend sparklines (sellable stock, open offers, active orders, alerts).
- Interactive SVG Market Outlook & Price Comparison chart comparing Pabna farmgate vs Dhaka Karwan Bazar wholesale prices in onion crimson and skin gold.
- Activity list with honest verification badges (`Verified` vs `Self-reported`).
- Quick actions shortcut list.
