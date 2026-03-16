import { NextRequest, NextResponse } from "next/server";
import { getGraphClient, getAllPages, withRetry } from "@/lib/graph";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";
import type { GraphGroup, GraphUser } from "@/lib/types";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");

  try {
    const client = getGraphClient();

    if (groupId) {
      // Fetch members of a specific group
      const members = await withRetry(() =>
        getAllPages<GraphUser>(client, `/groups/${groupId}/members`, [
          "id",
          "displayName",
          "mail",
          "userPrincipalName",
        ])
      );

      return NextResponse.json(members);
    }

    // Fetch all groups
    const groups = await withRetry(() =>
      getAllPages<GraphGroup>(client, "/groups", [
        "id",
        "displayName",
        "description",
        "groupTypes",
        "mailEnabled",
        "securityEnabled",
        "membershipRule",
      ])
    );

    return NextResponse.json(groups);
  } catch (error) {
    console.error("Failed to fetch groups from Graph:", error);
    return NextResponse.json(
      { error: "Failed to fetch groups" },
      { status: 500 }
    );
  }
}
