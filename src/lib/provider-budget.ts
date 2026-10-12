import { AdmissionError, AdmissionStore, admissionStore, getJobContext, PROVIDER_CAPS, type Lease, type Provider, type ProviderCaps } from "@/lib/job-admission";

type DispatchOptions = {
  signal?: AbortSignal;
  store?: AdmissionStore;
  caps?: ProviderCaps;
  wait?: boolean;
  timeoutMs?: number;
  maxBytes?: number;
};

export function isAdmissionError(error: unknown): error is AdmissionError { return error instanceof AdmissionError; }

export function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const onAbort = () => { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); reject(signal?.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function reserve(provider: Provider, store: AdmissionStore, options: DispatchOptions, signal: AbortSignal): Promise<Lease> {
  let waiter: Lease | undefined;
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(new AdmissionError(429, "Provider wait deadline exceeded")), 65000);
  const waitingSignal = AbortSignal.any([signal, deadline.signal]);
  try {
    for (;;) {
      waitingSignal.throwIfAborted();
      await getJobContext()?.assertActive();
      try { return await store.reserveProvider(provider, options.caps ?? PROVIDER_CAPS[provider]); }
      catch (error) {
        if (!(error instanceof AdmissionError) || error.status !== 429 || error.reason.includes("long-term") || options.wait === false) throw error;
        waiter ??= await store.acquireWaiter(provider);
        // This queue lease bounds waiting across processes; no database transaction stays open here.
        await abortableDelay(Math.min(error.retryAfter * 1000, 1000), waitingSignal);
      }
    }
  } finally {
    clearTimeout(timer);
    await waiter?.release();
  }
}

/** Reserves each actual HTTP attempt. Body consumption belongs to the same timeout and concurrency slot. */
export async function providerFetch(provider: Provider, url: string | URL, init: RequestInit = {}, options: DispatchOptions = {}): Promise<Response> {
  if (!(provider in PROVIDER_CAPS)) throw new Error("Invalid provider");
  const maxAllowed = provider === "image" ? 20 * 1024 * 1024 : 4 * 1024 * 1024;
  const maxBytes = options.maxBytes ?? maxAllowed;
  const timeoutMs = options.timeoutMs ?? 60000;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > maxAllowed || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) {
    throw new Error("Invalid provider request limits");
  }
  const job = getJobContext();
  const parentSignal = AbortSignal.any([...(init.signal ? [init.signal] : []), ...(options.signal ? [options.signal] : []), ...(job ? [job.signal] : [])]);
  parentSignal.throwIfAborted();
  const slot = await reserve(provider, options.store ?? admissionStore, options, parentSignal);
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(new AdmissionError(503, "Provider request timed out")), timeoutMs);
  const signal = AbortSignal.any([parentSignal, timeout.signal]);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    await job?.assertActive();
    signal.throwIfAborted();
    // Redirects are returned to the caller, not silently dispatched without another reservation.
    const response = await fetch(url, { ...init, redirect: "manual", signal });
    signal.throwIfAborted();
    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > maxBytes) {
      void response.body?.cancel().catch(() => undefined);
      throw new AdmissionError(503, "Provider response exceeds byte limit");
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    if (response.body) {
      reader = response.body.getReader();
      const cancel = () => { void reader?.cancel(signal.reason).catch(() => undefined); };
      signal.addEventListener("abort", cancel, { once: true });
      try {
        for (;;) {
          signal.throwIfAborted();
          const { done, value } = await reader.read();
          signal.throwIfAborted();
          if (done) break;
          total += value.byteLength;
          if (total > maxBytes) throw new AdmissionError(503, "Provider response exceeds byte limit");
          chunks.push(value);
        }
      } finally { signal.removeEventListener("abort", cancel); }
    }
    await job?.assertActive();
    signal.throwIfAborted();
    const headers = new Headers(response.headers);
    headers.delete("content-encoding");
    headers.delete("content-length");
    return new Response([204, 205, 304].includes(response.status) ? null : Buffer.concat(chunks), { status: response.status, statusText: response.statusText, headers });
  } catch (error) {
    void reader?.cancel(error).catch(() => undefined);
    throw error;
  } finally {
    clearTimeout(timer);
    reader?.releaseLock();
    await slot.release();
  }
}
