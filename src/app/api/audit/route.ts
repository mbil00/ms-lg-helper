import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  forbiddenResponse,
  getAuthenticatedUser,
  unauthorizedResponse,
  userIsAdmin,
} from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();
  if (!userIsAdmin(user)) return forbiddenResponse();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSizeParam =
    searchParams.get("pageSize") ?? searchParams.get("limit") ?? "50";
  const limit = Math.min(100, Math.max(1, parseInt(pageSizeParam, 10)));
  const adminUpn = searchParams.get("adminUpn") ?? searchParams.get("admin");
  const action = searchParams.get("action");
  const userId = searchParams.get("userId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  try {
    const where: Record<string, unknown> = {};
    if (adminUpn) where.adminUpn = adminUpn;
    if (action) where.action = action;
    if (userId) where.targetUserId = userId;
    if (from || to) {
      const timestamp: Record<string, Date> = {};
      if (from) {
        timestamp.gte = new Date(`${from}T00:00:00.000Z`);
      }
      if (to) {
        timestamp.lte = new Date(`${to}T23:59:59.999Z`);
      }
      where.timestamp = timestamp;
    }

    const [entries, total] = await Promise.all([
      db.auditEntry.findMany({
        where,
        include: {
          targetUser: {
            select: {
              id: true,
              displayName: true,
              userPrincipalName: true,
            },
          },
        },
        orderBy: { timestamp: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.auditEntry.count({ where }),
    ]);

    return NextResponse.json({
      entries: entries.map((entry) => ({
        id: entry.id,
        timestamp: entry.timestamp.toISOString(),
        adminEmail: entry.adminUpn,
        action: entry.action,
        targetUser:
          entry.targetUser?.displayName ??
          entry.targetUserName ??
          null,
        detail: entry.detail,
      })),
      total,
      page,
      pageSize: limit,
    });
  } catch (error) {
    console.error("Failed to fetch audit entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit entries" },
      { status: 500 }
    );
  }
}
