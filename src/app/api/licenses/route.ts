import { NextRequest, NextResponse } from "next/server";
import { getGraphClient, getAllPages, withRetry } from "@/lib/graph";
import {
  forbiddenResponse,
  getAuthenticatedUser,
  unauthorizedResponse,
  userIsAdmin,
} from "@/lib/auth-guard";
import type { GraphLicense, GraphUser, GraphGroup, LicenseAssignee } from "@/lib/types";

const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();
  if (!userIsAdmin(user)) return forbiddenResponse();

  const { searchParams } = new URL(request.url);
  const skuId = searchParams.get("skuId");

  try {
    const client = getGraphClient();

    if (skuId) {
      if (!GUID_PATTERN.test(skuId)) {
        return NextResponse.json({ error: "Invalid skuId" }, { status: 400 });
      }

      // Fetch users and groups assigned to this specific license
      const [users, groups] = await Promise.all([
        withRetry(() =>
          getAllPages<GraphUser>(
            client,
            `/users?$filter=assignedLicenses/any(l:l/skuId eq ${skuId})`,
            ["id", "displayName", "mail", "userPrincipalName"]
          )
        ),
        withRetry(() =>
          getAllPages<GraphGroup>(
            client,
            `/groups?$filter=assignedLicenses/any(l:l/skuId eq ${skuId})`,
            ["id", "displayName", "description"]
          )
        ),
      ]);

      const assignees: LicenseAssignee[] = [
        ...users.map((u) => ({
          type: "user" as const,
          id: u.id,
          displayName: u.displayName,
          userPrincipalName: u.userPrincipalName,
        })),
        ...groups.map((g) => ({
          type: "group" as const,
          id: g.id,
          displayName: g.displayName,
        })),
      ];

      return NextResponse.json(assignees);
    }

    // Fetch all subscribed SKUs
    const response = await withRetry(() => client.api("/subscribedSkus").get());
    const licenses: GraphLicense[] = response.value;

    return NextResponse.json(licenses);
  } catch (error) {
    console.error("Failed to fetch licenses from Graph:", error);
    return NextResponse.json(
      { error: "Failed to fetch licenses" },
      { status: 500 }
    );
  }
}
