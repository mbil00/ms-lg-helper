import { NextRequest, NextResponse } from "next/server";
import { getGraphClient, getAllPages, withRetry } from "@/lib/graph";
import { withGroupManagementMetadata } from "@/lib/group-management";
import {
  forbiddenResponse,
  getAuthenticatedUser,
  unauthorizedResponse,
  userIsAdmin,
} from "@/lib/auth-guard";
import type { GraphGroup, GraphUser } from "@/lib/types";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();
  if (!userIsAdmin(user)) return forbiddenResponse();

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");
  const actionableOnly = searchParams.get("actionable") === "true";

  try {
    const client = getGraphClient();

    if (groupId) {
      // Fetch direct group members and keep only users for user-centric flows.
      const members = await withRetry(() =>
        getAllPages<
          Partial<GraphUser> & {
            "@odata.type"?: string | null;
            id: string;
            displayName?: string | null;
            mail?: string | null;
            userPrincipalName?: string | null;
            jobTitle?: string | null;
          }
        >(client, `/groups/${groupId}/members`, [
          "id",
          "displayName",
          "mail",
          "userPrincipalName",
          "jobTitle",
        ])
      );

      const userMembers: GraphUser[] = members
        .filter(
          (member) =>
            member["@odata.type"] === "#microsoft.graph.user" ||
            !!member.userPrincipalName
        )
        .map((member) => ({
          id: member.id,
          displayName: member.displayName ?? "",
          mail: member.mail ?? null,
          userPrincipalName: member.userPrincipalName ?? "",
          jobTitle: member.jobTitle ?? null,
          accountEnabled: true,
          department: null,
        }));

      return NextResponse.json(userMembers);
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
        "isAssignableToRole",
      ])
    );

    const groupsWithMetadata = groups.map(withGroupManagementMetadata);
    const responseGroups = actionableOnly
      ? groupsWithMetadata.filter((group) => group.canManageMembership)
      : groupsWithMetadata;

    return NextResponse.json(responseGroups);
  } catch (error) {
    console.error("Failed to fetch groups from Graph:", error);
    return NextResponse.json(
      { error: "Failed to fetch groups" },
      { status: 500 }
    );
  }
}
