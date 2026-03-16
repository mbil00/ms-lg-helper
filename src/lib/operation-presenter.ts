import type { OperationParams, OperationType } from "@/lib/types";

type OperationListRecord = {
  id: string;
  type: string;
  status: string;
  listId: string;
  params: string;
  totalCount: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  createdBy: string;
  createdAt: Date;
  list?: { id: string; name: string } | null;
};

type OperationDetailRecord = OperationListRecord & {
  items: {
    id: string;
    userId: string;
    status: string;
    detail: string | null;
    user?: {
      displayName: string;
      userPrincipalName?: string;
    } | null;
  }[];
};

function parseParams(params: string): OperationParams {
  try {
    const parsed = JSON.parse(params);
    if (parsed && typeof parsed === "object") {
      return parsed as OperationParams;
    }
  } catch {
    // Ignore malformed historic rows and fall back to an empty object.
  }

  return {};
}

export function presentOperationSummary(operation: OperationListRecord) {
  return {
    id: operation.id,
    type: operation.type as OperationType,
    status: operation.status,
    listId: operation.listId,
    listName: operation.list?.name ?? null,
    params: parseParams(operation.params),
    total: operation.totalCount,
    success: operation.successCount,
    skipped: operation.skippedCount,
    failed: operation.failedCount,
    createdAt: operation.createdAt.toISOString(),
    adminEmail: operation.createdBy,
  };
}

export function presentOperationDetail(operation: OperationDetailRecord) {
  return {
    ...presentOperationSummary(operation),
    items: operation.items.map((item) => ({
      id: item.id,
      userId: item.userId,
      displayName: item.user?.displayName ?? item.userId,
      status: item.status,
      detail: item.detail,
    })),
  };
}
