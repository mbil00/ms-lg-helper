"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  createColumnHelper,
  flexRender,
} from "@tanstack/react-table";
import {
  ArrowLeft,
  Trash2,
  Zap,
  Pencil,
  Check,
  X,
  Loader2,
  UserMinus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ListDetail {
  id: string;
  name: string;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
  members: {
    id: string;
    userId: string;
    user?: {
      id: string;
      displayName: string;
      mail: string | null;
      userPrincipalName: string;
    };
    displayName?: string;
    mail?: string;
    userPrincipalName?: string;
  }[];
}

interface ListMember {
  id: string;
  userId: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
}

const columnHelper = createColumnHelper<ListMember>();

export default function ListDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const listId = params.id as string;

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const {
    data: list,
    isLoading,
    error,
    refetch,
  } = useQuery<ListDetail>({
    queryKey: ["list", listId],
    queryFn: async () => {
      const res = await fetch(`/api/lists/${listId}`);
      if (!res.ok) throw new Error("Failed to fetch list");
      return res.json();
    },
  });

  const members: ListMember[] = useMemo(() => {
    if (!list?.members) return [];
    return list.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      displayName: m.user?.displayName ?? m.displayName ?? "",
      mail: m.user?.mail ?? m.mail ?? null,
      userPrincipalName:
        m.user?.userPrincipalName ?? m.userPrincipalName ?? "",
    }));
  }, [list]);

  const updateDescriptionMutation = useMutation({
    mutationFn: async (description: string) => {
      const res = await fetch(`/api/lists/${listId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (!res.ok) throw new Error("Failed to update description");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Description updated");
      queryClient.invalidateQueries({ queryKey: ["list", listId] });
      setEditingDescription(false);
    },
    onError: (err) => {
      toast.error(`Failed to update: ${err.message}`);
    },
  });

  const removeMembersMutation = useMutation({
    mutationFn: async (memberIds: string[]) => {
      const res = await fetch(`/api/lists/${listId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds }),
      });
      if (!res.ok) throw new Error("Failed to remove members");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Members removed");
      queryClient.invalidateQueries({ queryKey: ["list", listId] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      setRowSelection({});
    },
    onError: (err) => {
      toast.error(`Failed to remove members: ${err.message}`);
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/lists/${listId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete list");
      return res.json();
    },
    onSuccess: () => {
      toast.success("List deleted");
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      router.push("/lists");
    },
    onError: (err) => {
      toast.error(`Failed to delete list: ${err.message}`);
    },
  });

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllRowsSelected()}
            onCheckedChange={(value) =>
              table.toggleAllRowsSelected(!!value)
            }
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
          />
        ),
        size: 40,
      }),
      columnHelper.accessor("displayName", {
        header: "Display Name",
        cell: (info) => (
          <span className="font-medium">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("mail", {
        header: "Email",
        cell: (info) => info.getValue() ?? "-",
      }),
      columnHelper.accessor("userPrincipalName", {
        header: "UPN",
        cell: (info) => (
          <span className="text-muted-foreground">{info.getValue()}</span>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: members,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.id,
  });

  const selectedMemberIds = Object.keys(rowSelection).filter(
    (k) => rowSelection[k]
  );

  const handleRemoveSelected = () => {
    if (selectedMemberIds.length === 0) return;
    removeMembersMutation.mutate(selectedMemberIds);
  };

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-destructive">
            Failed to load list: {(error as Error).message}
          </p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
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
        <Skeleton className="h-4 w-72" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">List not found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.push("/lists")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-semibold">{list.name}</h1>
        <Badge variant="secondary">{members.length} members</Badge>
      </div>

      <div className="flex items-start gap-2">
        {editingDescription ? (
          <div className="flex flex-1 items-start gap-2">
            <Textarea
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              className="max-w-md"
              placeholder="Enter description..."
            />
            <Button
              size="icon-sm"
              onClick={() =>
                updateDescriptionMutation.mutate(descriptionDraft)
              }
              disabled={updateDescriptionMutation.isPending}
            >
              {updateDescriptionMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditingDescription(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {list.description || "No description"}
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setDescriptionDraft(list.description ?? "");
                setEditingDescription(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {selectedMemberIds.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleRemoveSelected}
            disabled={removeMembersMutation.isPending}
          >
            {removeMembersMutation.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <UserMinus className="mr-1.5 h-4 w-4" />
            )}
            Remove selected ({selectedMemberIds.length})
          </Button>
        )}

        <div className="flex-1" />

        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/actions?listId=${listId}`)}
        >
          <Zap className="mr-1.5 h-4 w-4" />
          Run Action
        </Button>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogTrigger
            render={
              <Button variant="destructive" size="sm" />
            }
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete list
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete list</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{list.name}&quot;? This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => deleteListMutation.mutate()}
                disabled={deleteListMutation.isPending}
              >
                {deleteListMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-1.5 h-4 w-4" />
                )}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                No members in this list.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
