# Game Vault -- Code Review Findings

Reviewer: Claude Code Review Agent
Date: 2026-04-12
Scope: Full codebase review (all source files, 22 commits, scaffold to completion)

---

## Critical

### C1. XSS via `dangerouslySetInnerHTML` with unsanitized AI-generated content

**File:** `/Users/markus/Desktop/game-vault/src/app/game/[id]/page.tsx` (lines 138-139, 147-148)

`aiFunFacts` and `aiStory` are rendered with `dangerouslySetInnerHTML` but are never sanitized. The content comes from an LLM via OpenRouter. LLM outputs are not trustworthy -- prompt injection or model misbehavior can produce `<script>`, `<img onerror=...>`, or other XSS payloads. The Markdown-formatted response from the AI is stored raw in the database and rendered as HTML directly.

**Fix:** Use a Markdown-to-HTML library (e.g. `marked` or `remark`) combined with a sanitizer like `DOMPurify` (server-side via `isomorphic-dompurify`) or `sanitize-html`. Alternatively, render the content as plain text or use a React Markdown component that does not allow raw HTML.

### C2. Settings API has no authentication

**File:** `/Users/markus/Desktop/game-vault/src/app/api/settings/route.ts`

The GET endpoint returns masked secrets, but the PUT endpoint accepts and stores arbitrary credentials (SSH password, API keys) with zero authentication. The scan, enrich, and AI endpoints are also completely unauthenticated. Anyone on the network can:
- Change the SSH target to their own machine and harvest the password on next scan
- Replace API keys
- Trigger scans and enrichments

**Fix:** Add at minimum a shared secret / API key header check, or basic auth, for all admin-facing API routes and the admin page.

### C3. SSH command injection in scanner

**File:** `/Users/markus/Desktop/game-vault/src/lib/scanner.ts` (lines 96-104)

The `ROM_BASE` path is a constant, but `dir` values come from the output of `ls -1` on the remote machine. While they originate from a trusted source (your own Steam Deck), if a directory name ever contains shell metacharacters (backticks, `$(...)`, semicolons, etc.), the constructed command `ls -1 "${ROM_BASE}/${dir}"` would be subject to injection. This is a defense-in-depth concern.

**Fix:** Sanitize or validate `dir` values, or use an SFTP-based listing (`conn.sftp()`) instead of `exec` with string interpolation.

---

## Important

### I1. `.env` file is committed or present in working tree with real host IP

**File:** `/Users/markus/Desktop/game-vault/.env`

The `.env` file contains `DECK_HOST="192.168.178.131"` and `DECK_USER="deck"`. While `.env` is in `.gitignore`, the `.env.example` file contains the same real IP address and username, which leaks infrastructure details. The `.env.example` should use placeholder values like `192.168.x.x` or `your-deck-ip`.

### I2. `steamgriddbKey` is not masked in GET /api/settings

**File:** `/Users/markus/Desktop/game-vault/src/app/api/settings/route.ts` (lines 11-17)

The GET endpoint masks `deckPassword`, `igdbClientSecret`, `openrouterKey`, and `steamApiKey`, but `steamgriddbKey` is returned in cleartext. This is inconsistent -- it is an API key and should be masked like the others.

### I3. Admin page sends masked values ("********") back on save, silently skipping updates

**File:** `/Users/markus/Desktop/game-vault/src/app/api/settings/route.ts` (line 31) + `/Users/markus/Desktop/game-vault/src/app/admin/page.tsx`

When the admin page loads, it receives masked values like `"********"` for secrets. If the user changes a non-secret field and saves, the masked values are sent back. The API correctly skips `"********"` values (line 31), but the admin UI shows `"********"` in the password inputs, giving no indication to the user that the actual value is preserved. If a user clears a password field and types something, there is no way to know if the old value was kept or replaced. The UX is confusing and fragile.

**Fix:** Use empty strings for masked fields in the response and add placeholder text like "Saved (hidden)" in the input fields. Or use a separate "change password" flow.

