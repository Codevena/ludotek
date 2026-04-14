import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { cacheAllImages } from "@/lib/image-cache";

let batchRunning = false;

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  if (batchRunning) {
    return NextResponse.json(
      { error: "Batch caching is already running" },
      { status: 409 },
    );
  }

  batchRunning = true;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // Stream closed
        }
      };

      try {
        await cacheAllImages((done: number, total: number) => {
          send({ type: "progress", done, total });
        });
        send({ type: "done" });
      } catch (error) {
        console.error("Batch cache error:", error);
        send({
          type: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        batchRunning = false;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
