import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
  const adminUpn = searchParams.get("adminUpn");
  const action = searchParams.get("action");
  const userId = searchParams.get("userId");

  try {
    const where: Record<string, unknown> = {};
    if (adminUpn) where.adminUpn = adminUpn;
    if (action) where.action = action;
    if (userId) where.targetUserId = userId;

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

    return NextResponse.json({ entries, total });
  } catch (error) {
    console.error("Failed to fetch audit entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit entries" },
      { status: 500 }
    );
  }
}
