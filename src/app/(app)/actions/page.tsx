"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Zap,
  Play,
  Eye,
  Loader2,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import type {
  OperationType,
  OperationParams,
  DryRunResult,
  GraphLicense,
  GraphGroup,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface UserList {
  id: string;
  name: string;
  _count?: { members: number };
}

interface Operation {
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
}

const actionTypes: { value: OperationType; label: string }[] = [
  { value: "assign_license", label: "Assign License" },
  { value: "remove_license", label: "Remove License" },
  { value: "add_to_group", label: "Add to Group" },
  { value: "remove_from_group", label: "Remove from Group" },
];

function getStatusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "completed":
      return "default";
    case "running":
      return "secondary";
    case "failed":
      return "destructive";
    case "partial":
      return "outline";
    default:
      return "outline";
  }
}

export default function ActionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const preselectedListId = searchParams.get("listId") ?? "";

  const [selectedListId, setSelectedListId] = useState(preselectedListId);
  const [actionType, setActionType] = useState<OperationType | "">("");
  const [selectedSkuIds, setSelectedSkuIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [dryRunDialogOpen, setDryRunDialogOpen] = useState(false);

  const { data: lists = [], isLoading: listsLoading } = useQuery<UserList[]>({
    queryKey: ["lists"],
    queryFn: async () => {
      const res = await fetch("/api/lists");
      if (!res.ok) throw new Error("Failed to fetch lists");
      return res.json();
    },
  });

  const { data: licenses = [] } = useQuery<GraphLicense[]>({
    queryKey: ["licenses"],
    queryFn: async () => {
      const res = await fetch("/api/licenses");
      if (!res.ok) throw new Error("Failed to fetch licenses");
      return res.json();
    },
    enabled: actionType === "assign_license" || actionType === "remove_license",
  });

  const { data: groups = [] } = useQuery<GraphGroup[]>({
    queryKey: ["groups"],
    queryFn: async () => {
      const res = await fetch("/api/groups");
      if (!res.ok) throw new Error("Failed to fetch groups");
      return res.json();
    },
    enabled: actionType === "add_to_group" || actionType === "remove_from_group",
  });

  const {
    data: operations = [],
    isLoading: opsLoading,
  } = useQuery<Operation[]>({
    queryKey: ["operations"],
    queryFn: async () => {
      const res = await fetch("/api/actions");
      if (!res.ok) throw new Error("Failed to fetch operations");
      return res.json();
    },
  });

  const buildParams = (): OperationParams => {
    const params: OperationParams = {};
    if (
      actionType === "assign_license" ||
      actionType === "remove_license"
    ) {
      params.skuIds = selectedSkuIds;
    }
    if (
      actionType === "add_to_group" ||
      actionType === "remove_from_group"
    ) {
      params.groupIds = selectedGroupIds;
    }
    return params;
  };

  const dryRunMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listId: selectedListId,
          type: actionType,
          params: buildParams(),
          dryRun: true,
        }),
      });
      if (!res.ok) throw new Error("Dry run failed");
      return res.json() as Promise<DryRunResult>;
    },
    onSuccess: (result) => {
      setDryRunResult(result);
      setDryRunDialogOpen(true);
    },
    onError: (err) => {
      toast.error(`Dry run failed: ${err.message}`);
    },
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listId: selectedListId,
          type: actionType,
          params: buildParams(),
          dryRun: false,
        }),
      });
      if (!res.ok) throw new Error("Execution failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success("Action started");
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      if (data.operationId) {
        router.push(`/actions/${data.operationId}`);
      }
    },
    onError: (err) => {
      toast.error(`Action failed: ${err.message}`);
    },
  });

  const isLicenseAction =
    actionType === "assign_license" || actionType === "remove_license";
  const isGroupAction =
    actionType === "add_to_group" || actionType === "remove_from_group";

  const canSubmit =
    selectedListId &&
    actionType &&
    ((isLicenseAction && selectedSkuIds.length > 0) ||
      (isGroupAction && selectedGroupIds.length > 0));

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Actions</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            New Action
          </CardTitle>
          <CardDescription>
            Select a list, choose an action type, and configure parameters.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Target List</Label>
              <Select
                value={selectedListId}
                onValueChange={(val) => setSelectedListId(val ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a list" />
                </SelectTrigger>
                <SelectContent>
                  {lists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                      {list._count && ` (${list._count.members})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Action Type</Label>
              <Select
                value={actionType}
                onValueChange={(val) => {
                  setActionType((val ?? "") as OperationType | "");
                  setSelectedSkuIds([]);
                  setSelectedGroupIds([]);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  {actionTypes.map((at) => (
                    <SelectItem key={at.value} value={at.value}>
                      {at.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              {isLicenseAction && (
                <>
                  <Label>License</Label>
                  <Select
                    value={selectedSkuIds[0] ?? ""}
                    onValueChange={(val) => setSelectedSkuIds(val ? [val] : [])}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select license" />
                    </SelectTrigger>
                    <SelectContent>
                      {licenses.map((lic) => (
                        <SelectItem key={lic.skuId} value={lic.skuId}>
                          {lic.skuPartNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
              {isGroupAction && (
                <>
                  <Label>Group</Label>
                  <Select
                    value={selectedGroupIds[0] ?? ""}
                    onValueChange={(val) => setSelectedGroupIds(val ? [val] : [])}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select group" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
              {!isLicenseAction && !isGroupAction && (
                <>
                  <Label>Parameters</Label>
                  <p className="pt-1.5 text-sm text-muted-foreground">
                    Select an action type first
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => dryRunMutation.mutate()}
              disabled={!canSubmit || dryRunMutation.isPending}
            >
              {dryRunMutation.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Eye className="mr-1.5 h-4 w-4" />
              )}
              Dry Run
            </Button>
            <Button
              onClick={() => executeMutation.mutate()}
              disabled={!canSubmit || executeMutation.isPending}
            >
              {executeMutation.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-1.5 h-4 w-4" />
              )}
              Execute
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Operation History</h2>

        {opsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : operations.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No operations have been run yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>List</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {operations.map((op) => {
                const completed = op.success + op.skipped + op.failed;
                const progress =
                  op.total > 0 ? (completed / op.total) * 100 : 0;

                return (
                  <TableRow key={op.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {actionTypes.find((a) => a.value === op.type)?.label ??
                          op.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {op.listName ?? op.listId}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(op.status)}>
                        {op.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="w-24" />
                        <span className="text-xs text-muted-foreground">
                          {op.success}/{op.total}
                          {op.skipped > 0 && ` (${op.skipped} skipped)`}
                          {op.failed > 0 && ` (${op.failed} failed)`}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(op.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {op.adminEmail ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/actions/${op.id}`)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dryRunDialogOpen} onOpenChange={setDryRunDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Dry Run Results</DialogTitle>
            <DialogDescription>
              Review what will happen before executing.
            </DialogDescription>
          </DialogHeader>

          {dryRunResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Card size="sm">
                  <CardContent className="pt-3 text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {dryRunResult.willProcess.length}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Will process
                    </p>
                  </CardContent>
                </Card>
                <Card size="sm">
                  <CardContent className="pt-3 text-center">
                    <p className="text-2xl font-bold text-yellow-600">
                      {dryRunResult.willSkip.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Will skip</p>
                  </CardContent>
                </Card>
                <Card size="sm">
                  <CardContent className="pt-3 text-center">
                    <p className="text-2xl font-bold text-red-600">
                      {dryRunResult.errors.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Errors</p>
                  </CardContent>
                </Card>
              </div>

              {dryRunResult.willSkip.length > 0 && (
                <div>
                  <h4 className="mb-1 text-sm font-medium">
                    Skipped ({dryRunResult.willSkip.length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto rounded border p-2">
                    {dryRunResult.willSkip.map((s) => (
                      <p key={s.userId} className="text-xs text-muted-foreground">
                        {s.displayName}: {s.reason}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {dryRunResult.errors.length > 0 && (
                <div>
                  <h4 className="mb-1 flex items-center gap-1 text-sm font-medium text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Errors ({dryRunResult.errors.length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto rounded border border-destructive/30 p-2">
                    {dryRunResult.errors.map((e) => (
                      <p key={e.userId} className="text-xs text-destructive">
                        {e.displayName}: {e.error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDryRunDialogOpen(false)}
            >
              Close
            </Button>
            <Button
              onClick={() => {
                setDryRunDialogOpen(false);
                executeMutation.mutate();
              }}
              disabled={executeMutation.isPending}
            >
              {executeMutation.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-1.5 h-4 w-4" />
              )}
              Execute Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
