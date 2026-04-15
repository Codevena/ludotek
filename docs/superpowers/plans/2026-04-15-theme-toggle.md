# Theme Toggle (Dark/Light) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dark/light theme toggle using CSS custom properties so all existing vault-* classes switch colors automatically without touching component files.

**Architecture:** Replace hardcoded hex colors in `tailwind.config.ts` with CSS custom properties defined in `globals.css` under `:root` (light) and `.dark` (dark). Use `next-themes` for system detection, localStorage persistence, and flash prevention. Toggle button in the header.

**Tech Stack:** next-themes, Tailwind CSS 3.4, CSS custom properties (RGB channels for opacity support)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/app/globals.css` | CSS custom properties (`:root` light, `.dark` dark), prose overrides |
| `tailwind.config.ts` | Reference `var(--vault-*)` via RGB channel format |
| `src/app/layout.tsx` | Wrap with `ThemeProvider` from next-themes |
| `src/components/theme-toggle.tsx` | New: sun/moon icon button using `useTheme()` |
| `src/components/layout/header.tsx` | Add `<ThemeToggle />` after device selector |

---

### Task 1: Install next-themes

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install next-themes**

```bash
pnpm add next-themes
```

- [ ] **Step 2: Verify installation**

```bash
pnpm list next-themes
```
Expected: `next-themes` version listed.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add next-themes dependency"
```

---

### Task 2: Convert vault colors to CSS custom properties

**Files:**
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Define CSS custom properties in globals.css**

Replace the entire `@layer base` block in `src/app/globals.css` with:

```css
@layer base {
  /* Light mode (Warm Stone palette) */
  :root {
    --vault-bg: 250 250 249;
    --vault-surface: 240 239 237;
    --vault-border: 214 211 209;
    --vault-text: 28 25 23;
    --vault-muted: 120 113 108;
    --vault-amber: 217 119 6;
    --vault-amber-hover: 245 158 11;
  }

  /* Dark mode */
  .dark {
    --vault-bg: 17 17 19;
    --vault-surface: 26 26 31;
    --vault-border: 42 42 48;
    --vault-text: 228 228 231;
    --vault-muted: 113 113 122;
    --vault-amber: 245 158 11;
    --vault-amber-hover: 251 191 36;
  }

  * {
    @apply border-vault-border;
  }
  body {
    @apply bg-vault-bg text-vault-text;
  }
}
```

- [ ] **Step 2: Update prose-vault to use CSS variables**

Replace the `.prose-vault` block in the `@layer components` section of `src/app/globals.css` with:

```css
  /* Vault-themed prose overrides for MarkdownContent */
  .prose-vault {
    --tw-prose-body: rgb(var(--vault-muted));
    --tw-prose-headings: rgb(var(--vault-text));
    --tw-prose-bold: rgb(var(--vault-text));
    --tw-prose-links: rgb(var(--vault-amber));
    --tw-prose-bullets: rgb(var(--vault-muted));
    --tw-prose-counters: rgb(var(--vault-muted));
  }

  .prose-vault strong {
    color: rgb(var(--vault-text));
    font-weight: 700;
  }
```

Also update the `border-left` in `.prose-vault p > strong:first-child`:

```css
  /* Bold text that starts a paragraph — acts as a sub-heading */
  .prose-vault p > strong:first-child {
    display: inline-block;
    border-left: 2px solid rgb(var(--vault-amber));
    padding-left: 0.5rem;
    margin-bottom: 0.125rem;
  }

  /* Indigo variant for Story sections */
  .prose-vault-indigo p > strong:first-child {
    border-left-color: #6366f1;
  }
```

The `p`, `ul`, `ol`, `li`, `h2`/`h3`/`h4` rules stay unchanged (they use spacing, not colors). But update the heading color:

```css
  .prose-vault h2,
  .prose-vault h3,
  .prose-vault h4 {
    color: rgb(var(--vault-text));
    font-weight: 700;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
  }
```

- [ ] **Step 3: Update tailwind.config.ts to use CSS variables**

Replace the `colors` section in `tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        vault: {
          bg: "rgb(var(--vault-bg) / <alpha-value>)",
          surface: "rgb(var(--vault-surface) / <alpha-value>)",
          border: "rgb(var(--vault-border) / <alpha-value>)",
          text: "rgb(var(--vault-text) / <alpha-value>)",
          muted: "rgb(var(--vault-muted) / <alpha-value>)",
          amber: "rgb(var(--vault-amber) / <alpha-value>)",
          "amber-hover": "rgb(var(--vault-amber-hover) / <alpha-value>)",
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
```

- [ ] **Step 4: Verify build**

