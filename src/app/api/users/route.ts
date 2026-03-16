import { NextRequest, NextResponse } from "next/server";
import { getGraphClient, getAllPages, withRetry } from "@/lib/graph";
import { db } from "@/lib/db";
import {
  forbiddenResponse,
  getAuthenticatedUser,
  unauthorizedResponse,
  userIsAdmin,
} from "@/lib/auth-guard";
import type { GraphUser } from "@/lib/types";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();
  if (!userIsAdmin(user)) return forbiddenResponse();

  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "true";

  if (!forceRefresh) {
    // Check if cache is fresh
    const latestCached = await db.cachedUser.findFirst({
      orderBy: { cachedAt: "desc" },
    });

    if (latestCached && Date.now() - latestCached.cachedAt.getTime() < CACHE_TTL_MS) {
      const cachedUsers = await db.cachedUser.findMany({
        orderBy: { displayName: "asc" },
      });
      return NextResponse.json(cachedUsers);
    }
  }

  try {
    const client = getGraphClient();
    const graphUsers = await withRetry(() =>
      getAllPages<GraphUser>(client, "/users", [
        "id",
        "displayName",
        "mail",
        "userPrincipalName",
        "accountEnabled",
        "jobTitle",
        "department",
        "assignedLicenses",
      ])
    );

    // Upsert all users into cache
    const now = new Date();
    await db.$transaction(
      graphUsers.map((u) =>
        db.cachedUser.upsert({
          where: { id: u.id },
          create: {
            id: u.id,
            displayName: u.displayName,
            mail: u.mail,
            userPrincipalName: u.userPrincipalName,
            accountEnabled: u.accountEnabled,
            jobTitle: u.jobTitle,
            department: u.department,
            cachedAt: now,
          },
          update: {
            displayName: u.displayName,
            mail: u.mail,
            userPrincipalName: u.userPrincipalName,
            accountEnabled: u.accountEnabled,
            jobTitle: u.jobTitle,
            department: u.department,
            cachedAt: now,
          },
        })
      )
    );

    return NextResponse.json(graphUsers);
  } catch (error) {
    console.error("Failed to fetch users from Graph:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
