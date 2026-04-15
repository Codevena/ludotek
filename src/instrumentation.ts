export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { migrateSecretsIfNeeded } = await import("@/lib/encryption");
    await migrateSecretsIfNeeded();
  }
}
