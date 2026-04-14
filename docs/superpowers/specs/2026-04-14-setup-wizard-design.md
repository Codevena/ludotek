# Setup-Wizard — Design Spec

> First-run wizard that guides new users through initial configuration so they can start using Game Vault without prior knowledge of the Admin/Devices pages.

---

## Trigger & Lifecycle

- **Auto-trigger:** Home page (`/`) redirects to `/setup` when no Device with at least 1 scan path exists in the DB.
- **Persistence:** Wizard reappears on every visit to `/` until the condition is met.
- **Skip:** A "Skip setup" link is always visible, takes user to `/` (bypasses redirect for that session via query param `?skipSetup=1`).
- **Re-access:** Not accessible after setup is complete — users configure via Admin/Devices pages from then on.

### Redirect Logic

Client-side check on Home page:

```
GET /api/devices → if no device has scanPaths with length > 0 → redirect to /setup
```

The `/setup` page itself does NOT redirect — it always renders. The redirect lives only on the Home page.

---

## Route & Layout

- **Route:** `/setup`
- **Layout:** Standalone — no Sidebar, no SyncPanel, no ScanBar. Clean centered card layout.
- **Responsive:** Single-column, max-width ~640px, centered vertically and horizontally.
- **Style:** Matches existing vault theme (dark background, amber accents, vault-border, vault-text).

---

## Steps

### Step 1: Welcome

**Purpose:** Explain what Game Vault does and what the user needs to get started.

**Content:**
- Headline: "Welcome to Game Vault"
- Short description (2-3 sentences): Game Vault scans your devices for ROMs, enriches them with metadata from IGDB, and gives you a beautiful library to browse.
- "What you'll need" checklist:
  - A device with ROMs (Steam Deck, Android, local PC)
  - IGDB API credentials (free, link to Twitch Developer Portal)
- Button: "Get Started →"

**No form inputs.** Pure informational.

---

### Step 2: Add Device

**Purpose:** Create the first device so we can connect and browse files.

**Reuses:** `DeviceForm` component (`src/components/device-form.tsx`)

**Adaptations for wizard context:**
- `onCancel` is replaced with "← Back" navigation (no cancel/close behavior)
- `submitLabel` = "Test & Continue"
- After `onSubmit` succeeds (device created via `POST /api/devices`):
  - Automatically run `POST /api/devices/test-connection` with the new device
  - On success: store `deviceId` in wizard state, advance to Step 3
  - On failure: show error inline, keep user on Step 2 to fix credentials
- "Next" button disabled until device is created AND connection test passes

**Device type presets** (existing in DeviceForm):
- Steam Deck (SSH, port 22, user "deck")
- Android (FTP, port 21)
- Local PC (local protocol, no network)
- Custom (SSH, configurable)

---

### Step 3: Scan Paths

**Purpose:** Browse the device filesystem and select directories containing ROMs.

**Reuses:** `FileBrowser` component (`src/components/file-browser.tsx`)

**Layout:**
- Left: FileBrowser showing device filesystem (uses `GET /api/devices/{id}/browse`)
- Right: List of added scan paths with type badge (ROM/Steam) and remove button

**Adaptations:**
- `deviceId` comes from wizard state (Step 2)
- `onAddPath` adds path to local state + calls `PUT /api/devices/{id}` to persist
- Helper text above: "Browse to the folder(s) where your ROMs are stored and click 'Add as ROM path'"
- For Steam Deck: suggest common paths (e.g., `/home/deck/Emulation/roms`)
- "Next" button disabled until at least 1 scan path is added

---

### Step 4: API Keys

**Purpose:** Configure IGDB credentials for metadata enrichment.

**Form fields:**
- IGDB Client ID (text input)
- IGDB Client Secret (password input)
- Link: "Don't have IGDB keys? → Get them free at dev.twitch.tv" (opens in new tab)

