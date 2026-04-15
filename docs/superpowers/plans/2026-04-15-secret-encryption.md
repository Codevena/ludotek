# Secret Encryption at Rest — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encrypt device passwords and API keys at rest in SQLite using AES-256-GCM, with auto-generated or user-provided encryption key.

**Architecture:** New `src/lib/encryption.ts` module provides `encrypt()`, `decrypt()`, `getDecryptedDevice()`, `getDecryptedSettings()`, and `migrateSecretsIfNeeded()`. Write paths (device/settings API routes) encrypt before saving. Read paths use helper functions that decrypt after fetching. Auto-migration runs at app startup via Next.js instrumentation hook.

**Tech Stack:** Node.js `crypto` module (built-in), Next.js instrumentation API

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/encryption.ts` | Create | Core crypto: encrypt, decrypt, key management, helpers, migration |
| `src/instrumentation.ts` | Create | Next.js startup hook — runs auto-migration |
| `src/app/api/devices/route.ts` | Modify | Encrypt password on device creation |
| `src/app/api/devices/[id]/route.ts` | Modify | Encrypt password on device update |
| `src/app/api/settings/route.ts` | Modify | Encrypt secrets on settings update |
| `src/app/api/devices/[id]/browse/route.ts` | Modify | Use getDecryptedDevice |
| `src/app/api/devices/[id]/test/route.ts` | Modify | Use getDecryptedDevice |
| `src/app/api/devices/[id]/files/route.ts` | Modify | Use getDecryptedDevice |
| `src/app/api/devices/[id]/files/rename/route.ts` | Modify | Use getDecryptedDevice |
| `src/app/api/devices/[id]/files/mkdir/route.ts` | Modify | Use getDecryptedDevice |
| `src/app/api/devices/[id]/files/preview/route.ts` | Modify | Use getDecryptedDevice |
| `src/app/api/devices/[id]/scan/route.ts` | Modify | Use getDecryptedDevice |
| `src/app/api/devices/transfer/route.ts` | Modify | Use getDecryptedDevice |
| `src/app/api/upload/process/route.ts` | Modify | Use getDecryptedDevice + getDecryptedSettings |
| `src/app/api/sync/apply/route.ts` | Modify | Use getDecryptedDevice |
| `src/lib/scan-runner.ts` | Modify | Use getDecryptedDevice |
| `src/app/api/enrich/route.ts` | Modify | Use getDecryptedSettings |
| `src/app/api/enrich/refresh/route.ts` | Modify | Use getDecryptedSettings |
| `src/app/api/enrich/ai/route.ts` | Modify | Use getDecryptedSettings |
| `src/app/api/enrich/metacritic/route.ts` | Modify | Use getDecryptedSettings |
| `src/app/api/games/[id]/enrich/route.ts` | Modify | Use getDecryptedSettings |
| `src/app/api/games/[id]/search/route.ts` | Modify | Use getDecryptedSettings |
| `src/app/api/discover/route.ts` | Modify | Use getDecryptedSettings |
| `src/app/api/platforms/[id]/missing/route.ts` | Modify | Use getDecryptedSettings |
| `.env.example` | Modify | Add ENCRYPTION_KEY |
| `.gitignore` | Modify | Add data/.encryption-key |

---

### Task 1: Encryption Module

**Files:**
- Create: `src/lib/encryption.ts`

- [ ] **Step 1: Create the encryption module**

```typescript
// src/lib/encryption.ts
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const PREFIX = "enc:v1:";

// ── Key Management ──

let _key: Buffer | null = null;

