# API-Inventar vor lokalem Admission-Umbau

Stand: vor A-01/A-10/A-11, Basis 90836cc plus geprüftes I/O-Paket. AST erfasst alle exportierten Handler und direkten Call-Signaturen, keine Werte/Secrets. Eine Guard-Signatur allein beweist weder richtige Reihenfolge noch Schutzwirkung; indirekte Effekte werden bei den jeweiligen Änderungen gegen den Code geprüft. Noch keine Produktions-/Proxy-/IP-Verifikation.

## Autoritativer Betriebsvertrag des Umbaus

| Klasse | Autorität | vorgesehene Limits | Fehlerpfad |
|---|---|---|---|
| Auth/Session | einziger Operator; fixer globaler Fehlercounter | 60 Fehlversuche/min, 1000/h; gültige Credentials bleiben prüfbar | 401/429; DB-Ausfall 503 ohne Cookie |
| Provider/AI | Operator/globaler Provider | atomare Rate/Stunde/Tag + Concurrency, Bytes, 60-s-Request; kurze Engpässe höchstens 65 s / 8 Wartende | Longbudget 429/Store 503 vor Dispatch; kurzer Wait außerhalb DB, kein Memory-Fallback |
| Enrichment | gemeinsame Ressource enrichment | genau ein aktiver Lauf, owner-gebundene Lease/Heartbeat | 409 busy, 503 Store; keine neuen Calls/Writes bei Leaseverlust |
| Geräte/Files/Upload/Scan | Operator + verifiziertes Gerät/Objekt | zentrale Wurzeln, vollständige Inventare; folgende Dateijob-Gates | Ablehnung vor Connection/Mutation; genaue Grenzen im Fileplanteil |
| günstige Reads | bestehender Readvertrag/gegebenenfalls Operator | keine teure Provider-/Job-Zulassung | keine irrtümliche Browserchallenge |

## Handlerbestand

| Methode | Quelle | aktueller Authhinweis | direkte Effektsignaturen |
|---|---|---|---|
| POST | `src/app/api/auth/route.ts:4` | Auth-/Statushandler | keine direkte Effektsignatur; Helpers prüfen |
| GET | `src/app/api/auth/route.ts:30` | Auth-/Statushandler | keine direkte Effektsignatur; Helpers prüfen |
| GET | `src/app/api/cache/[...path]/route.ts:15` | Guardaufruf vorhanden | `readFile` |
| DELETE | `src/app/api/cache/api-responses/route.ts:5` | Guardaufruf vorhanden | `clearApiCache` |
| POST | `src/app/api/cache/batch/route.ts:9` | Guardaufruf vorhanden | `cacheAllImages` |
| DELETE | `src/app/api/cache/route.ts:5` | Guardaufruf vorhanden | `getCacheStats`, `clearCache` |
| GET | `src/app/api/cache/stats/route.ts:8` | Guardaufruf vorhanden | `getCacheStats`, `getApiCacheStats` |
| POST | `src/app/api/cleanup/route.ts:7` | Guardaufruf vorhanden | `prisma.game.findMany`, `prisma.game.update`, `prisma.gameDevice.findMany`, `prisma.gameDevice.upsert`, `prisma.game.deleteMany`, `prisma.game.groupBy`, `prisma.platform.updateMany`, `prisma.game.count` |
| GET | `src/app/api/devices/[id]/browse/route.ts:8` | Guardaufruf vorhanden | `getDecryptedDevice`, `createConnection` |
| POST | `src/app/api/devices/[id]/files/mkdir/route.ts:7` | Guardaufruf vorhanden | `createConnection` |
| GET | `src/app/api/devices/[id]/files/preview/route.ts:30` | Guardaufruf vorhanden | `createConnection` |
| POST | `src/app/api/devices/[id]/files/rename/route.ts:7` | Guardaufruf vorhanden | `createConnection` |
| DELETE | `src/app/api/devices/[id]/files/route.ts:7` | Guardaufruf vorhanden | `createConnection` |
| GET | `src/app/api/devices/[id]/route.ts:19` | Guardaufruf vorhanden | `prisma.device.findUnique` |
| PUT | `src/app/api/devices/[id]/route.ts:40` | Guardaufruf vorhanden | `encrypt`, `prisma.device.update` |
| DELETE | `src/app/api/devices/[id]/route.ts:115` | Guardaufruf vorhanden | `prisma.settings.findUnique`, `prisma.settings.update`, `prisma.device.delete` |
| POST | `src/app/api/devices/[id]/scan/route.ts:7` | Guardaufruf vorhanden | `getDecryptedDevice`, `isScanRunning`, `runScanInBackground(deviceId).catch`, `runScanInBackground` |
| GET | `src/app/api/devices/[id]/test/route.ts:7` | Guardaufruf vorhanden | `getDecryptedDevice`, `createConnection` |
| POST | `src/app/api/devices/[id]/wipe/route.ts:7` | Guardaufruf vorhanden | `prisma.device.findUnique`, `prisma.gameDevice.deleteMany`, `prisma.syncQueue.deleteMany`, `prisma.game.findMany`, `prisma.game.deleteMany`, `prisma.game.groupBy`, `prisma.platform.updateMany`, `prisma.platform.upsert` |
| GET | `src/app/api/devices/route.ts:21` | Guardaufruf vorhanden | `prisma.device.findMany`, `prisma.gameDevice.count` |
| POST | `src/app/api/devices/route.ts:33` | Guardaufruf vorhanden | `prisma.device.create`, `encrypt` |
| POST | `src/app/api/devices/test-connection/route.ts:6` | Guardaufruf vorhanden | `createConnection` |
| POST | `src/app/api/devices/transfer/route.ts:134` | Guardaufruf vorhanden | `getDecryptedDevice`, `createConnection`, `runTransfer(sc, tc, body.files, body.targetPath, mode)
    .catch((err) => {
      console.error("Transfer failed:", err);
      setTransferProgress({
        transferring: false,
        error: err instanceof Error ? err.message : "Transfer failed",
      });
    })
    .finally` |
