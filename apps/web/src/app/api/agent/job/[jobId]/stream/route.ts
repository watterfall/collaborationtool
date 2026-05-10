// Phase 2.5 ADR-0008 §2.1: agent-job SSE stream endpoint.
//
// GET /api/agent/job/<jobId>/stream?cursor=<lastEventId>
//   → text/event-stream:
//     event: progress  data: {fraction, message}
//     event: partial   data: {revisionId, threadId, note}
//     event: done      data: {outputRevisionIds, outputThreadIds, cost}
//     event: error     data: {errorClass, errorMessage}
//
// SSE re-connect: clients pass `cursor` (the last event id they saw)
// and we replay subsequent rows from `agent_job_event` before tailing
// new ones.
//
// Phase 2.5 stub: poll-based tailing (1s interval). Phase 3 switches
// to PG LISTEN/NOTIFY when worker writes a new event.

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { and, eq, gt } from 'drizzle-orm';

import { schema } from '@collaborationtool/drizzle';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';

const TAIL_INTERVAL_MS = 1000;
const MAX_STREAM_DURATION_MS = 15 * 60 * 1000; // 15 min cap

export async function GET(
  request: Request,
  ctx: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const { jobId } = await ctx.params;
  if (!jobId) {
    return NextResponse.json({ error: 'missing-job-id' }, { status: 400 });
  }

  const url = new URL(request.url);
  const cursorRaw = url.searchParams.get('cursor');
  let cursor = cursorRaw ? Number(cursorRaw) : 0;
  if (!Number.isFinite(cursor) || cursor < 0) cursor = 0;

  const db = getDb();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const startedAt = Date.now();
      let closed = false;

      function sendEvent(
        eventName: string,
        id: number,
        data: unknown,
      ): void {
        const out =
          `id: ${id}\n` +
          `event: ${eventName}\n` +
          `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(out));
      }

      // Initial heartbeat so client knows the stream is alive.
      controller.enqueue(encoder.encode(`: hello\n\n`));

      while (!closed) {
        if (Date.now() - startedAt > MAX_STREAM_DURATION_MS) {
          sendEvent('error', cursor, {
            errorClass: 'StreamTimeout',
            errorMessage: 'stream exceeded 15 min; reconnect with cursor',
          });
          controller.close();
          return;
        }
        const rows = await db
          .select()
          .from(schema.agentJobEvent)
          .where(
            and(
              eq(schema.agentJobEvent.jobId, jobId),
              gt(schema.agentJobEvent.id, cursor),
            ),
          )
          .orderBy(schema.agentJobEvent.id);

        for (const row of rows) {
          sendEvent(row.eventKind, row.id, row.payload);
          cursor = row.id;
          if (row.eventKind === 'done' || row.eventKind === 'error') {
            controller.close();
            return;
          }
        }

        // Sleep before next poll.
        await new Promise<void>((resolve) =>
          setTimeout(resolve, TAIL_INTERVAL_MS),
        );
      }
    },
    cancel() {
      // Client disconnected; loop exits at next iteration.
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
      connection: 'keep-alive',
    },
  });
}
