import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDecryptedDevice } from "@/lib/encryption";
import { withDeviceFiles } from "@/lib/device-jobs";
import { AdmissionError, admissionResponse } from "@/lib/job-admission";
import { runSyncDoctor, type DoctorFinding, type DoctorSummary } from "@/lib/sync-doctor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
const errorResponse = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
function deviceNumber(id: string): number | null {
  if (!/^[1-9]\d{0,9}$/.test(id)) return null;
  const value = Number(id);
  return value <= 2147483647 ? value : null;
}

/** Reading an immutable report never opens the device connection. */
export async function GET(request: NextRequest, { params }: Params) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const deviceId = deviceNumber((await params).id);
  if (deviceId === null) return errorResponse("Ungültige Geräte-ID.", 400);
  const query = new URL(request.url).searchParams;
  const reportId = query.get("reportId");
  const rawOffset = query.get("offset") ?? "0";
  const rawTake = query.get("take") ?? "200";
  if ((reportId !== null && !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(reportId)) || !/^\d{1,6}$/.test(rawOffset) || !/^\d{1,3}$/.test(rawTake) || Number(rawOffset) > 100000 || Number(rawTake) < 1 || Number(rawTake) > 200) {
    return errorResponse("Ungültige Berichtsseite.", 400);
  }
  try {
    const report = await prisma.doctorReport.findFirst({ where: { deviceId, ...(reportId ? { id: reportId } : {}) }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    if (!report) return errorResponse("Für dieses Gerät liegt kein passender Diagnosebericht vor.", 404);
    if (Buffer.byteLength(report.findings) > 32 * 1024 * 1024 || Buffer.byteLength(report.summary) > 65536) throw new Error("Invalid stored report");
    const findings = JSON.parse(report.findings) as DoctorFinding[];
    const summary = JSON.parse(report.summary) as DoctorSummary;
    if (!Array.isArray(findings) || findings.length > 100000 || !summary || typeof summary !== "object") throw new Error("Invalid stored report");
    const offset = Number(rawOffset);
    const take = Number(rawTake);
    return NextResponse.json({ reportId: report.id, complete: report.complete, createdAt: report.createdAt.toISOString(), summary,
      findings: findings.slice(offset, offset + take), total: findings.length, nextOffset: offset + take < findings.length ? offset + take : null }, { headers: { "Cache-Control": "no-store" } });
  } catch { return errorResponse("Der gespeicherte Bericht konnte nicht gelesen werden.", 503); }
}

export async function POST(request: NextRequest, { params }: Params) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const deviceId = deviceNumber((await params).id);
  if (deviceId === null) return errorResponse("Ungültige Geräte-ID.", 400);
  try {
    return await withDeviceFiles([deviceId], request, async (jobs) => {
      const device = await getDecryptedDevice(deviceId);
      if (!device) return errorResponse("Gerät nicht gefunden.", 404);
      const report = await runSyncDoctor(prisma, device, jobs);
      return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
    });
  } catch (error) {
    if (error instanceof AdmissionError) return admissionResponse(error);
    if (request.signal.aborted) return errorResponse("Diagnose abgebrochen.", 408);
    if (error instanceof Error && (error.message === "Invalid Doctor device configuration" || error instanceof SyntaxError)) return errorResponse("Die Scanwurzeln dieses Geräts sind nicht gültig konfiguriert.", 400);
    return errorResponse("Die Diagnose konnte nicht sicher abgeschlossen werden.", 503);
  }
}
