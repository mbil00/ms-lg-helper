import { NextRequest, NextResponse } from "next/server";
import { getGraphClient, withRetry } from "@/lib/graph";
import { db } from "@/lib/db";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";
import type {
  OperationType,
  OperationParams,
  DryRunResult,
  GraphUser,
} from "@/lib/types";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    const operations = await db.operation.findMany({
      include: {
        list: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(operations);
  } catch (error) {
    console.error("Failed to fetch operations:", error);
    return NextResponse.json(
      { error: "Failed to fetch operations" },
      { status: 500 }
    );
  }
}

async function checkUserHasLicense(
  client: ReturnType<typeof getGraphClient>,
  userId: string,
  skuId: string
): Promise<boolean> {
  try {
    const graphUser = await withRetry(() =>
      client
        .api(`/users/${userId}`)
        .select(["assignedLicenses"])
        .get()
    );
    const licenses: { skuId: string }[] = graphUser.assignedLicenses || [];
    return licenses.some(
      (l) => l.skuId.toLowerCase() === skuId.toLowerCase()
    );
  } catch {
    return false;
  }
}

async function checkUserInGroup(
  client: ReturnType<typeof getGraphClient>,
  groupId: string,
  userId: string
): Promise<boolean> {
  try {
    await withRetry(() =>
      client.api(`/groups/${groupId}/members/${userId}`).get()
    );
    return true;
  } catch {
    return false;
  }
}

async function executeLicenseAssign(
  client: ReturnType<typeof getGraphClient>,
  userId: string,
  skuId: string
): Promise<void> {
  await withRetry(() =>
    client.api(`/users/${userId}/assignLicense`).post({
      addLicenses: [{ skuId, disabledPlans: [] }],
      removeLicenses: [],
    })
  );
}

async function executeLicenseRemove(
  client: ReturnType<typeof getGraphClient>,
  userId: string,
  skuId: string
): Promise<void> {
  await withRetry(() =>
    client.api(`/users/${userId}/assignLicense`).post({
      addLicenses: [],
      removeLicenses: [skuId],
    })
  );
}

async function executeGroupAdd(
  client: ReturnType<typeof getGraphClient>,
  groupId: string,
  userId: string
): Promise<void> {
  await withRetry(() =>
    client.api(`/groups/${groupId}/members/$ref`).post({
      "@odata.id": `https://graph.microsoft.com/v1.0/directoryObjects/${userId}`,
    })
  );
}

async function executeGroupRemove(
  client: ReturnType<typeof getGraphClient>,
  groupId: string,
  userId: string
): Promise<void> {
  await withRetry(() =>
    client.api(`/groups/${groupId}/members/${userId}/$ref`).delete()
  );
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json();
    const {
      listId,
      type,
      params,
      dryRun = false,
    } = body as {
      listId: string;
      type: OperationType;
      params: OperationParams;
      dryRun?: boolean;
    };

    if (!listId || !type || !params) {
      return NextResponse.json(
        { error: "listId, type, and params are required" },
        { status: 400 }
      );
    }

    // Fetch list with members
    const list = await db.userList.findUnique({
      where: { id: listId },
      include: {
        members: {
          include: { user: true },
        },
      },
    });

    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    const client = getGraphClient();
    const members = list.members;

    // Determine target IDs based on operation type
    const targetIds =
      type === "assign_license" || type === "remove_license"
        ? params.skuIds || []
        : params.groupIds || [];

    if (targetIds.length === 0) {
      return NextResponse.json(
        { error: "No target IDs provided in params" },
        { status: 400 }
      );
    }

    // --- DRY RUN ---
    if (dryRun) {
      const result: DryRunResult = {
        willProcess: [],
        willSkip: [],
        errors: [],
      };

      for (const member of members) {
        const userId = member.userId;
        const displayName = member.user.displayName;

        try {
          for (const targetId of targetIds) {
            let alreadyInDesiredState = false;

            if (type === "assign_license") {
              alreadyInDesiredState = await checkUserHasLicense(
                client,
                userId,
                targetId
              );
            } else if (type === "remove_license") {
              alreadyInDesiredState = !(await checkUserHasLicense(
                client,
                userId,
                targetId
              ));
            } else if (type === "add_to_group") {
              alreadyInDesiredState = await checkUserInGroup(
                client,
                targetId,
                userId
              );
            } else if (type === "remove_from_group") {
              alreadyInDesiredState = !(await checkUserInGroup(
                client,
                targetId,
                userId
              ));
            }

            if (alreadyInDesiredState) {
              result.willSkip.push({
                userId,
                displayName,
                reason: `Already in desired state for ${targetId}`,
              });
            } else {
              result.willProcess.push({ userId, displayName });
            }
          }
        } catch (error) {
          result.errors.push({
            userId,
            displayName,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return NextResponse.json(result);
    }

    // --- EXECUTE OPERATION ---
    const operation = await db.operation.create({
      data: {
        type,
        status: "running",
        listId,
        params: JSON.stringify(params),
        totalCount: members.length * targetIds.length,
        createdBy: user.upn!,
        startedAt: new Date(),
      },
    });

    // Create operation items for each user-target combination
    const itemsData = members.flatMap((member: { userId: string }) =>
      targetIds.map((targetId) => ({
        operationId: operation.id,
        userId: member.userId,
        status: "pending",
        detail: targetId, // store the target ID for reference
      }))
    );

    await db.operationItem.createMany({ data: itemsData });

    // Fetch created items with user details
    const items = await db.operationItem.findMany({
      where: { operationId: operation.id },
      include: { user: true },
    });

    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const item of items) {
      const userId = item.userId;
      const targetId = item.detail!; // We stored target ID in detail

      try {
        let alreadyInDesiredState = false;

        if (type === "assign_license") {
          alreadyInDesiredState = await checkUserHasLicense(
            client,
            userId,
            targetId
          );
        } else if (type === "remove_license") {
          alreadyInDesiredState = !(await checkUserHasLicense(
            client,
            userId,
            targetId
          ));
        } else if (type === "add_to_group") {
          alreadyInDesiredState = await checkUserInGroup(
            client,
            targetId,
            userId
          );
        } else if (type === "remove_from_group") {
          alreadyInDesiredState = !(await checkUserInGroup(
            client,
            targetId,
            userId
          ));
        }

        if (alreadyInDesiredState) {
          await db.operationItem.update({
            where: { id: item.id },
            data: { status: "skipped", detail: "Already in desired state" },
          });
          skippedCount++;
        } else {
          // Execute the Graph API call
          if (type === "assign_license") {
            await executeLicenseAssign(client, userId, targetId);
          } else if (type === "remove_license") {
            await executeLicenseRemove(client, userId, targetId);
          } else if (type === "add_to_group") {
            await executeGroupAdd(client, targetId, userId);
          } else if (type === "remove_from_group") {
            await executeGroupRemove(client, targetId, userId);
          }

          await db.operationItem.update({
            where: { id: item.id },
            data: { status: "success", detail: null },
          });
          successCount++;
        }

        // Create audit entry for this user
        await db.auditEntry.create({
          data: {
            adminUpn: user.upn!,
            action: type,
            operationId: operation.id,
            targetUserId: userId,
            targetUserName: item.user.displayName,
            detail: `${type} ${targetId} - ${alreadyInDesiredState ? "skipped" : "success"}`,
          },
        });

        // Update operation progress
        await db.operation.update({
          where: { id: operation.id },
          data: { successCount, skippedCount, failedCount },
        });
      } catch (error) {
        failedCount++;
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        await db.operationItem.update({
          where: { id: item.id },
          data: { status: "failed", detail: errorMessage },
        });

        // Create audit entry for failed operation
        await db.auditEntry.create({
          data: {
            adminUpn: user.upn!,
            action: type,
            operationId: operation.id,
            targetUserId: userId,
            targetUserName: item.user.displayName,
            detail: `${type} ${targetId} - failed: ${errorMessage}`,
          },
        });

        // Update operation progress
        await db.operation.update({
          where: { id: operation.id },
          data: { successCount, skippedCount, failedCount },
        });
      }
    }

    // Determine final status
    let finalStatus: string;
    if (failedCount === 0) {
      finalStatus = "completed";
    } else if (successCount > 0 || skippedCount > 0) {
      finalStatus = "partial";
    } else {
      finalStatus = "failed";
    }

    const completedOperation = await db.operation.update({
      where: { id: operation.id },
      data: {
        status: finalStatus,
        successCount,
        skippedCount,
        failedCount,
        completedAt: new Date(),
      },
      include: {
        items: {
          include: { user: true },
        },
        list: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(completedOperation);
  } catch (error) {
    console.error("Failed to execute operation:", error);
    return NextResponse.json(
      { error: "Failed to execute operation" },
      { status: 500 }
    );
  }
}
