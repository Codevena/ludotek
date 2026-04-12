# Game Vault Code Review Findings

Reviewed all source files on 2026-04-12. Previous fixes (XSS, auth, SSH injection, masking, search debounce, expandable AI sections, SSE streaming, etc.) are confirmed in place. The following remaining issues were found.

---

## Critical

### 1. Score 0 falsified by `||` operator (`src/lib/igdb.ts:131`)

The claim that "score 0 fix" was applied is incorrect. The code still reads:

```
igdbScore: game.rating || null,
```

`game.rating` of `0` is falsy, so a legitimate zero score becomes `null`. This should be:

```
igdbScore: game.rating !== undefined ? game.rating : null,
```

or:

```
igdbScore: game.rating ?? null,
```

---

## Important

### 2. NaN propagation in page parameter parsing

**Files:** `src/app/page.tsx:91`, `src/app/platform/[id]/page.tsx:26`

```
const page = Math.max(1, parseInt(params.page || "1", 10));
```

If `params.page` is a non-numeric string (e.g., `?page=abc`), `parseInt` returns `NaN`, and `Math.max(1, NaN)` returns `NaN`. This causes `(NaN - 1) * 48 = NaN` to be passed to Prisma's `skip`, which will error or produce unexpected results.

The API route at `src/app/api/games/route.ts:11` correctly handles this with a trailing `|| 1` fallback. Apply the same pattern:

```
const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
```

### 3. SSE streams ignore client disconnection

**Files:** `src/app/api/enrich/route.ts`, `src/app/api/enrich/ai/route.ts`

When a client navigates away or closes the tab mid-enrichment, the server continues processing all remaining games (including external API calls and database writes). The `ReadableStream` should check `controller.desiredSize` or use the `request.signal` to detect cancellation:

```ts
for (let i = 0; i < games.length; i++) {
  if (request.signal.aborted) break;
  // ...existing logic...
}
```

### 4. Unhandled errors before SSE stream starts

**Files:** `src/app/api/enrich/route.ts:11-19`, `src/app/api/enrich/ai/route.ts:10-24`

The `prisma.settings.findFirst()` and `prisma.game.findMany()` calls outside the `ReadableStream` are not wrapped in try-catch. If the database is unavailable, these throw an unhandled exception resulting in a generic 500 error without a useful JSON body. Wrap in try-catch like the scan route does.

### 5. `next.config.mjs` uses deprecated experimental key

**File:** `next.config.mjs:4-6`

```js
experimental: {
  serverComponentsExternalPackages: ["ssh2", "cpu-features"],
},
```

In Next.js 14.x, `serverComponentsExternalPackages` has been promoted to a top-level config option called `serverExternalPackages`. The experimental key still works but is deprecated and may be removed. Change to:

```js
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["ssh2", "cpu-features"],
  images: { ... },
};
```

### 6. `<img>` tags used instead of `next/image`

**Files:** `src/components/game-card.tsx`, `src/components/screenshot-gallery.tsx`, `src/app/game/[id]/page.tsx`

All images use raw `<img>` tags, bypassing Next.js Image optimization (lazy loading hints, responsive sizing, WebP conversion, CDN caching). The `next.config.mjs` already configures `remotePatterns` for `images.igdb.com` and `steamgriddb.com`, but those patterns are unused. Either use `next/image` with `fill` for these images or remove the unused `images` config to avoid confusion.

---

## Suggestions

### 7. Global `.card:hover` lift applies to non-interactive elements

**File:** `src/app/globals.css:18-20`

The `.card:hover` rule applies `border-vault-amber` and `-translate-y-0.5` to every `.card` element, including the admin settings form, progress indicator, and result display -- all of which are non-interactive containers. Consider scoping the hover effect to only interactive cards (e.g., `.card-link:hover` or `a.card:hover`).

### 8. Docker compose missing `STEAM_API_KEY` environment variable

**File:** `docker-compose.yml`

The Settings model and admin UI include `steamApiKey`, and `.env.example` does not include it either. Since it is managed through the admin UI and stored in the database, this is functional but inconsistent with the other API keys that are also passed via Docker ENV. Either add `STEAM_API_KEY` to docker-compose.yml for parity or document that it is DB-only.

### 9. Duplicate `safeJsonParse` function

**Files:** `src/app/api/games/[id]/route.ts:4-7`, `src/app/game/[id]/page.tsx:9-12`

The same `safeJsonParse` helper is defined identically in two files. Extract to a shared utility (e.g., `src/lib/utils.ts`) to reduce duplication.

### 10. Admin page lacks CSRF protection and input validation

**File:** `src/app/admin/page.tsx`

Settings values from the admin form are sent directly to the PUT endpoint without any client-side or server-side validation (e.g., `deckHost` could be set to anything). While this is a home-network tool, basic validation (e.g., ensuring `deckHost` looks like an IP/hostname) would prevent accidental misconfiguration.

### 11. `deduplicateGames` uses `originalFile|platformLabel` as key

**File:** `src/lib/scanner.ts:51`

The deduplication key uses `platformLabel` (display string like "GameCube") rather than `platform` (canonical ID like "gc"). Since two directories can map to the same platform (e.g., "gc" and "gamecube" both map to platform ID "gc" but share the same label), this works in practice. However, using `platform` (the canonical ID) would be semantically clearer and more robust.