### I4. N+1 query pattern in scan route

**File:** `/Users/markus/Desktop/game-vault/src/app/api/scan/route.ts` (lines 31-53)

Every scanned game triggers an individual `prisma.game.upsert()` call in a loop. For a large collection (hundreds of games), this means hundreds of sequential database round-trips. Additionally, the platform count update (lines 57-69) uses `updateMany` in a loop.

**Fix:** Use `prisma.$transaction()` to batch the upserts, or use `createMany` for new games with conflict handling.

### I5. N+1 API calls in IGDB enrichment

**File:** `/Users/markus/Desktop/game-vault/src/lib/igdb.ts` (lines 58-138)

For each game, `searchIgdb` makes up to 5 sequential API calls (search, cover, genres, companies, company details, screenshots). For 50 games per enrichment batch, that is up to 250 HTTP requests. While there is a 250ms delay between games, the per-game calls are not batched.

The IGDB API supports fetching multiple resources in a single query (e.g., `where id = (1,2,3)`). Consider restructuring to batch lookups across games where possible.

### I6. `cleanFilename` crashes on files with no extension

**File:** `/Users/markus/Desktop/game-vault/src/lib/filename-cleaner.ts` (line 6)

If a filename has no dot (e.g., a directory name or extensionless file), `filename.lastIndexOf(".")` returns -1, and `filename.slice(-1)` returns the last character. This will not match any skip extension, so it will not crash, but the logic is wrong -- it should handle the no-extension case explicitly.

Additionally, if the filename is just `.hidden`, `lastIndexOf(".")` returns 0, and `slice(0)` returns the entire filename, which would then be checked against `SKIP_EXTENSIONS`. This is a minor edge case but indicates the logic does not account for dotfiles.

### I7. Scan result new/updated detection is unreliable

**File:** `/Users/markus/Desktop/game-vault/src/app/api/scan/route.ts` (line 49)

The code checks `result.createdAt.getTime() === result.updatedAt.getTime()` to determine if a record was newly created vs. updated. This is fragile because:
- Prisma's `@updatedAt` is set by Prisma, not the database, and timing differences could cause false negatives
- On an upsert that matches but the title has not changed, `updatedAt` still gets bumped by Prisma's `@updatedAt` directive

This means the counts may be inaccurate.

### I8. `deduplicateGames` key does not actually deduplicate across platforms

**File:** `/Users/markus/Desktop/game-vault/src/lib/scanner.ts` (line 51)

The dedup key is `${game.originalFile}|${game.title}`. Two entries from different directories (e.g., `gc/Zelda.rvz` and `gamecube/Zelda.rvz`) will have the same `originalFile` ("Zelda.rvz") and same `title` ("Zelda"), so they will be deduplicated. But if the same game appears in `gc` and `gc-multidisc` with different filenames, they will not be deduplicated because the key includes `originalFile`.

The deduplication logic seems to target the case where the same file appears in aliased directories (e.g., `gc` vs `gamecube`). The key should probably be `${game.title}|${game.platform}` to deduplicate by game identity rather than file identity.

---

## Minor

### M1. `SortSelect` splitting logic is fragile

**File:** `/Users/markus/Desktop/game-vault/src/components/sort-select.tsx` (line 18)

`e.target.value.split("-")` splits on the first `-`. For the value `"igdbScore-desc"`, this produces `["igdbScore", "desc"]` which is correct. But `"title"` produces `["title"]` and `order` becomes `undefined`, which is also fine. However, if a sort key ever contained a hyphen (e.g., `"release-date"`), this would break. Low risk since the keys are controlled, but fragile.

### M2. Pagination only shows first 10 pages

**Files:** `/Users/markus/Desktop/game-vault/src/app/page.tsx` (line 95), `/Users/markus/Desktop/game-vault/src/app/platform/[id]/page.tsx` (line 73)

`Math.min(totalPages, 10)` caps pagination at 10 visible pages. If there are 20+ pages, users cannot navigate to pages 11-20. There is no "next" / "previous" / "last" control.

