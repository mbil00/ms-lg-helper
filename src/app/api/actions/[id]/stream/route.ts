import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUser, userIsAdmin } from "@/lib/auth-guard";
import type { OperationProgress } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!userIsAdmin(user)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { id } = await params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: OperationProgress) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      let isCompleted = false;

      while (!isCompleted) {
        try {
          const operation = await db.operation.findUnique({
            where: { id },
            include: {
              items: {
                where: { status: "pending" },
                include: { user: true },
                take: 1,
              },
            },
          });

          if (!operation) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: "Operation not found" })}\n\n`
              )
            );
            break;
          }

          const currentUser =
            operation.items.length > 0
              ? operation.items[0].user.displayName
              : undefined;

          const progress: OperationProgress = {
            operationId: operation.id,
            status: operation.status,
            total: operation.totalCount,
            success: operation.successCount,
            skipped: operation.skippedCount,
            failed: operation.failedCount,
            currentUser,
          };

          sendEvent(progress);

          if (
            operation.status === "completed" ||
            operation.status === "failed" ||
            operation.status === "partial"
          ) {
            isCompleted = true;
          } else {
            // Poll every second
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.error("SSE stream error:", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "Stream error" })}\n\n`
            )
          );
          break;
        }
      }

      controller.close();
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
