# Secret Encryption at Rest — Design Spec

> Encrypt all sensitive fields (device passwords, API keys) in the SQLite database so they are not stored as plaintext.

---

## Problem

Device passwords (SSH/FTP) and API keys (IGDB, OpenRouter, SteamGridDB, Steam) are stored as plaintext in SQLite. If the database file is leaked or accessed by an unauthorized party, all secrets are exposed. With the project going open-source, this is a security requirement before anyone forks and deploys.

## Solution

AES-256-GCM field-level encryption with auto-generated or user-provided key. Secrets are encrypted before writing to the database and decrypted when read for use (SSH connections, API calls). API responses continue to mask secrets with `********`.

---

## Crypto

- **Algorithm:** AES-256-GCM (Node.js built-in `crypto` module, no external packages)
- **Key:** 32 bytes (256 bit)
- **IV:** 12 bytes random per encryption operation (GCM standard)
- **Auth Tag:** 16 bytes (GCM provides automatically, ensures integrity)
- **Storage Format:** `enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>`
  - The `enc:v1:` prefix distinguishes encrypted values from legacy plaintext
  - Example: `enc:v1:a1b2c3d4e5f6a1b2c3d4e5f6:aabbccdd11223344aabbccdd11223344:ff00ff00`

---

## Key Management

**File:** `src/lib/encryption.ts`

### Key Resolution Order

1. `process.env.ENCRYPTION_KEY` — hex-encoded 32 bytes (64 hex chars). For power users who want external key management.
2. `data/.encryption-key` — auto-generated file. For everyone else.
3. If neither exists: generate 32 random bytes, write to `data/.encryption-key`, use that.

### Key Caching

The key is resolved once at module import time and cached as a module-level variable. No repeated file reads or ENV lookups.

### Docker Considerations

The `data/` directory is already a Docker volume (`ludotek-cache:/app/data`). The encryption key file persists across container restarts. If the volume is deleted, secrets become unrecoverable — same as losing any encryption key.

---

## Encrypted Fields

### Device Model

| Field | Currently | After |
|-------|-----------|-------|
| `password` | Plaintext `String` | Encrypted `enc:v1:...` |

### Settings Model

| Field | Currently | After |
|-------|-----------|-------|
| `igdbClientSecret` | Plaintext `String` | Encrypted `enc:v1:...` |
| `steamgriddbKey` | Plaintext `String` | Encrypted `enc:v1:...` |
| `openrouterKey` | Plaintext `String` | Encrypted `enc:v1:...` |
| `steamApiKey` | Plaintext `String` | Encrypted `enc:v1:...` |

**Not encrypted** (not secrets):
- `igdbClientId` — public identifier, not a secret
- `aiLanguage`, `romSearchUrl`, `activeDeviceId` — config, not secrets

---

## API: `src/lib/encryption.ts`

### Functions

```typescript
function encrypt(plaintext: string): string
// Returns "enc:v1:<iv>:<tag>:<ciphertext>" or empty string if input is empty

function decrypt(stored: string): string
// If starts with "enc:v1:" → decrypt and return plaintext
// If does NOT start with "enc:v1:" → return as-is (legacy plaintext, not yet migrated)
// If empty → return empty

function isEncrypted(value: string): boolean
// Returns true if value starts with "enc:v1:"
```

The `decrypt()` function's passthrough behavior for non-prefixed values is critical — it means the app works seamlessly during the migration window when some values are encrypted and some are still plaintext.

---

## Helper Functions

### `getDecryptedDevice(id: number)`

**File:** `src/lib/encryption.ts` (or separate `src/lib/device-helpers.ts`)

Fetches a device by ID and returns it with the password field decrypted. Used everywhere a device connection is needed.

```typescript
async function getDecryptedDevice(id: number): Promise<Device>
// prisma.device.findUnique({ where: { id } }) → decrypt password → return
```

### `getDecryptedSettings()`

Fetches settings and returns with all secret fields decrypted.

