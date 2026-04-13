# Re-Review: Game View Redesign Fixes

## Verified Fixes (all confirmed applied correctly)

1. **resolveIgdbGame() extraction** -- shared helper exists at igdb.ts:107, used by both searchIgdb (line 97) and fetchIgdbById (line 220). Deduplication achieved.
2. **Hex color regex validation** -- HEX_RE at page.tsx:40 with fallback to #6366f1. CSS injection vector closed.
3. **Responsive hero height** -- h-[200px] md:h-[280px] at page.tsx:51. Confirmed.
4. **SSE totalRemaining** -- sent in start event at route.ts:57. Confirmed.
5. **Franchise removed from remaining counter** -- route.ts:135-149 does NOT include franchise. Confirmed.

## Findings

### Important: franchise still in selection filter but not in remaining counter (route.ts)

The in-memory filter at lines 33-40 still includes `if (!game.franchise) return true;` (line 35), meaning games missing only a franchise will be selected for processing. However, the final `remaining` Prisma count query (lines 135-149) does not include franchise. This creates a mismatch: games selected solely for missing franchise will be processed but never reflected in the remaining count, inflating the "processed" number relative to the "remaining" number. The franchise check on line 35 should be removed to match the remaining counter, or intentionally kept with a comment explaining why the asymmetry exists.

### Suggestion: inline type in searchIgdb duplicates RawIgdbGame (igdb.ts)

Lines 76-81 declare an inline type for `results` that is field-for-field identical to `RawIgdbGame` (lines 100-105). The deduplication fix extracted `resolveIgdbGame` but left this redundant type literal. Replace `Array<{...}>` on line 76 with `RawIgdbGame[]` to complete the deduplication. This requires moving the `RawIgdbGame` type declaration above `searchIgdb` or converting it to a top-level type.

### Suggestion: hex regex allows invalid CSS color lengths (page.tsx)

`/^#[0-9a-fA-F]{3,8}$/` permits 5-char and 7-char hex strings (e.g. `#12345`, `#1234567`) which are not valid CSS colors. A stricter pattern would be `/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/`. Low risk since data comes from the database, but worth tightening if convenient.