### M3. Sidebar fetches platforms client-side, causing layout shift

**File:** `/Users/markus/Desktop/game-vault/src/components/layout/sidebar.tsx`

The sidebar is a client component that fetches `/api/platforms` in a `useEffect`. This means the platform list is empty on initial render and pops in after the API call completes, causing visible layout shift. Since this is a Next.js 14 app with server components, the sidebar could be a server component that fetches data directly from Prisma.

### M4. `Suspense` boundaries have no fallback

**File:** `/Users/markus/Desktop/game-vault/src/app/layout.tsx` (lines 33-35, 37-39)

`<Suspense>` without a `fallback` prop renders nothing while the child is loading. This means the sidebar and header will flash in. Provide skeleton/spinner fallbacks for better UX.

### M5. `card` hover effect applies to non-interactive cards

**File:** `/Users/markus/Desktop/game-vault/src/app/globals.css` (lines 18-20)

The `.card:hover` style with `-translate-y-0.5` applies to all `.card` elements, including static info cards on the game detail page (summary, fun facts, story sections). Non-interactive elements should not have lift-on-hover effects as it implies interactivity.

### M6. Screenshot gallery lightbox has no keyboard dismiss

**File:** `/Users/markus/Desktop/game-vault/src/components/screenshot-gallery.tsx`

The lightbox overlay can only be dismissed by clicking. There is no `onKeyDown` handler for Escape, no focus trap, and no ARIA attributes (`role="dialog"`, `aria-modal`, `aria-label`). This is an accessibility gap.

### M7. Search bar does not sync with URL on navigation

**File:** `/Users/markus/Desktop/game-vault/src/components/search-bar.tsx`

The `SearchBar` component uses local `useState` for the query but does not read from `searchParams` on mount. If a user navigates to `/?search=zelda` (e.g., via browser back), the search input will show empty while the results show filtered games. The state should be initialized from the URL.

### M8. `img` tags use raw `src` instead of `next/image`

**Files:** `/Users/markus/Desktop/game-vault/src/components/game-card.tsx`, `/Users/markus/Desktop/game-vault/src/app/game/[id]/page.tsx`

External images from IGDB and SteamGridDB are loaded with plain `<img>` tags. While `remotePatterns` is configured in `next.config.mjs`, `next/image` is not used. This means no automatic image optimization, no lazy loading with placeholder, and no sizing enforcement. For a grid of 48 game covers, this is a meaningful performance miss.

### M9. No error boundary for admin page fetch failures

**File:** `/Users/markus/Desktop/game-vault/src/app/admin/page.tsx` (line 36)

The `useEffect` that fetches settings has no `.catch()` handler. If the settings API fails, the promise rejection is unhandled and the UI shows empty form fields with no error indication.

### M10. Docker image uses `corepack prepare pnpm@latest`

**File:** `/Users/markus/Desktop/game-vault/Dockerfile` (line 3)

Using `pnpm@latest` in a Dockerfile means builds are not reproducible. Pin to a specific pnpm version (e.g., `pnpm@9.15.0`).

### M11. `@types/ssh2` is a runtime dependency

**File:** `/Users/markus/Desktop/game-vault/package.json` (line 9)

`@types/ssh2` is listed under `dependencies` instead of `devDependencies`. Type packages should always be dev dependencies.

### M12. Missing `aria-label` on select and form elements

**Files:** `/Users/markus/Desktop/game-vault/src/components/sort-select.tsx`, `/Users/markus/Desktop/game-vault/src/components/search-bar.tsx`

The sort `<select>` and search `<input>` have no `aria-label` or associated `<label>` elements. Screen readers will not be able to identify these controls.

### M13. Admin labels not associated with inputs via `htmlFor`/`id`

**File:** `/Users/markus/Desktop/game-vault/src/app/admin/page.tsx`

The admin form uses `<label>` elements but they lack `htmlFor` attributes and the inputs lack `id` attributes. Clicking a label will not focus the corresponding input, and screen readers will not associate them.
