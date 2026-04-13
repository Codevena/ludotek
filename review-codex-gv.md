## Finding 1: Hero banner height missing responsive mobile breakpoint

**File:** src/app/game/[id]/page.tsx  
**Severity:** medium  
**Category:** spec-compliance  
**Description:** The hero banner is set to a fixed `280px` height with no responsive variant for mobile viewports.  
**Evidence:** Spec (2026-04-13-game-view-redesign.md) requires `280px` on desktop and `200px` on mobile. The implementation uses a single static height class with no `sm:` or `md:` breakpoint override.  
**Recommendation:** Apply `h-[200px] md:h-[280px]` (or equivalent Tailwind responsive classes) to the banner container.

---

## Finding 2: Hero cover image width does not match spec

**File:** src/app/game/[id]/page.tsx  
**Severity:** low  
**Category:** spec-compliance  
**Description:** The hero cover image uses `w-24` (96px). The spec requires 80px.  
**Evidence:** Spec states cover image width = 80px. `w-24` in Tailwind = 6rem = 96px (at default 16px base).  
**Recommendation:** Change to `w-20` (80px) to match the spec.

---

## Finding 3: Info grid layout deviates from spec

**File:** src/app/game/[id]/page.tsx  
**Severity:** medium  
**Category:** spec-compliance  
**Description:** The info grid includes a Release Date column and uses `md:grid-cols-4`. The spec defines a two-column Developer/Publisher grid only.  
**Evidence:** Spec says "two-column Developer/Publisher grid." The implementation renders a wider grid with additional metadata columns.  
**Recommendation:** Reduce the info grid to two columns (Developer, Publisher) as specified, or confirm with the product owner that the expanded layout is an intentional extension.

---

## Finding 4: Re-enrich SSE start event omits `totalRemaining`

**File:** src/app/api/enrich/refresh/route.ts  
**Severity:** low  
**Category:** spec-compliance  
**Description:** The SSE `start` event sent at the beginning of the re-enrich stream does not include a `totalRemaining` field. The spec requires this field so the client can render a progress indicator from the outset.  
**Evidence:** Spec section on Re-Enrich SSE protocol lists `{ type: "start", totalRemaining: N }` as the required shape of the first event.  
**Recommendation:** Include `totalRemaining: games.length` (or the filtered count) in the initial `start` SSE payload.

---

## Finding 5: Re-enrich `remaining` count can diverge from missing-field filter

**File:** src/app/api/enrich/refresh/route.ts  
**Severity:** medium  
**Category:** correctness  
**Description:** The route filters games using a `safeJsonParse(...).length === 0` check for missing fields, but the `remaining` counter in the SSE progress events is decremented based on the original unfiltered list length. If some games are skipped by the filter, the reported `remaining` count will overshoot zero and the client-side progress bar will never reach 100%.  
**Evidence:** The decrement logic operates on a pre-filter index rather than the post-filter count, causing an off-by-N error in the SSE `progress` events.  
**Recommendation:** Compute and track `remaining` against the filtered game list (post missing-field check), not the raw query result.
