import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const PREFIX = "enc:v1:";

// ── Key Management ──

let _key: Buffer | null = null;

function getKey(): Buffer {
  if (_key) return _key;

  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    const buf = Buffer.from(envKey, "hex");
    if (buf.length !== 32) {
      throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
    }
    _key = buf;
    return _key;
  }

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

  if (!existsSync(keyDir)) {
    mkdirSync(keyDir, { recursive: true });
  }
  const newKey = randomBytes(32);
  try {
    writeFileSync(keyPath, newKey.toString("hex"), { mode: 0o600, flag: "wx" });
    console.warn("Generated new encryption key at data/.encryption-key");
    _key = newKey;
  } catch {
    // Another process created the file first — read it instead
    const hex = readFileSync(keyPath, "utf-8").trim();
    _key = Buffer.from(hex, "hex");
  }
  return _key;
}

// ── Encrypt / Decrypt ──

export function encrypt(plaintext: string): string {
  if (!plaintext || isEncrypted(plaintext)) return plaintext;
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

// On a genuine decryption FAILURE (an enc:v1:-prefixed value we can't decrypt),
// return "" rather than the raw ciphertext. Returning the ciphertext meant it
// got used verbatim as an SSH/FTP password or API key, producing opaque "auth
// failed" errors that look like wrong credentials instead of a wrong key. "" is
// the same sentinel as an unset secret (DB default), so callers' existing
// "not configured" / connection guards handle it gracefully — and the logged
// error points at the real cause (ENCRYPTION_KEY). Note: a non-prefixed value
// is NOT a failure (it's un-migrated plaintext) and is still passed through.
export function decrypt(stored: string): string {
  if (!stored || !stored.startsWith(PREFIX)) return stored;
  const key = getKey();
  const parts = stored.slice(PREFIX.length).split(":");
  if (parts.length !== 3) {
    console.error("Failed to decrypt: malformed encrypted value — returning empty");
    return "";
  }
  const [ivHex, tagHex, ciphertextHex] = parts;
  if (ivHex.length !== IV_LENGTH * 2 || tagHex.length !== 32) {
    console.error("Failed to decrypt: invalid IV or auth tag length — returning empty");
    return "";
  }
  try {
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    console.error(
      "Failed to decrypt value — wrong ENCRYPTION_KEY or corrupted data; returning empty",
    );
    return "";
  }
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