**Behavior:**
- On "Next": save keys via `PUT /api/settings`
- "Skip" button available with warning: "Without IGDB keys, your library will show filenames only — no covers, ratings, or metadata. You can add keys later in Admin settings."
- No validation of keys at this step (IGDB auth happens during enrichment)

**Not shown (configurable later via Admin):**
- SteamGridDB key
- OpenRouter key
- Steam API key
- AI Language
- ROM Search URL

---

### Step 5: Start Scan

**Purpose:** Kick off the first library scan and hand off to the main app.

**Content:**
- Summary of what was configured:
  - Device: "{name}" ({type})
  - Scan paths: list of paths
  - IGDB: configured / skipped
- Headline: "You're all set!"
- Button: "Scan My Library →"
- On click:
  - `POST /api/devices/{id}/scan` to start the scan
  - Redirect to `/` — ScanBar in the main layout shows scan progress
  - The Home page redirect check now passes (device has scan paths), so wizard won't reappear

---

## UI Components

### StepIndicator

Horizontal progress bar at the top of the wizard card:

```
[1 Welcome] — [2 Device] — [3 Paths] — [4 API Keys] — [5 Scan]
     ●            ●           ○            ○             ○
```

- Completed steps: amber filled circle
- Current step: amber ring with pulse
- Future steps: muted circle
- Step labels shown on desktop, hidden on mobile (numbers only)

### Navigation

- **Back button** (← Back): visible on Steps 2-5, returns to previous step
- **Next button** (Next →): advances to next step, disabled until step requirements met
- **Skip setup** link: small, bottom of card, always visible

### Wizard Container

- Dark card (`bg-vault-dark border border-vault-border rounded-2xl`)
- Centered on page with subtle background (match existing app aesthetic)
- Max-width: 640px, padding: 2rem
- No scrolling within card — each step fits in viewport

---

## State Management

React `useState` in the `/setup` page component:

```typescript
interface WizardState {
  step: 1 | 2 | 3 | 4 | 5;
  deviceId: number | null;       // set after Step 2
  scanPaths: string[];            // populated in Step 3
  igdbConfigured: boolean;        // set in Step 4
}
```

- No persistence needed — if user closes browser, wizard restarts from Step 1 on next visit
- Each step writes to the backend (device, scan paths, settings) so partial progress is saved in DB even if the wizard is abandoned

---

## API Endpoints Used (all existing)

| Step | Endpoint | Method | Purpose |
|------|----------|--------|---------|
| 2 | `/api/devices` | POST | Create device |
| 2 | `/api/devices/test-connection` | POST | Validate credentials |
| 3 | `/api/devices/{id}/browse` | GET | Browse filesystem |
| 3 | `/api/devices/{id}` | PUT | Update scan paths |
| 4 | `/api/settings` | PUT | Save API keys |
| 5 | `/api/devices/{id}/scan` | POST | Start scan |
| Home | `/api/devices` | GET | Check if setup needed |

**No new API endpoints required.**

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| User has device but no scan paths | Wizard appears (scan paths check) |
| User abandons wizard after Step 2 | Device exists in DB, wizard reappears next visit (no scan paths yet) |
| User abandons after Step 3 | Device + paths exist, wizard does NOT reappear (condition met) |
| User skips Step 4 (API keys) | Fine — library scans work without IGDB, just no metadata |
| Connection test fails | Error shown inline, user stays on Step 2 |
| File browser fails | Error shown inline in Step 3, user can retry |
| Multiple devices needed | Wizard handles first device only; add more via Devices page |
| DB already has games but no device | Edge case from manual DB manipulation — wizard still appears |

---

## What's NOT in Scope

- **i18n / Language selection** — App is English-only for now
- **Multiple device setup** — Wizard adds one device; more via Devices page
- **Blacklist configuration** — Defaults work; configurable in Devices page
- **OpenRouter / SteamGridDB / Steam keys** — Optional, configurable in Admin
- **Onboarding tooltips on main app** — Just the wizard, nothing after
- **Animations / transitions between steps** — Simple mount/unmount, no framer-motion
