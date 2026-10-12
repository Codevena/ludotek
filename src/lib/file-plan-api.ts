import { AdmissionError, admissionResponse } from "@/lib/job-admission";
import { RequestBodyError } from "@/lib/request-body";

export function validPlanId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}
export function filePlanFailure(error: unknown): Response {
  if (error instanceof AdmissionError) return admissionResponse(error);
  if (error instanceof RequestBodyError) return Response.json({ error: error.message }, { status: error.status });
  const known = error as { status?: number; name?: string; message?: string } | null;
  if (known?.name === "FilePlanError" && [400, 403, 404, 409, 413, 422, 503].includes(known.status!)) {
    return Response.json({ error: known.message }, { status: known.status });
  }
  console.warn("File plan request failed", error instanceof Error ? error.name : "Unknown error");
  return Response.json({ error: "Dateioperation fehlgeschlagen. Den gespeicherten Planstatus prüfen." }, { status: 503 });
}
