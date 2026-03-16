import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getGraphClient, withRetry } from "@/lib/graph";
import {
  forbiddenResponse,
  getAuthenticatedUser,
  unauthorizedResponse,
  userIsAdmin,
} from "@/lib/auth-guard";
import type { GraphUser } from "@/lib/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();
  if (!userIsAdmin(user)) return forbiddenResponse();

  const { id: listId } = await params;

  try {
    const body = await request.json();
    const { userIds, users } = body as {
      userIds: string[];
      users?: {
        id: string;
        displayName: string;
        mail?: string | null;
        userPrincipalName: string;
        accountEnabled?: boolean;
        jobTitle?: string | null;
        department?: string | null;
      }[];
    };

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: "userIds array is required" },
        { status: 400 }
      );
    }

    // Verify the list exists
    const list = await db.userList.findUnique({ where: { id: listId } });
    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    const usersToCache = new Map<
      string,
      {
        id: string;
        displayName: string;
        mail?: string | null;
        userPrincipalName: string;
        accountEnabled?: boolean;
        jobTitle?: string | null;
        department?: string | null;
      }
    >();

    if (users && Array.isArray(users)) {
      for (const graphUser of users) {
        usersToCache.set(graphUser.id, graphUser);
      }
    }

    const cachedUsers = await db.cachedUser.findMany({
      where: {
        id: { in: userIds },
      },
      select: { id: true },
    });

    const cachedUserIds = new Set(cachedUsers.map((cachedUser) => cachedUser.id));
    const missingUserIds = userIds.filter(
      (userId) => !cachedUserIds.has(userId) && !usersToCache.has(userId)
    );

    if (missingUserIds.length > 0) {
      const client = getGraphClient();
      const fetchedUsers = await Promise.all(
        missingUserIds.map(async (userId) => {
          const graphUser = await withRetry(() =>
            client
              .api(`/users/${userId}`)
              .select([
                "id",
                "displayName",
                "mail",
                "userPrincipalName",
                "accountEnabled",
                "jobTitle",
                "department",
              ])
              .get()
          );

          return graphUser as GraphUser;
        })
      );

      for (const graphUser of fetchedUsers) {
        usersToCache.set(graphUser.id, graphUser);
      }
    }

    // Upsert user data into CachedUser before inserting memberships.
    if (usersToCache.size > 0) {
      await db.$transaction(
        Array.from(usersToCache.values()).map((u) =>
          db.cachedUser.upsert({
            where: { id: u.id },
            create: {
              id: u.id,
              displayName: u.displayName,
              mail: u.mail ?? null,
              userPrincipalName: u.userPrincipalName,
              accountEnabled: u.accountEnabled ?? true,
              jobTitle: u.jobTitle ?? null,
              department: u.department ?? null,
            },
            update: {
              displayName: u.displayName,
              mail: u.mail ?? null,
              userPrincipalName: u.userPrincipalName,
              accountEnabled: u.accountEnabled ?? true,
              jobTitle: u.jobTitle ?? null,
              department: u.department ?? null,
            },
          })
        )
      );
    }

    // Upsert list members to avoid duplicates
    await db.$transaction(
      userIds.map((userId) =>
        db.listMember.upsert({
          where: {
            listId_userId: { listId, userId },
          },
          create: { listId, userId },
          update: {},
        })
      )
    );

    // Return updated member list
    const members = await db.listMember.findMany({
      where: { listId },
      include: { user: true },
      orderBy: { addedAt: "desc" },
    });

    return NextResponse.json(members, { status: 201 });
  } catch (error) {
    console.error("Failed to add members:", error);
    return NextResponse.json(
      { error: "Failed to add members" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();
  if (!userIsAdmin(user)) return forbiddenResponse();

  const { id: listId } = await params;

  try {
    const body = await request.json();
    const { userIds } = body as { userIds: string[] };

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: "userIds array is required" },
        { status: 400 }
      );
    }

    await db.listMember.deleteMany({
      where: {
        listId,
        userId: { in: userIds },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove members:", error);
    return NextResponse.json(
      { error: "Failed to remove members" },
      { status: 500 }
    );
  }
}