function getKey(): Buffer {
  if (_key) return _key;

  // 1. Check ENV
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    const buf = Buffer.from(envKey, "hex");
    if (buf.length !== 32) {
      throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
    }
    _key = buf;
    return _key;
  }

  // 2. Check file
  const keyDir = path.resolve(process.cwd(), "data");
  const keyPath = path.join(keyDir, ".encryption-key");

  if (existsSync(keyPath)) {
    const hex = readFileSync(keyPath, "utf-8").trim();
    const buf = Buffer.from(hex, "hex");
    if (buf.length !== 32) {
      throw new Error(`Invalid encryption key file at ${keyPath}`);
    }
    _key = buf;
    return _key;
  }

  // 3. Generate new key
  if (!existsSync(keyDir)) {
    mkdirSync(keyDir, { recursive: true });
  }
  const newKey = randomBytes(32);
  writeFileSync(keyPath, newKey.toString("hex"), { mode: 0o600 });
  console.warn("Generated new encryption key at data/.encryption-key");
  _key = newKey;
  return _key;
}

// ── Encrypt / Decrypt ──

export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext;
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(stored: string): string {
  if (!stored || !stored.startsWith(PREFIX)) return stored;
  const key = getKey();
  const parts = stored.slice(PREFIX.length).split(":");
  if (parts.length !== 3) return stored;
  const [ivHex, tagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

// ── Helper Functions ──

export async function getDecryptedDevice(id: number) {
  const device = await prisma.device.findUnique({ where: { id } });
  if (!device) return null;
  return { ...device, password: decrypt(device.password) };
}

export async function getDecryptedSettings() {
  const settings = await prisma.settings.findFirst({ where: { id: 1 } });
  if (!settings) return null;
  return {
    ...settings,
    igdbClientSecret: decrypt(settings.igdbClientSecret),
    steamgriddbKey: decrypt(settings.steamgriddbKey),
    openrouterKey: decrypt(settings.openrouterKey),
    steamApiKey: decrypt(settings.steamApiKey),
  };
}

// ── Auto-Migration ──

const SECRET_SETTINGS_FIELDS = [
  "igdbClientSecret",
  "steamgriddbKey",
  "openrouterKey",
  "steamApiKey",
] as const;

export async function migrateSecretsIfNeeded() {
  let migrated = 0;

  // Migrate device passwords
  const devices = await prisma.device.findMany();
  for (const device of devices) {
    if (device.password && !isEncrypted(device.password)) {
      await prisma.device.update({
        where: { id: device.id },
        data: { password: encrypt(device.password) },
      });
      migrated++;
    }
  }

  // Migrate settings secrets
  const settings = await prisma.settings.findFirst({ where: { id: 1 } });
  if (settings) {
    const updates: Record<string, string> = {};
    for (const field of SECRET_SETTINGS_FIELDS) {
      const value = settings[field];
      if (value && !isEncrypted(value)) {
        updates[field] = encrypt(value);
        migrated++;
      }
    }
    if (Object.keys(updates).length > 0) {
      await prisma.settings.update({ where: { id: 1 }, data: updates });
    }
  }

  if (migrated > 0) {
    console.warn(`Encrypted ${migrated} plaintext secret(s) in database`);
  }
}
```

- [ ] **Step 2: Run build to verify**

```bash
pnpm build
```

Expected: Compiles with no errors. The module is not yet imported anywhere.

- [ ] **Step 3: Commit**

```bash
git add src/lib/encryption.ts
git commit -m "feat(security): add AES-256-GCM encryption module with key management"
```

---

### Task 2: Auto-Migration at Startup

**Files:**
- Create: `src/instrumentation.ts`
- Modify: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Create Next.js instrumentation hook**

```typescript
// src/instrumentation.ts
export async function register() {
  // Only run on the server (not edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { migrateSecretsIfNeeded } = await import("@/lib/encryption");
    await migrateSecretsIfNeeded();
  }
}
```

- [ ] **Step 2: Update .env.example**

Add the optional encryption key:

```
DATABASE_URL="file:./dev.db"
ADMIN_TOKEN=""
# ENCRYPTION_KEY=""  # Optional: 64 hex chars (32 bytes). Auto-generated if not set.
```

- [ ] **Step 3: Update .gitignore**

Add the auto-generated key file. Search for an existing `data/` section or add at the end:

```
# Encryption key
data/.encryption-key
```

- [ ] **Step 4: Enable instrumentation in next.config**

Check if `next.config.ts` or `next.config.mjs` exists and verify `instrumentationHook` is enabled. In Next.js 15+, instrumentation is enabled by default — no config change needed. Verify by running:

```bash
pnpm build
```

Expected: Build succeeds. On `pnpm dev`, the console should show `Encrypted N plaintext secret(s) in database` if there are unencrypted secrets in the DB.

- [ ] **Step 5: Commit**

```bash
git add src/instrumentation.ts .env.example .gitignore
git commit -m "feat(security): add auto-migration for plaintext secrets at startup"
```

---

### Task 3: Encrypt on Write — Device Routes

**Files:**
- Modify: `src/app/api/devices/route.ts`
- Modify: `src/app/api/devices/[id]/route.ts`

- [ ] **Step 1: Encrypt password in device creation**

In `src/app/api/devices/route.ts`, add import at top:

```typescript
import { encrypt } from "@/lib/encryption";
```

Change the device creation (around line 75) from:

```typescript
const device = await prisma.device.create({
  data: {
    name,
    type,
    protocol,
    host,
    port,
    user,
    password,
```

To:

```typescript
const device = await prisma.device.create({
  data: {
    name,
    type,
    protocol,
    host,
    port,
    user,
    password: encrypt(password),
```

- [ ] **Step 2: Encrypt password in device update**

In `src/app/api/devices/[id]/route.ts`, add import at top:

```typescript
import { encrypt } from "@/lib/encryption";
```

Change the password update check (around line 82) from:

```typescript
if (body.password !== undefined && body.password !== PASSWORD_MASK) {
  data.password = body.password;
}
```

To:

```typescript
if (body.password !== undefined && body.password !== PASSWORD_MASK) {
  data.password = encrypt(body.password);
}
```

- [ ] **Step 3: Run build**

```bash
pnpm build
```

Expected: Compiles with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/devices/route.ts src/app/api/devices/[id]/route.ts
git commit -m "feat(security): encrypt device passwords on write"
```

---

### Task 4: Encrypt on Write — Settings Route

**Files:**
- Modify: `src/app/api/settings/route.ts`

- [ ] **Step 1: Encrypt secrets in settings update**

In `src/app/api/settings/route.ts`, add import at top:

```typescript
import { encrypt } from "@/lib/encryption";
```

In the PUT handler, after the field loop that builds the `data` object (around line 48), add encryption before the upsert:

```typescript
// Encrypt secret fields before saving
const secretFields = ["igdbClientSecret", "steamgriddbKey", "openrouterKey", "steamApiKey"];
for (const field of secretFields) {
  if (data[field]) {
    data[field] = encrypt(data[field]);
  }
}
```

Add this just before the `prisma.settings.upsert()` call.

- [ ] **Step 2: Run build**

```bash
pnpm build
```

Expected: Compiles with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/settings/route.ts
git commit -m "feat(security): encrypt API keys on settings write"
```

---

### Task 5: Decrypt on Read — Device Routes

**Files:**
- Modify: `src/app/api/devices/[id]/browse/route.ts`
- Modify: `src/app/api/devices/[id]/test/route.ts`
- Modify: `src/app/api/devices/[id]/files/route.ts`
- Modify: `src/app/api/devices/[id]/files/rename/route.ts`
- Modify: `src/app/api/devices/[id]/files/mkdir/route.ts`
- Modify: `src/app/api/devices/[id]/files/preview/route.ts`
- Modify: `src/app/api/devices/[id]/scan/route.ts`
- Modify: `src/app/api/devices/transfer/route.ts`
- Modify: `src/app/api/upload/process/route.ts`
- Modify: `src/app/api/sync/apply/route.ts`
- Modify: `src/lib/scan-runner.ts`

In each file, apply the same pattern:

1. Add import: `import { getDecryptedDevice } from "@/lib/encryption";`
2. Replace `prisma.device.findUnique({ where: { id: deviceId } })` with `getDecryptedDevice(deviceId)`
3. The return type is the same (device object with password field), just decrypted

- [ ] **Step 1: Update browse route**

In `src/app/api/devices/[id]/browse/route.ts`:

Add import:
```typescript
import { getDecryptedDevice } from "@/lib/encryption";
```

Replace (around line 24):
```typescript
const device = await prisma.device.findUnique({ where: { id: deviceId } });
```
With:
```typescript
const device = await getDecryptedDevice(deviceId);
```

- [ ] **Step 2: Update test route**

In `src/app/api/devices/[id]/test/route.ts`:

Add import:
```typescript
import { getDecryptedDevice } from "@/lib/encryption";
```

Replace (around line 23):
```typescript
const device = await prisma.device.findUnique({ where: { id: deviceId } });
```
With:
```typescript
const device = await getDecryptedDevice(deviceId);
```

- [ ] **Step 3: Update files route (delete)**

In `src/app/api/devices/[id]/files/route.ts`:

Add import:
```typescript
import { getDecryptedDevice } from "@/lib/encryption";
```

Replace the `prisma.device.findUnique` call (around line 23) with:
```typescript
const device = await getDecryptedDevice(deviceId);
```

- [ ] **Step 4: Update files/rename route**

In `src/app/api/devices/[id]/files/rename/route.ts`:

Add import:
```typescript
import { getDecryptedDevice } from "@/lib/encryption";
```

Replace the `prisma.device.findUnique` call with:
```typescript
const device = await getDecryptedDevice(deviceId);
```

- [ ] **Step 5: Update files/mkdir route**

In `src/app/api/devices/[id]/files/mkdir/route.ts`:

Add import:
```typescript
import { getDecryptedDevice } from "@/lib/encryption";
```

Replace the `prisma.device.findUnique` call with:
```typescript
const device = await getDecryptedDevice(deviceId);
```

- [ ] **Step 6: Update files/preview route**

In `src/app/api/devices/[id]/files/preview/route.ts`:

Add import:
```typescript
import { getDecryptedDevice } from "@/lib/encryption";
```

Replace the `prisma.device.findUnique` call with:
```typescript
const device = await getDecryptedDevice(deviceId);
```

- [ ] **Step 7: Update scan route**

In `src/app/api/devices/[id]/scan/route.ts`:

Add import:
```typescript
import { getDecryptedDevice } from "@/lib/encryption";
```

Replace (around line 23):
```typescript
const device = await prisma.device.findUnique({ where: { id: deviceId } });
```
With:
```typescript
const device = await getDecryptedDevice(deviceId);
```

- [ ] **Step 8: Update transfer route**

In `src/app/api/devices/transfer/route.ts`:

Add import:
```typescript
import { getDecryptedDevice } from "@/lib/encryption";
```

Replace (around lines 205-206):
```typescript
prisma.device.findUnique({ where: { id: body.sourceDeviceId } }),
prisma.device.findUnique({ where: { id: body.targetDeviceId } }),
```
With:
```typescript
getDecryptedDevice(body.sourceDeviceId),
getDecryptedDevice(body.targetDeviceId),
```

- [ ] **Step 9: Update upload/process route**

In `src/app/api/upload/process/route.ts`:

Add import:
```typescript
import { getDecryptedDevice } from "@/lib/encryption";
```

Replace (around line 62):
```typescript
const targetDevice = await prisma.device.findUnique({ where: { id: targetDeviceId } });
```
With:
```typescript
const targetDevice = await getDecryptedDevice(targetDeviceId);
```

- [ ] **Step 10: Update sync/apply route**

In `src/app/api/sync/apply/route.ts`:

Add import:
```typescript
import { getDecryptedDevice } from "@/lib/encryption";
```

Find where devices are fetched for connection (around line 45-60). The pattern varies — look for `prisma.device.findUnique` calls used for creating connections and replace with `getDecryptedDevice`.

- [ ] **Step 11: Update scan-runner.ts**

In `src/lib/scan-runner.ts`:

Add import:
```typescript
import { decrypt } from "@/lib/encryption";
```

The scan runner fetches devices via `prisma.device.findMany()` (lines 29-30). Since `getDecryptedDevice` works on single IDs, decrypt the password inline where it's used (around line 97):

Replace:
```typescript
password: device.password,
```
With:
```typescript
password: decrypt(device.password),
```

- [ ] **Step 12: Run build**

```bash
pnpm build
```

Expected: Compiles with no errors.

- [ ] **Step 13: Commit**

```bash
git add src/app/api/devices/ src/app/api/sync/ src/app/api/upload/ src/lib/scan-runner.ts
git commit -m "feat(security): decrypt device passwords on read"
```

---

### Task 6: Decrypt on Read — Settings Routes

**Files:**
- Modify: `src/app/api/enrich/route.ts`
- Modify: `src/app/api/enrich/refresh/route.ts`
- Modify: `src/app/api/enrich/ai/route.ts`
- Modify: `src/app/api/enrich/metacritic/route.ts`
- Modify: `src/app/api/games/[id]/enrich/route.ts`
- Modify: `src/app/api/games/[id]/search/route.ts`
- Modify: `src/app/api/discover/route.ts`
- Modify: `src/app/api/platforms/[id]/missing/route.ts`
- Modify: `src/app/api/upload/process/route.ts` (already modified in Task 5 for device, now also settings)

In each file that reads settings and uses secret fields:

1. Add import: `import { getDecryptedSettings } from "@/lib/encryption";`
2. Replace `prisma.settings.findFirst({ where: { id: 1 } })` with `getDecryptedSettings()`

- [ ] **Step 1: Update enrich route**

In `src/app/api/enrich/route.ts`:

Add import:
```typescript
import { getDecryptedSettings } from "@/lib/encryption";
```

Replace (around line 36):
```typescript
const settings = await prisma.settings.findFirst({ where: { id: 1 } });
```
With:
```typescript
const settings = await getDecryptedSettings();
```

- [ ] **Step 2: Update enrich/refresh route**

In `src/app/api/enrich/refresh/route.ts`:

Add import:
```typescript
import { getDecryptedSettings } from "@/lib/encryption";
```

Replace:
```typescript
const settings = await prisma.settings.findFirst({ where: { id: 1 } });
```
With:
```typescript
const settings = await getDecryptedSettings();
```

- [ ] **Step 3: Update enrich/ai route**

In `src/app/api/enrich/ai/route.ts`:

Add import:
```typescript
import { getDecryptedSettings } from "@/lib/encryption";
```

Replace:
```typescript
const settings = await prisma.settings.findFirst({ where: { id: 1 } });
```
With:
```typescript
const settings = await getDecryptedSettings();
```

- [ ] **Step 4: Update enrich/metacritic route**

In `src/app/api/enrich/metacritic/route.ts`:

Add import:
```typescript
import { getDecryptedSettings } from "@/lib/encryption";
```

Replace:
```typescript
const settings = await prisma.settings.findFirst({ where: { id: 1 } });
```
With:
```typescript
const settings = await getDecryptedSettings();
```

- [ ] **Step 5: Update games/[id]/enrich route**

In `src/app/api/games/[id]/enrich/route.ts`:

Add import:
```typescript
import { getDecryptedSettings } from "@/lib/encryption";
```

Replace:
```typescript
const settings = await prisma.settings.findFirst({ where: { id: 1 } });
```
With:
```typescript
const settings = await getDecryptedSettings();
```

- [ ] **Step 6: Update games/[id]/search route**

In `src/app/api/games/[id]/search/route.ts`:

Add import:
```typescript
import { getDecryptedSettings } from "@/lib/encryption";
```

Replace:
```typescript
const settings = await prisma.settings.findFirst({ where: { id: 1 } });
```
With:
```typescript
const settings = await getDecryptedSettings();
```

- [ ] **Step 7: Update discover route**

In `src/app/api/discover/route.ts`:

Add import:
```typescript
import { getDecryptedSettings } from "@/lib/encryption";
```

Replace:
```typescript
const settings = await prisma.settings.findFirst({ where: { id: 1 } });
```
With:
```typescript
const settings = await getDecryptedSettings();
```

- [ ] **Step 8: Update platforms/[id]/missing route**

In `src/app/api/platforms/[id]/missing/route.ts`:

Add import:
```typescript
import { getDecryptedSettings } from "@/lib/encryption";
```

Replace the `prisma.settings.findFirst` call with:
```typescript
const settings = await getDecryptedSettings();
```

- [ ] **Step 9: Update upload/process route (settings part)**

In `src/app/api/upload/process/route.ts` (already has device decrypt from Task 5):

Add import (if not already present from Task 5):
```typescript
import { getDecryptedSettings } from "@/lib/encryption";
```

Replace (around line 47):
```typescript
const settings = await prisma.settings.findFirst({ where: { id: 1 } });
```
With:
```typescript
const settings = await getDecryptedSettings();
```

- [ ] **Step 10: Run build**

```bash
pnpm build
```

Expected: Compiles with no errors.

- [ ] **Step 11: Commit**

```bash
git add src/app/api/enrich/ src/app/api/games/ src/app/api/discover/ src/app/api/platforms/ src/app/api/upload/
git commit -m "feat(security): decrypt API keys on settings read"
```

---

### Task 7: Build Verify & Manual Test

**Files:** All previously modified files

- [ ] **Step 1: Full build check**

```bash
pnpm build
```

Expected: Build succeeds with zero errors.

- [ ] **Step 2: Manual test — fresh start**

1. Delete `data/.encryption-key` if it exists
2. Run `pnpm dev`
3. Check terminal: should see "Generated new encryption key" and "Encrypted N plaintext secret(s)"
4. Stop server, run again: no migration message (already encrypted)

- [ ] **Step 3: Manual test — device connection**

1. Go to Admin → add a device or use existing
2. Go to Devices → browse filesystem
3. Expected: Connection works (password decrypted correctly)

- [ ] **Step 4: Manual test — enrichment**

1. Go to Admin → trigger enrichment
2. Expected: IGDB API calls work (secret decrypted correctly)

- [ ] **Step 5: Verify DB contents**

```bash
sqlite3 prisma/dev.db "SELECT password FROM Device LIMIT 1;"
```

Expected: Shows `enc:v1:...` — not plaintext.

```bash
sqlite3 prisma/dev.db "SELECT igdbClientSecret FROM Settings LIMIT 1;"
```

Expected: Shows `enc:v1:...` — not plaintext.

- [ ] **Step 6: Commit any fixes**

```bash
git add -u
git commit -m "fix(security): polish encryption integration"
```

(Skip if no fixes needed.)

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Encryption module (encrypt, decrypt, key mgmt, helpers, migration) | `src/lib/encryption.ts` |
| 2 | Auto-migration at startup + config | `src/instrumentation.ts`, `.env.example`, `.gitignore` |
| 3 | Encrypt device passwords on write | `devices/route.ts`, `devices/[id]/route.ts` |
| 4 | Encrypt settings secrets on write | `settings/route.ts` |
| 5 | Decrypt device passwords on read (11 files) | All device connection routes + scan-runner |
| 6 | Decrypt settings secrets on read (9 files) | All enrichment/discover/search routes |
| 7 | Build verify + manual test | All files |