```typescript
async function getDecryptedSettings(): Promise<Settings>
// prisma.settings.findFirst() → decrypt igdbClientSecret, steamgriddbKey, openrouterKey, steamApiKey → return
```

---

## Encrypt on Write

### Device Creation (`POST /api/devices`)

Before `prisma.device.create()`:
```typescript
data.password = encrypt(password);
```

### Device Update (`PUT /api/devices/[id]`)

Before `prisma.device.update()`, when password is being changed:
```typescript
if (body.password !== undefined && body.password !== PASSWORD_MASK) {
  data.password = encrypt(body.password);
}
```

### Settings Update (`PUT /api/settings`)

Before `prisma.settings.upsert()`, for each secret field:
```typescript
if (data.igdbClientSecret) data.igdbClientSecret = encrypt(data.igdbClientSecret);
if (data.steamgriddbKey) data.steamgriddbKey = encrypt(data.steamgriddbKey);
if (data.openrouterKey) data.openrouterKey = encrypt(data.openrouterKey);
if (data.steamApiKey) data.steamApiKey = encrypt(data.steamApiKey);
```

---

## Decrypt on Read

Replace direct `prisma.device.findUnique()` calls with `getDecryptedDevice(id)` in:

- `src/lib/scan-runner.ts` — scan device
- `src/app/api/devices/[id]/browse/route.ts` — file browser
- `src/app/api/devices/[id]/test/route.ts` — test connection
- `src/app/api/devices/[id]/files/route.ts` — delete files
- `src/app/api/devices/[id]/files/rename/route.ts` — rename files
- `src/app/api/devices/[id]/files/mkdir/route.ts` — create directories
- `src/app/api/sync/apply/route.ts` — apply sync operations
- `src/app/api/devices/transfer/route.ts` — transfer files
- `src/app/api/upload/process/route.ts` — upload target device

Replace direct settings reads with `getDecryptedSettings()` in:
- `src/app/api/enrich/route.ts` — IGDB enrichment
- `src/app/api/enrich/refresh/route.ts` — refresh metadata
- `src/app/api/enrich/ai/route.ts` — AI content
- `src/app/api/games/[id]/enrich/route.ts` — single game enrich
- `src/app/api/discover/route.ts` — AI discover
- Any other route that reads API keys from settings

**API response routes** (`GET /api/devices`, `GET /api/settings`) do NOT need decryption — they mask secrets with `********` anyway. The encrypted value never reaches the client.

---

## Auto-Migration

### `migrateSecretsIfNeeded()`

**File:** `src/lib/encryption.ts`

Called once at app startup. Encrypts any plaintext secrets still in the database.

```
1. Read all devices
2. For each device where password is non-empty and NOT starting with "enc:v1:":
   → encrypt(password) → prisma.device.update()
3. Read settings
4. For each secret field that is non-empty and NOT starting with "enc:v1:":
   → encrypt(value) → prisma.settings.update()
5. Log count of migrated secrets
```

### Where to call it

In a Next.js instrumentation file (`src/instrumentation.ts`) which runs once on server startup. This is the standard Next.js pattern for one-time initialization.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Empty password/key | Not encrypted — empty string stays empty |
| Key changes (new ENCRYPTION_KEY env) | Old secrets unreadable — user must re-enter them |
| Key file deleted | Same as key change — secrets lost |
| DB accessed without key | Encrypted fields show `enc:v1:...` gibberish, not plaintext |
| App downgrade (code without encryption) | `decrypt()` passthrough: encrypted values passed as-is, connections fail with garbled password |
| Concurrent migrations | Idempotent — `isEncrypted()` check prevents double-encryption |

---

## Not in Scope

- Key rotation mechanism
- Password hashing (secrets must be decryptable for SSH/FTP/API use)
- ADMIN_TOKEN encryption (stays in ENV, not in DB)
- HTTPS enforcement (infrastructure concern, not app logic)
- Encrypted backups
- HSM / external key management integration
