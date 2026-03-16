"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
} from "@tanstack/react-table";
import { Search, ChevronRight, Mail } from "lucide-react";
import type { GraphGroup, GraphUser } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { UserSelectionToolbar } from "@/components/user-selection-toolbar";
import { cn } from "@/lib/utils";

function getGroupType(group: GraphGroup): string {
  if (group.groupTypes.includes("Unified")) return "M365";
  if (group.securityEnabled && !group.mailEnabled) return "Security";
  if (group.mailEnabled && !group.securityEnabled) return "Distribution";
  if (group.securityEnabled && group.mailEnabled) return "Mail-enabled Security";
  return "Other";
}

function getGroupTypeBadgeVariant(
  type: string
): "default" | "secondary" | "outline" {
  switch (type) {
    case "M365":
      return "default";
    case "Security":
      return "secondary";
    case "Distribution":
      return "outline";
    default:
      return "outline";
  }
}

const columnHelper = createColumnHelper<GraphGroup>();

function GroupMembersPanel({
  groupId,
  selectedUserIds,
  onToggleUser,
  onMembersChange,
}: {
  groupId: string;
  selectedUserIds: Record<string, boolean>;
  onToggleUser: (userId: string) => void;
  onMembersChange: (userIds: string[]) => void;
}) {
  const { data: members, isLoading } = useQuery<GraphUser[]>({
    queryKey: ["group-members", groupId],
    queryFn: async () => {
      const res = await fetch(`/api/groups?groupId=${groupId}`);
      if (!res.ok) throw new Error("Failed to fetch group members");
      return res.json();
    },
  });

  useEffect(() => {
    onMembersChange(members?.map((member) => member.id) ?? []);
  }, [members, onMembersChange]);

  if (isLoading) {
    return (
      <div className="space-y-2 px-8 py-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (!members || members.length === 0) {
    return (
      <p className="px-8 py-3 text-sm text-muted-foreground">
        No members found.
      </p>
    );
  }

  return (
    <div className="px-8 py-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>Display Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>UPN</TableHead>
            <TableHead>Job Title</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.id}>
              <TableCell>
                <Checkbox
                  checked={!!selectedUserIds[member.id]}
                  onCheckedChange={() => onToggleUser(member.id)}
                />
              </TableCell>
              <TableCell className="font-medium">
                {member.displayName}
              </TableCell>
              <TableCell>{member.mail ?? "-"}</TableCell>
              <TableCell className="text-muted-foreground">
                {member.userPrincipalName}
              </TableCell>
              <TableCell>{member.jobTitle ?? "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function GroupsPage() {
  const [globalFilter, setGlobalFilter] = useState("");
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Record<string, boolean>>({});
  const [availableUserIds, setAvailableUserIds] = useState<string[]>([]);

  const {
    data: groups = [],
    isLoading,
    error,
    refetch,
  } = useQuery<GraphGroup[]>({
    queryKey: ["groups"],
    queryFn: async () => {
      const res = await fetch("/api/groups");
      if (!res.ok) throw new Error("Failed to fetch groups");
      return res.json();
    },
  });

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "expand",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() =>
              setExpandedGroupId(
                expandedGroupId === row.original.id ? null : row.original.id
              )
            }
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform",
                expandedGroupId === row.original.id && "rotate-90"
              )}
            />
          </Button>
        ),
        size: 40,
      }),
      columnHelper.accessor("displayName", {
        header: "Group Name",
        cell: (info) => (
          <span className="font-medium">{info.getValue()}</span>
        ),
      }),
      columnHelper.display({
        id: "type",
        header: "Type",
        cell: ({ row }) => {
          const type = getGroupType(row.original);
          return (
            <Badge variant={getGroupTypeBadgeVariant(type)}>{type}</Badge>
          );
        },
      }),
      columnHelper.accessor("mailEnabled", {
        header: "Mail",
        cell: (info) =>
          info.getValue() ? (
            <Badge variant="outline">
              <Mail className="mr-1 h-3 w-3" />
              Mail-enabled
            </Badge>
          ) : null,
      }),
      columnHelper.accessor("description", {
        header: "Description",
        cell: (info) => (
          <span className="max-w-xs truncate text-muted-foreground">
            {info.getValue() ?? "-"}
          </span>
        ),
      }),
      columnHelper.accessor("memberCount", {
        header: "Members",
        cell: (info) => info.getValue() ?? "-",
      }),
    ],
    [expandedGroupId]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: groups,
    columns,
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = filterValue.toLowerCase();
      return (
        row.original.displayName?.toLowerCase().includes(search) || false
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    initialState: {
      pagination: { pageSize: 50 },
    },
  });

  const selectedIds = Object.keys(selectedUserIds).filter(
    (k) => selectedUserIds[k]
  );

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  useEffect(() => {
    if (!expandedGroupId) {
      setAvailableUserIds([]);
    }
  }, [expandedGroupId]);

  const handleVisibleMembersChange = (userIds: string[]) => {
    setAvailableUserIds(userIds);
  };

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-destructive">
            Failed to load groups: {(error as Error).message}
          </p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Groups</h1>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by group name..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="pl-8"
        />
      </div>

      {availableUserIds.length > 0 && (
        <UserSelectionToolbar
          totalCount={availableUserIds.length}
          selectedIds={selectedIds}
          allIds={availableUserIds}
          onSelectionChange={(ids) => {
            const newSelection: Record<string, boolean> = {};
            ids.forEach((id) => {
              newSelection[id] = true;
            });
            setSelectedUserIds(newSelection);
          }}
        />
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <>
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
                    No groups found.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <Fragment key={row.id}>
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                    {expandedGroupId === row.original.id && (
                      <TableRow key={`${row.id}-members`}>
                        <TableCell
                          colSpan={columns.length}
                          className="bg-muted/30 p-0"
                        >
                          <GroupMembersPanel
                            groupId={row.original.id}
                            selectedUserIds={selectedUserIds}
                            onToggleUser={toggleUser}
                            onMembersChange={handleVisibleMembersChange}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {table.getFilteredRowModel().rows.length} groups
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {table.getPageCount()}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
