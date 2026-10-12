import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { acquireScopedJob, admissionResponse, createEnrichmentStream, type EnrichmentJob } from "@/lib/job-admission";
import { discoverLan, interfaceChoices, resolveInterface } from "@/lib/lan-discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const errorResponse = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  try { return NextResponse.json({ interfaces: interfaceChoices() }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return errorResponse("Lokale Netzwerkschnittstellen konnten nicht ermittelt werden.", 503); }
}

async function readSelection(request: NextRequest): Promise<string | Response> {
  if (request.signal.aborted) return errorResponse("Anfrage abgebrochen.", 408);
  const reader = request.body?.getReader();
  if (!reader) return errorResponse("Netzwerkschnittstelle auswählen.", 400);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let timedOut = false;
  let rejectDeadline!: () => void;
  const deadline = new Promise<never>((_, reject) => { rejectDeadline = () => reject(new Error("Request cancelled")); });
  const cancel = () => { timedOut = true; rejectDeadline(); void reader.cancel().catch(() => {}); };
  const timer = setTimeout(cancel, 5000);
  request.signal.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4096) { void reader.cancel().catch(() => {}); return errorResponse("Anfrage zu groß.", 413); }
      chunks.push(value);
    }
    if (timedOut) return errorResponse("Zeitlimit beim Lesen der Anfrage.", 408);
    let input: unknown;
    try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return errorResponse("Ungültige Anfrage.", 400); }
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length !== 1 ||
      !("interfaceId" in input) || typeof input.interfaceId !== "string" || !/^[a-f0-9]{64}$/.test(input.interfaceId)) {
      return errorResponse("Nur eine angebotene Netzwerkschnittstelle auswählen.", 400);
    }
    return input.interfaceId;
  } catch { return errorResponse(timedOut ? "Zeitlimit beim Lesen der Anfrage oder Anfrage abgebrochen." : "Anfrage konnte nicht gelesen werden.", timedOut ? 408 : 400); }
  finally { clearTimeout(timer); request.signal.removeEventListener("abort", cancel); reader.releaseLock(); }
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const id = await readSelection(request);
  if (id instanceof Response) return id;
  try { resolveInterface(id); } catch { return errorResponse("Die ausgewählte Schnittstelle ist nicht mehr für die Suche verfügbar.", 400); }
  let job: EnrichmentJob;
  try { job = await acquireScopedJob("lan-discovery", request); } catch (error) { return admissionResponse(error); }
  let selected: ReturnType<typeof resolveInterface>;
  try { selected = resolveInterface(id); }
  catch {
    try { await job.close(); } catch (error) { return admissionResponse(error); }
    return errorResponse("Die Schnittstelle hat sich geändert. Bitte neu auswählen.", 400);
  }
  return createEnrichmentStream(job, async (send) => {
    send({ type: "start", total: selected.hosts.length * 2 });
    const summary = await discoverLan(selected, {
      signal: job.signal,
      assertActive: () => job.assertActive(),
      onProgress: ({ result, ...progress }) => {
        if (result) send({ type: "result", result });
        send({ type: "progress", ...progress });
      },
    });
    send({ type: "done", ...summary });
  });
}
