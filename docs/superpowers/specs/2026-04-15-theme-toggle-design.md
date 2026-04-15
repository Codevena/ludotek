# Theme Toggle (Dark/Light) — Design Spec

**Date:** 2026-04-15
**Status:** Approved

## Goal

Add a dark/light theme toggle to Ludotek. The app is currently dark-only with a hardcoded `vault-*` color palette (7 tokens, ~575 usages across 47 files). The toggle should respect OS preference by default, allow manual override, and persist the choice.

## Approach

**CSS custom properties + `next-themes`.** Convert the vault palette from hardcoded hex values in `tailwind.config.ts` to CSS custom properties defined in `globals.css`. Light and dark palettes are defined under `:root` and `.dark` respectively. Tailwind references `var(--vault-*)`, so all existing component classes (`bg-vault-bg`, `text-vault-text`, etc.) work without changes.

`next-themes` handles:
- System preference detection (`prefers-color-scheme`)
- Manual toggle with localStorage persistence
- Flash-of-wrong-theme prevention (inline script injection)
- `className` attribute on `<html>` (adds/removes `dark`)

## Color Mapping

| Token | CSS Variable | Dark | Light (Warm Stone) |
|-------|-------------|------|---------------------|
| vault-bg | `--vault-bg` | `#111113` | `#fafaf9` |
| vault-surface | `--vault-surface` | `#1a1a1f` | `#f0efed` |
| vault-border | `--vault-border` | `#2a2a30` | `#d6d3d1` |
| vault-text | `--vault-text` | `#e4e4e7` | `#1c1917` |
| vault-muted | `--vault-muted` | `#71717a` | `#78716c` |
| vault-amber | `--vault-amber` | `#f59e0b` | `#d97706` |
| vault-amber-hover | `--vault-amber-hover` | `#fbbf24` | `#f59e0b` |

Light palette uses Tailwind's stone palette (warm off-white) to complement the amber accent and fit the retro gaming aesthetic.

## UI

### Toggle Button
- **Location:** Header bar, right side, after the device selector — separated by a vertical divider
- **Appearance:** Icon-only button (sun icon in dark mode, moon icon in light mode) using Heroicons or inline SVG
- **Interaction:** Click cycles through `dark → light → system`. Single click for most users (dark ↔ light). Long-press or context not needed.
- **Styling:** `bg-vault-surface border border-vault-border rounded-lg p-1.5` — matches existing header elements

### Behavior
- **Default:** System preference (`prefers-color-scheme`)
- **Override:** Click toggles between dark and light
- **Persistence:** `localStorage` via `next-themes` (key: `theme`)
- **SSR:** `next-themes` injects a blocking script to set the class before paint — no flash of wrong theme

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Add `next-themes` dependency |
| `src/app/globals.css` | Define `:root` and `.dark` CSS custom properties for all vault tokens. Convert hardcoded prose-vault colors to use variables. |
| `tailwind.config.ts` | Replace hex values with `var(--vault-*)` references. Add `darkMode: "class"`. |
| `src/app/layout.tsx` | Wrap children with `<ThemeProvider>` from `next-themes`. Remove hardcoded `className="dark"` from `<html>` (next-themes manages this). Add `suppressHydrationWarning` to `<html>`. |
| `src/components/theme-toggle.tsx` | New component: sun/moon icon button using `useTheme()` from `next-themes`. |
| `src/components/layout/header.tsx` | Import and render `<ThemeToggle />` after device selector with a divider. |

## Prose Overrides

The `.prose-vault` class in `globals.css` currently uses hardcoded hex colors. These will be converted to use the same CSS variables:

| Prose Variable | Dark | Light |
|----------------|------|-------|
| `--tw-prose-body` | `#a1a1aa` | `#57534e` |
| `--tw-prose-headings` | `#e4e4e7` | `#1c1917` |
| `--tw-prose-bold` | `#ffffff` | `#0c0a09` |
| `--tw-prose-links` | `var(--vault-amber)` | `var(--vault-amber)` |
| `--tw-prose-bullets` | `#71717a` | `#78716c` |
| `--tw-prose-counters` | `#71717a` | `#78716c` |

The `border-left: 2px solid #f59e0b` on bold paragraph starts will also use `var(--vault-amber)`.

## What Does NOT Change

- Zero changes to the 47+ component files — they keep using `bg-vault-bg`, `text-vault-text`, etc.
- Platform colors (each platform has its own hardcoded `color` in `platforms.ts`) stay as-is — they're accent colors, not theme-dependent
- Setup wizard layout (`(setup)/`) gets theme support for free via the shared root layout
- No database changes, no API changes

## Edge Cases

- **Select/dropdown styling:** Native `<select>` elements (device selector) inherit from the vault palette via `bg-vault-surface` — will switch automatically
- **Backdrop blur header:** `bg-vault-bg/80` with backdrop blur — CSS variable works with Tailwind opacity modifier (`bg-vault-bg/80` → `rgb(var(--vault-bg) / 0.8)`). This requires defining CSS variables as raw RGB channels instead of hex, OR using `color-mix()`. We'll use the `color-mix(in srgb, var(--vault-bg) 80%, transparent)` approach or define an additional `--vault-bg-rgb` channel variable for opacity support.
- **Timeline era colors:** Era-specific background gradients use hardcoded hex per era — these are intentionally theme-independent (decorative)
- **Game card hover states:** Currently `border-vault-amber` on hover — works via CSS variable automatically
- **Images/covers:** No filter inversion — game covers and screenshots stay as-is in both themes

## Opacity Support

Tailwind's `bg-vault-bg/80` syntax requires the color to be in a format that supports alpha. Two options:

**Option A — RGB channel variables:**
```css
:root { --vault-bg: 250 250 249; }
/* Tailwind: bg-vault-bg → rgb(var(--vault-bg)) */
/* Tailwind: bg-vault-bg/80 → rgb(var(--vault-bg) / 0.8) */
```

**Option B — Hex values + explicit alpha variants:**
```css
:root { --vault-bg: #fafaf9; --vault-bg-80: rgba(250,250,249,0.8); }
```

**Decision:** Option A — RGB channel variables. This is the standard Tailwind approach for CSS variable colors with opacity support. The Tailwind config uses:
```typescript
bg: "rgb(var(--vault-bg) / <alpha-value>)"
```

This means CSS variables store space-separated RGB channels (`250 250 249`), not hex values.

## Testing

- Toggle between dark/light in the browser
- Verify all pages: Home, Game Detail, Timeline, Insights, Discover, Devices, Files, Admin, Setup Wizard
- Check header backdrop blur works in both themes
- Check prose rendering (Fun Facts, Story) in both themes
- Verify system preference detection (change OS theme, reload)
- Verify localStorage persistence (toggle, close tab, reopen)
- Verify no flash of wrong theme on page load
