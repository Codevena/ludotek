export class RequestBodyError extends Error {
  constructor(message: string, readonly status: 400 | 408 | 413 = 400) { super(message); this.name = "RequestBodyError"; }
}

/** Bound bytes and elapsed time before parsing potentially nested client JSON. */
export async function readBoundedJson(request: Request, maxBytes = 1024 * 1024, timeoutMs = 5000): Promise<unknown> {
  if (!request.body) throw new RequestBodyError("JSON body is required");
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 5 * 1024 * 1024 || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) throw new Error("Invalid request body limits");
  const length = request.headers.get("Content-Length");
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw new RequestBodyError("Request body exceeds its byte limit", 413);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let reject!: (error: unknown) => void;
  const interrupted = new Promise<never>((_resolve, failure) => { reject = failure; });
  const abort = () => reject(new RequestBodyError("Request was aborted", 408));
  const timer = setTimeout(() => reject(new RequestBodyError("Request body deadline exceeded", 408)), timeoutMs);
  request.signal.addEventListener("abort", abort, { once: true });
  try {
    request.signal.throwIfAborted();
    for (;;) {
      const chunk = await Promise.race([reader.read(), interrupted]);
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes || chunks.length >= 4096) throw new RequestBodyError("Request body exceeds its byte or chunk limit", 413);
      chunks.push(chunk.value);
    }
    const buffer = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer)); }
    catch { throw new RequestBodyError("Invalid UTF-8 JSON body"); }
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abort);
    try { await reader.cancel(); } catch { /* Retain the original input error. */ }
    reader.releaseLock();
  }
}
