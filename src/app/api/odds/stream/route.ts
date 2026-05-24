import { getOpportunities } from "@/services/ev-engine";

export const dynamic = "force-dynamic";

/** Server-Sent Events for real-time bet updates (polling alternative to WebSocket) */
export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = () => {
        const bets = getOpportunities();
        const data = `data: ${JSON.stringify({ bets, ts: Date.now() })}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      send();
      const interval = setInterval(send, 15000);

      reqSignal(controller, interval);
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

function reqSignal(
  controller: ReadableStreamDefaultController,
  interval: ReturnType<typeof setInterval>
) {
  // Abort on client disconnect handled by platform; cleanup interval on close
  if (typeof interval !== "undefined") {
    setTimeout(() => clearInterval(interval), 3600000);
  }
}
