"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  MinusCircle,
  RefreshCw,
} from "lucide-react";
import type { OperationType, OperationParams, OperationProgress } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface OperationDetail {
  id: string;
  type: OperationType;
  status: string;
  listId: string;
  listName?: string;
  params: OperationParams;
  total: number;
  success: number;
  skipped: number;
  failed: number;
  createdAt: string;
  adminEmail: string | null;
  items: OperationItem[];
}

interface OperationItem {
  id: string;
  userId: string;
  displayName: string;
  status: string;
  detail: string | null;
}

const actionTypeLabels: Record<OperationType, string> = {
  assign_license: "Assign License",
  remove_license: "Remove License",
  add_to_group: "Add to Group",
  remove_from_group: "Remove from Group",
};

function getStatusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "completed":
    case "success":
      return "default";
    case "running":
    case "pending":
      return "secondary";
    case "failed":
      return "destructive";
    case "skipped":
    case "partial":
      return "outline";
    default:
      return "outline";
  }
}

function getItemStatusIcon(status: string) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "skipped":
      return <MinusCircle className="h-4 w-4 text-yellow-600" />;
    default:
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }
}

export default function ActionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const operationId = params.id as string;
  const eventSourceRef = useRef<EventSource | null>(null);
  const [liveProgress, setLiveProgress] = useState<OperationProgress | null>(
    null
  );

  const {
    data: operation,
    isLoading,
    error,
    refetch,
  } = useQuery<OperationDetail>({
    queryKey: ["operation", operationId],
    queryFn: async () => {
      const res = await fetch(`/api/actions/${operationId}`);
      if (!res.ok) throw new Error("Failed to fetch operation");
      return res.json();
    },
  });

  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/actions/${operationId}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const progress: OperationProgress = JSON.parse(event.data);
        setLiveProgress(progress);

        if (
          progress.status === "completed" ||
          progress.status === "failed" ||
          progress.status === "partial"
        ) {
          es.close();
          eventSourceRef.current = null;
          refetch();
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [operationId, refetch]);

  useEffect(() => {
    if (operation?.status === "running") {
      connectSSE();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [operation?.status, connectSSE]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-destructive">
            Failed to load operation: {(error as Error).message}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!operation) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Operation not found.</p>
      </div>
    );
  }

  const currentSuccess = liveProgress?.success ?? operation.success;
  const currentSkipped = liveProgress?.skipped ?? operation.skipped;
  const currentFailed = liveProgress?.failed ?? operation.failed;
  const currentTotal = liveProgress?.total ?? operation.total;
  const currentStatus = liveProgress?.status ?? operation.status;
  const completed = currentSuccess + currentSkipped + currentFailed;
  const progressPct = currentTotal > 0 ? (completed / currentTotal) * 100 : 0;

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.push("/actions")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-semibold">
          {actionTypeLabels[operation.type] ?? operation.type}
        </h1>
        <Badge variant={getStatusBadgeVariant(currentStatus)}>
          {currentStatus}
        </Badge>
        {currentStatus === "running" && liveProgress?.currentUser && (
          <span className="text-sm text-muted-foreground">
            Processing: {liveProgress.currentUser}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-xs text-muted-foreground">
              List
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">
              {operation.listName ?? operation.listId}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-xs text-muted-foreground">
              Parameters
            </CardTitle>
          </CardHeader>
          <CardContent>
            {operation.params.skuNames?.join(", ") ||
              operation.params.groupNames?.join(", ") ||
              operation.params.skuIds?.join(", ") ||
              operation.params.groupIds?.join(", ") ||
              "-"}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-xs text-muted-foreground">
              Admin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{operation.adminEmail ?? "-"}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-xs text-muted-foreground">
              Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {new Date(operation.createdAt).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>
              {completed}/{currentTotal} completed
              {currentSkipped > 0 && (
                <span className="text-yellow-600">
                  {" "}| {currentSkipped} skipped
                </span>
              )}
              {currentFailed > 0 && (
                <span className="text-destructive">
                  {" "}| {currentFailed} failed
                </span>
              )}
            </span>
            <span className="text-muted-foreground">
              {Math.round(progressPct)}%
            </span>
          </div>
          <Progress value={progressPct} />
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>User</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Detail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {operation.items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="h-24 text-center text-muted-foreground"
              >
                No items to display.
              </TableCell>
            </TableRow>
          ) : (
            operation.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{getItemStatusIcon(item.status)}</TableCell>
                <TableCell className="font-medium">
                  {item.displayName}
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(item.status)}>
                    {item.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.detail ?? "-"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
