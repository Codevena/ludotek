# Next Session Plan — Sticky Enrichment Progress + Fun Facts/Story Redesign

## Context

Game Vault is feature-complete with ROM upload, AI discovery, cinematic game detail page, breadcrumbs, and clickable genre/theme tags. Two UI improvements remain.

## Design Mocks

Visual mocks are in `.superpowers/brainstorm/` — start the companion server to view them:
```bash
/Users/markus/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.7/skills/brainstorming/scripts/start-server.sh --project-dir /Users/markus/Desktop/game-vault
```

---

## Feature 1: Sticky Enrichment Progress Bar

### Problem
Enrichment progress is only visible on the Admin page. If you navigate away, you lose visibility into the running process.

### Solution
A global sticky progress bar at the bottom of every page that shows enrichment status while any enrichment process is running.

### Architecture

**React Context Provider** (`src/context/enrichment-context.tsx`):
- `EnrichmentProvider` wraps the app in `layout.tsx`
- Stores: `{ isRunning, current, total, enriched, failed, title, type }`
- `startEnrichment(url, setter?)` — starts SSE stream, updates context
- `dismiss()` — hides the bar without cancelling

**Sticky Bar Component** (`src/components/enrichment-bar.tsx`):
- Fixed bottom position (`fixed bottom-0 left-0 right-0 z-50`)
- Background: `bg-vault-surface border-t border-vault-border`
- Content: pulsing amber dot + "Enriching" label + progress bar + counts + dismiss button
- Auto-fades after completion (3s delay)
- Only renders when `isRunning` or recently completed

**Admin Page Changes** (`src/app/admin/page.tsx`):
- Replace direct `runStreamingAction` calls with context's `startEnrichment`
- Remove local progress state (moved to context)
- Keep action buttons (they trigger context)

### Files to Create/Modify
| File | Action |
|------|--------|
| `src/context/enrichment-context.tsx` | Create — context provider + hook |
| `src/components/enrichment-bar.tsx` | Create — sticky bottom bar |
| `src/app/layout.tsx` | Modify — wrap children in EnrichmentProvider |
| `src/app/admin/page.tsx` | Modify — use context instead of local state |

---

## Feature 2: Fun Facts & Story Redesign

### Problem
Fun Facts and Story sections on the game detail page are plain `<details>` elements — functional but visually boring.

### Solution
Replace with styled content blocks that are always visible (no toggle needed).

### Design

**Fun Facts Block:**
- Amber gradient border: `bg-gradient-to-br from-vault-amber/[0.08] to-transparent`
- Border: `border border-vault-amber/20 rounded-xl`
- Lightning bolt icon + "Fun Facts" heading in amber
- Bullet points with amber dots
- Markdown content rendered inside

**Story Block:**
- Indigo gradient border: `bg-gradient-to-br from-indigo-500/[0.08] to-transparent`
- Border: `border border-indigo-500/20 rounded-xl`
- Book icon + "Story & Background" heading in indigo
- Flowing text with proper line-height
- Markdown content rendered inside

### Files to Modify
| File | Action |
|------|--------|
| `src/app/game/[id]/page.tsx` | Modify — replace `<details>` with styled blocks |

### Implementation (simple CSS change, ~30 lines)

Replace the current `<details>` sections with:

```tsx
{game.aiFunFacts && (
  <div className="mt-8 rounded-xl border border-vault-amber/20 bg-gradient-to-br from-vault-amber/[0.08] to-transparent p-6">
    <div className="flex items-center gap-2 mb-4">
      <span className="text-lg">&#9889;</span>
      <h2 className="font-heading text-xl font-bold text-vault-amber">Fun Facts</h2>
    </div>
    <MarkdownContent content={game.aiFunFacts} />
  </div>
)}

{game.aiStory && (
  <div className="mt-6 rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.08] to-transparent p-6">
    <div className="flex items-center gap-2 mb-4">
      <span className="text-lg">&#128214;</span>
      <h2 className="font-heading text-xl font-bold text-indigo-400">Story &amp; Background</h2>
    </div>
    <MarkdownContent content={game.aiStory} />
  </div>
)}
```

---

## Execution Order

1. **Fun Facts/Story redesign** (5 min, simple CSS) — do first as warmup
2. **Enrichment Context** (20 min) — create provider + hook
3. **Enrichment Bar** (10 min) — create sticky component
4. **Layout integration** (5 min) — wrap app in provider
5. **Admin page refactor** (15 min) — move streaming to context
6. **Integration test** — verify bar shows on all pages

## Current State

- All tests pass (43)
- Build clean
- Dev server: `pnpm dev`
- GitHub: Codevena/game-vault (PRs #1-#7 merged)