| GET | `src/app/api/devices/transfer/status/route.ts:5` | Guardaufruf vorhanden | keine direkte Effektsignatur; Helpers prüfen |
| POST | `src/app/api/devices/wipe-all/route.ts:7` | Guardaufruf vorhanden | `clearCache`, `prisma.syncQueue.deleteMany`, `prisma.gameDevice.deleteMany`, `prisma.game.deleteMany`, `prisma.platform.updateMany` |
| GET | `src/app/api/discover/genres/route.ts:15` | Guardaufruf vorhanden | `prisma.game.findMany` |
| POST | `src/app/api/discover/route.ts:46` | Guardaufruf vorhanden | `getDecryptedSettings`, `prisma.game.findMany`, `searchIgdb` |
| POST | `src/app/api/enrich/ai/route.ts:10` | Guardaufruf vorhanden | `getDecryptedSettings`, `prisma.game.findMany`, `generateGameAiContent`, `prisma.game.update`, `prisma.game.count` |
| POST | `src/app/api/enrich/metacritic/route.ts:7` | Guardaufruf vorhanden | `getDecryptedSettings`, `prisma.game.findMany`, `getIgdbToken`, `fetch`, `prisma.game.update` |
| POST | `src/app/api/enrich/refresh/route.ts:20` | Guardaufruf vorhanden | `getDecryptedSettings`, `prisma.game.findMany`, `prisma.game.update`, `cacheGameImages`, `prisma.game.count` |
| POST | `src/app/api/enrich/route.ts:33` | Guardaufruf vorhanden | `getDecryptedSettings`, `prisma.game.findMany`, `searchSteamGridDb`, `prisma.game.update`, `cacheGameImages`, `prisma.game.count` |
| POST | `src/app/api/games/[id]/enrich/route.ts:10` | Guardaufruf vorhanden | `prisma.game.findUnique`, `getDecryptedSettings`, `searchIgdb`, `searchSteamGridDb`, `prisma.game.update`, `cacheGameImages`, `generateGameAiContent` |
| POST | `src/app/api/games/[id]/favorite/route.ts:6` | Guardaufruf vorhanden | `prisma.game.update` |
| GET | `src/app/api/games/[id]/route.ts:11` | kein direkter Authguard | `prisma.game.findUnique` |
| PATCH | `src/app/api/games/[id]/route.ts:40` | Guardaufruf vorhanden | `prisma.game.update` |
| GET | `src/app/api/games/[id]/search/route.ts:7` | Guardaufruf vorhanden | `prisma.game.findUnique`, `getDecryptedSettings`, `getIgdbToken`, `fetch` |
| GET | `src/app/api/games/route.ts:7` | kein direkter Authguard | `prisma.$transaction` |
| GET | `src/app/api/insights/route.ts:32` | kein direkter Authguard | `prisma.game.findMany` |
| GET | `src/app/api/platforms/[id]/missing/route.ts:21` | kein direkter Authguard | `getDecryptedSettings`, `getIgdbToken`, `fetch`, `prisma.game.findMany` |
| GET | `src/app/api/platforms/[id]/stats/route.ts:4` | kein direkter Authguard | `prisma.platform.findUnique`, `prisma.game.count`, `prisma.game.aggregate`, `prisma.game.findMany` |
| GET | `src/app/api/platforms/route.ts:4` | kein direkter Authguard | `prisma.game.groupBy`, `prisma.platform.findMany` |
| POST | `src/app/api/scan/route.ts:6` | Guardaufruf vorhanden | `isScanRunning`, `runScanInBackground().catch`, `runScanInBackground` |
| GET | `src/app/api/scan/status/route.ts:5` | Guardaufruf vorhanden | `getScanProgress` |
| GET | `src/app/api/search/route.ts:5` | kein direkter Authguard | `prisma.game.findMany` |
| GET | `src/app/api/settings/rom-search/route.ts:5` | Guardaufruf vorhanden | `prisma.settings.findFirst` |
| GET | `src/app/api/settings/route.ts:6` | Guardaufruf vorhanden | `prisma.settings.upsert` |
| PUT | `src/app/api/settings/route.ts:25` | Guardaufruf vorhanden | `encrypt`, `prisma.settings.upsert` |
| GET | `src/app/api/setup-status/route.ts:6` | kein direkter Authguard | `prisma.device.findMany` |
| GET | `src/app/api/stats/route.ts:11` | kein direkter Authguard | `prisma.game.count`, `prisma.game.groupBy({ by: ["platform"], where: deviceFilter }).then`, `prisma.game.groupBy`, `prisma.game.aggregate` |
| POST | `src/app/api/sync/apply/route.ts:9` | Guardaufruf vorhanden | `prisma.syncQueue.updateMany`, `prisma.syncQueue.findMany`, `createConnection`, `prisma.syncQueue.update`, `prisma.gameDevice.deleteMany`, `prisma.gameDevice.findUnique`, `prisma.gameDevice.update`, `prisma.gameDevice.count`, `prisma.game.update`, `prisma.game.findMany`, `prisma.game.deleteMany`, `prisma.game.groupBy`, `prisma.platform.updateMany` |
| DELETE | `src/app/api/sync/queue/[id]/route.ts:6` | Guardaufruf vorhanden | `prisma.syncQueue.deleteMany` |
| GET | `src/app/api/sync/queue/route.ts:6` | Guardaufruf vorhanden | `prisma.syncQueue.findMany` |
| POST | `src/app/api/sync/queue/route.ts:27` | Guardaufruf vorhanden | `prisma.device.findUnique`, `isWithinScanPaths`, `prisma.syncQueue.deleteMany`, `prisma.syncQueue.findFirst`, `prisma.syncQueue.create` |
| DELETE | `src/app/api/sync/queue/route.ts:150` | Guardaufruf vorhanden | `prisma.syncQueue.deleteMany` |
| GET | `src/app/api/timeline/counts/route.ts:7` | kein direkter Authguard | `prisma.game.count` |
| POST | `src/app/api/upload/detect/route.ts:5` | Guardaufruf vorhanden | keine direkte Effektsignatur; Helpers prüfen |
| POST | `src/app/api/upload/process/route.ts:19` | Guardaufruf vorhanden | `getDecryptedSettings`, `getDecryptedDevice`, `convert`, `transferFiles`, `generateM3u`, `transferM3u`, `prisma.game.upsert`, `prisma.gameDevice.upsert`, `prisma.game.count`, `prisma.platform.upsert`, `searchIgdb`, `searchSteamGridDb`, `prisma.game.update`, `rm` |
| POST | `src/app/api/upload/route.ts:35` | Guardaufruf vorhanden | `mkdir`, `writeFile` |
| DELETE | `src/app/api/wishlist/[id]/route.ts:6` | Guardaufruf vorhanden | `prisma.wishlistItem.delete` |
| GET | `src/app/api/wishlist/check/route.ts:6` | kein direkter Authguard | `prisma.wishlistItem.findUnique` |
| GET | `src/app/api/wishlist/route.ts:6` | kein direkter Authguard | `prisma.wishlistItem.findMany` |
| POST | `src/app/api/wishlist/route.ts:29` | Guardaufruf vorhanden | `prisma.wishlistItem.upsert` |

62 exportierte Handler in 53 Routendateien. Kein Server-Action-/GraphQL-/WebSocket-Eintrittspunkt in der vorhandenen API-Struktur; vor Gesamtabschluss Projektquellen erneut prüfen. Cloudflare: für lokale/Own-LAN-Installation keine Edge-Regel; keine öffentliche Originfreigabe behauptet. Forwarded-IP-Header werden nicht als Identität eingeführt.
