# Game View Redesign + Re-Enrich -- Code Review Findings

Reviewer: Claude Review Agent
Date: 2026-04-13
Diff range: 16b35a4..HEAD (5 commits)

---

## IMPORTANT -- Spec Deviation

### 1. Platform page not updated with metacriticScore (spec non-compliance)

**Severity:** Important (should fix)

The spec (Teil 2, "Betroffene Dateien") explicitly lists:
> Modify: `src/app/platform/[id]/page.tsx` -- gleich

The platform page at `src/app/platform/[id]/page.tsx` still passes its games directly to `<GameGrid>` without the `metacriticScore` field. The Prisma query already returns all fields (including `metacriticScore`), so the data is there, but the `GameGrid` interface expects `metacriticScore` and the platform page was never touched. This means game cards on platform pages will either show `undefined` for metacriticScore (treated as missing) or cause a TypeScript error depending on strict mode.

**File:** `/Users/markus/Desktop/game-vault/src/app/platform/[id]/page.tsx` (line 76)

Since the `Game` interface in `game-grid.tsx` now requires `metacriticScore: number | null`, and the Prisma findMany already returns it, this likely works at runtime (Prisma returns the full model). But it was explicitly listed in the spec as a file to modify and was not touched in any of the 5 commits.

**Recommendation:** Confirm this works at runtime (TypeScript may or may not flag it depending on how strict the inference is with Prisma return types). If the Prisma return type satisfies the GameGrid Game interface, this is cosmetic. If not, it will be a build error.

---

## IMPORTANT -- Code Duplication

### 2. fetchIgdbById is a near-complete copy of searchIgdb (massive duplication)

**Severity:** Important (should fix)

`src/lib/igdb.ts` -- `fetchIgdbById` (lines 203-322) is an almost line-for-line duplicate of `searchIgdb` (lines 63-201). The only difference is the initial query: one uses `search "title"` and the other uses `where id = N`. The entire resolution logic (covers, genres, companies, screenshots, videos, artworks, franchise, themes) is duplicated -- roughly 120 lines of identical code.

**Recommendation:** Extract the shared resolution logic into a private helper function like `resolveIgdbGame(clientId, token, game)` that takes the raw IGDB game result and resolves all sub-entities. Both `searchIgdb` and `fetchIgdbById` should call this helper after obtaining their initial game result.

---

## SECURITY

### 3. Platform color injected into CSS style attribute without sanitization

**Severity:** Important (should fix)

**File:** `/Users/markus/Desktop/game-vault/src/app/game/[id]/page.tsx` (line 55)

```tsx
style={{ background: `linear-gradient(135deg, ${platformColor}33, ${platformColor}11, ${platformColor}33)` }}
```

`platformColor` comes from `platform?.color` which is a database field. If an admin were to set a platform color to something like `); background: url(javascript:` or inject CSS-based attacks, this could be exploited. While the risk is low (admin-only write path, and React's style attribute prevents full CSS injection since it uses CSSStyleDeclaration), the value should still be validated as a hex color.

**Recommendation:** Add a simple hex color validation:
```ts
const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
const platformColor = (platform?.color && HEX_RE.test(platform.color)) ? platform.color : "#6366f1";
```

---

## CORRECTNESS

### 4. IGDB `igdbId` parameter not validated as integer before interpolation

**Severity:** Low (suggestion)

**File:** `/Users/markus/Desktop/game-vault/src/lib/igdb.ts` (line 213)

```ts
`${fields} where id = ${igdbId};`
```

The `igdbId` parameter is typed as `number`, so TypeScript prevents string injection at compile time. However, the value originates from `game.igdbId!` (a database Int? field). If it were ever NaN or Infinity, it would produce an invalid IGDB query. The non-null assertion `!` on line 76 of the refresh route is safe because of the `where: { igdbId: { not: null } }` filter, but a defensive check would be cleaner.

**Recommendation:** Add `if (!Number.isFinite(igdbId)) return null;` at the top of `fetchIgdbById`.

### 5. Re-enrich "remaining" count uses different logic than the initial filter

**Severity:** Low (suggestion)

**File:** `/Users/markus/Desktop/game-vault/src/app/api/enrich/refresh/route.ts`

The initial game filter (lines 33-40) uses `safeJsonParse` to check for empty arrays, while the final "remaining" count (lines 136-151) uses a Prisma OR with `{ videoIds: null }` and `{ videoIds: "[]" }`. These are semantically equivalent for well-formed data, but `safeJsonParse` also handles malformed JSON gracefully (returns []). If a field contained invalid JSON like `"["`, the initial filter would include it, but the remaining count would not. Minor inconsistency.

### 6. "franchise: null" in remaining count is overly broad

**Severity:** Low (suggestion)

**File:** `/Users/markus/Desktop/game-vault/src/app/api/enrich/refresh/route.ts` (line 140)

The remaining count includes `{ franchise: null }` in the OR clause. Many games legitimately have no franchise. This means "remaining" will always be inflated by games that genuinely have no franchise, making the count misleading to the admin.

---

## SUGGESTIONS (nice to have)

### 7. Game detail hero height uses inline style instead of Tailwind

**File:** `/Users/markus/Desktop/game-vault/src/app/game/[id]/page.tsx` (line 50)

```tsx
style={{ height: "280px" }}
```

The spec also calls for `200px` on mobile. Currently the height is fixed at 280px regardless of viewport. A Tailwind class like `h-[200px] md:h-[280px]` would implement the spec's responsive requirement.

### 8. Cover dimensions differ from spec

The spec says the cover should be `80px` wide. The implementation uses `w-24` (96px) and `h-32` (128px). This is a minor visual deviation -- 96px may actually look better, but it differs from the spec.

### 9. SSE event type "missed" not in spec

**File:** `/Users/markus/Desktop/game-vault/src/app/api/enrich/refresh/route.ts` (line 122)

The route emits `type: "missed"` when `fetchIgdbById` returns null. The spec defines `type: "skipped"` for this case. The admin page handles "missed" as a failure (line 218), which is reasonable, but it deviates from the spec's event vocabulary.

### 10. SSE "start" event missing "totalRemaining" field from spec

**File:** `/Users/markus/Desktop/game-vault/src/app/api/enrich/refresh/route.ts` (line 57)

The spec defines the start event as `{"type":"start","total":N,"totalRemaining":N}`. The implementation only sends `{"type":"start","total":N}`.

---

## What Was Done Well

- The cinematic hero layout is clean and well-structured with proper gradient overlays
- Score color logic is consistent between cards and detail page
- Video ID sanitization regex (`/^[a-zA-Z0-9_-]{6,15}$/`) prevents iframe injection -- good security practice
- The re-enrich route properly uses auth middleware (`requireAuth`)
- SSE streaming pattern is consistent with existing enrich routes
- The "only fill NULL fields" logic in the refresh route correctly preserves existing data
- `safeJsonParse` is used consistently for JSON array fields
- Abort signal handling in the streaming loop is a nice touch
- The admin page properly disables all action buttons while re-enriching is active