```bash
pnpm build 2>&1 | tail -5
```
Expected: Build succeeds. All vault-* classes still resolve correctly.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css tailwind.config.ts
git commit -m "feat: convert vault colors to CSS custom properties for theme support"
```

---

### Task 3: Add ThemeProvider to root layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Wrap with ThemeProvider**

Update `src/app/layout.tsx`:

```typescript
import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { EnrichmentProvider } from "@/context/enrichment-context";
import { ScanProvider } from "@/context/scan-context";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Ludotek",
  description: "Personal game collection showcase",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} font-body bg-vault-bg text-vault-text min-h-screen flex`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <EnrichmentProvider>
            <ScanProvider>
              {children}
            </ScanProvider>
          </EnrichmentProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

Key changes:
- Import `ThemeProvider` from `next-themes`
- Remove `className="dark"` from `<html>` (next-themes manages this)
- Add `suppressHydrationWarning` to `<html>` (required by next-themes)
- Wrap children in `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`

- [ ] **Step 2: Verify build**

```bash
pnpm build 2>&1 | tail -5
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: add ThemeProvider from next-themes to root layout"
```

---

### Task 4: Create ThemeToggle component

**Files:**
- Create: `src/components/theme-toggle.tsx`

- [ ] **Step 1: Create the theme toggle component**

Create `src/components/theme-toggle.tsx`:

```typescript
"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Avoid hydration mismatch — render placeholder until mounted
  if (!mounted) {
    return (
      <button
        className="bg-vault-surface border border-vault-border rounded-lg p-1.5 text-vault-muted"
        aria-label="Toggle theme"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" />
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="bg-vault-surface border border-vault-border rounded-lg p-1.5 text-vault-muted hover:text-vault-text transition-colors"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        // Sun icon — shown in dark mode, click switches to light
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      ) : (
        // Moon icon — shown in light mode, click switches to dark
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm build 2>&1 | tail -5
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/theme-toggle.tsx
git commit -m "feat: add ThemeToggle component with sun/moon icons"
```

---

### Task 5: Add ThemeToggle to header

**Files:**
- Modify: `src/components/layout/header.tsx`

- [ ] **Step 1: Import and render ThemeToggle**

In `src/components/layout/header.tsx`, add the import at the top:

```typescript
import { ThemeToggle } from "@/components/theme-toggle";
```

Then in the JSX, find the `<div className="ml-auto flex items-center gap-3">` block and add the ThemeToggle after the device selector closing `</div>`, before the outer closing `</div>`:

Replace this block (lines 96-115):

```typescript
      {/* Sync Panel & Active Device Selector */}
      <div className="ml-auto flex items-center gap-3">
        <SyncPanel />
        {devices.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-vault-muted text-xs">Device:</span>
            <select
              value={activeDeviceId ?? ""}
              onChange={(e) => handleDeviceChange(e.target.value)}
              className="bg-vault-surface border border-vault-border rounded-lg px-2 py-1.5 text-xs text-vault-text focus:outline-none focus:border-vault-amber/50"
            >
              <option value="">All Devices</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
```

With:

```typescript
      {/* Sync Panel, Active Device Selector & Theme Toggle */}
      <div className="ml-auto flex items-center gap-3">
        <SyncPanel />
        {devices.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-vault-muted text-xs">Device:</span>
            <select
              value={activeDeviceId ?? ""}
              onChange={(e) => handleDeviceChange(e.target.value)}
              className="bg-vault-surface border border-vault-border rounded-lg px-2 py-1.5 text-xs text-vault-text focus:outline-none focus:border-vault-amber/50"
            >
              <option value="">All Devices</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="w-px h-5 bg-vault-border" />
        <ThemeToggle />
      </div>
```

The only additions are the divider `<div>` and `<ThemeToggle />` at the end, plus the updated comment.

- [ ] **Step 2: Verify build**

```bash
pnpm build 2>&1 | tail -5
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/header.tsx
git commit -m "feat: add theme toggle button to header"
```

---

### Task 6: Visual verification and fixes

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Test dark mode**

Open http://localhost:3000. The app should load in system theme (likely dark). Click the theme toggle — should switch to light (Warm Stone). Click again — back to dark. Verify:

1. Home page: background, cards, sidebar, header all switch
2. Game detail page: prose content (Fun Facts, Story) switches
3. Timeline page: era bar backdrop blur, era colors (decorative, stay the same)
4. Header: backdrop blur transparency works in both themes
5. Setup wizard (`/setup`): standalone layout also themed

- [ ] **Step 3: Test system preference**

1. Open browser DevTools → Rendering → Emulate CSS media `prefers-color-scheme: light`
2. Clear localStorage (`localStorage.removeItem('theme')`)
3. Reload — app should follow system preference (light)
4. Toggle → overrides system preference, persists in localStorage

- [ ] **Step 4: Test flash prevention**

1. Set theme to light via toggle
2. Hard-refresh (Cmd+Shift+R) — should NOT flash dark then switch to light
3. next-themes injects a blocking script that sets `.dark` before paint

- [ ] **Step 5: Fix any visual issues**

If any components have hardcoded colors (not using vault-* classes), fix them. Common suspects:
- Inline `style={{ color: "#..." }}` in components
- Hardcoded colors in recharts/chart components
- Platform-specific colors (intentionally static — leave these)

- [ ] **Step 6: Final build check**

```bash
pnpm build 2>&1 | tail -5
```
Expected: Clean build.

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix: visual adjustments for light/dark theme support"
```

(Skip this step if no fixes were needed.)
