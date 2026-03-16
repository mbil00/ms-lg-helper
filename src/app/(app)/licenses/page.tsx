"use client";

import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, ChevronRight, Users, Shield, X } from "lucide-react";
import type { GraphLicense, LicenseAssignee, GraphUser } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { UserSelectionToolbar } from "@/components/user-selection-toolbar";
import { cn } from "@/lib/utils";

export default function LicensesPage() {
  const [selectedSkuId, setSelectedSkuId] = useState<string | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Record<string, boolean>>({});

  const {
    data: licenses = [],
    isLoading,
    error,
    refetch,
  } = useQuery<GraphLicense[]>({
    queryKey: ["licenses"],
    queryFn: async () => {
      const res = await fetch("/api/licenses");
      if (!res.ok) throw new Error("Failed to fetch licenses");
      return res.json();
    },
  });

  const {
    data: assignees,
    isLoading: assigneesLoading,
  } = useQuery<LicenseAssignee[]>({
    queryKey: ["license-assignees", selectedSkuId],
    queryFn: async () => {
      const res = await fetch(`/api/licenses?skuId=${selectedSkuId}`);
      if (!res.ok) throw new Error("Failed to fetch assignees");
      return res.json();
    },
    enabled: !!selectedSkuId,
  });

  const {
    data: groupMembers,
    isLoading: groupMembersLoading,
  } = useQuery<GraphUser[]>({
    queryKey: ["group-members", expandedGroupId],
    queryFn: async () => {
      const res = await fetch(`/api/groups?groupId=${expandedGroupId}`);
      if (!res.ok) throw new Error("Failed to fetch group members");
      return res.json();
    },
    enabled: !!expandedGroupId,
  });

  const selectedLicense = licenses.find((l) => l.skuId === selectedSkuId);

  const selectedIds = Object.keys(selectedUserIds).filter(
    (k) => selectedUserIds[k]
  );

  const allSelectableIds = useMemo(() => {
    const ids: string[] = [];
    if (assignees) {
      assignees
        .filter((a) => a.type === "user")
        .forEach((a) => ids.push(a.id));
    }
    if (groupMembers) {
      groupMembers.forEach((m) => {
        if (!ids.includes(m.id)) ids.push(m.id);
      });
    }
    return ids;
  }, [assignees, groupMembers]);

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-destructive">
            Failed to load licenses: {(error as Error).message}
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
      <h1 className="text-2xl font-semibold">Licenses</h1>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {licenses.map((license) => {
            const total = license.prepaidUnits.enabled;
            const assigned = license.consumedUnits;
            const available = total - assigned;
            const utilization = total > 0 ? (assigned / total) * 100 : 0;

            return (
              <Card
                key={license.skuId}
                className={cn(
                  "cursor-pointer transition-shadow hover:shadow-md",
                  selectedSkuId === license.skuId && "ring-2 ring-primary"
                )}
                onClick={() => {
                  setSelectedSkuId(
                    selectedSkuId === license.skuId ? null : license.skuId
                  );
                  setExpandedGroupId(null);
                  setSelectedUserIds({});
                }}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    {license.skuPartNumber}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-semibold">{total}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{assigned}</p>
                      <p className="text-xs text-muted-foreground">Assigned</p>
                    </div>
                    <div>
                      <p className={cn(
                        "text-lg font-semibold",
                        available <= 0 && "text-destructive"
                      )}>
                        {available}
                      </p>
                      <p className="text-xs text-muted-foreground">Available</p>
                    </div>
                  </div>
                  <Progress value={utilization} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selectedSkuId && selectedLicense && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {selectedLicense.skuPartNumber} - Assignees
            </h2>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setSelectedSkuId(null);
                setExpandedGroupId(null);
                setSelectedUserIds({});
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {allSelectableIds.length > 0 && (
            <UserSelectionToolbar
              totalCount={allSelectableIds.length}
              selectedIds={selectedIds}
              allIds={allSelectableIds}
              onSelectionChange={(ids) => {
                const newSelection: Record<string, boolean> = {};
                ids.forEach((id) => {
                  newSelection[id] = true;
                });
                setSelectedUserIds(newSelection);
              }}
            />
          )}

          {assigneesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : assignees && assignees.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Name</TableHead>
                  <TableHead>UPN</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignees.map((assignee) => (
                  <Fragment key={assignee.id}>
                    <TableRow key={assignee.id}>
                      <TableCell>
                        {assignee.type === "user" && (
                          <Checkbox
                            checked={!!selectedUserIds[assignee.id]}
                            onCheckedChange={() =>
                              toggleUserSelection(assignee.id)
                            }
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {assignee.type === "group" ? (
                            <Users className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Shield className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="font-medium">
                            {assignee.displayName}
                          </span>
                          {assignee.type === "group" &&
                            assignee.memberCount !== undefined && (
                              <span className="text-xs text-muted-foreground">
                                ({assignee.memberCount} members)
                              </span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {assignee.userPrincipalName ?? "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            assignee.type === "user" ? "default" : "secondary"
                          }
                        >
                          {assignee.type === "user" ? "Direct" : "Group"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {assignee.type === "group" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedGroupId(
                                expandedGroupId === assignee.id
                                  ? null
                                  : assignee.id
                              );
                            }}
                          >
                            <ChevronRight
                              className={cn(
                                "h-4 w-4 transition-transform",
                                expandedGroupId === assignee.id && "rotate-90"
                              )}
                            />
                            Members
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {assignee.type === "group" &&
                      expandedGroupId === assignee.id && (
                        <TableRow key={`${assignee.id}-members`}>
                          <TableCell colSpan={5} className="bg-muted/30 p-0">
                            <div className="px-8 py-3">
                              {groupMembersLoading ? (
                                <div className="space-y-2">
                                  {Array.from({ length: 3 }).map((_, i) => (
                                    <Skeleton
                                      key={i}
                                      className="h-8 w-full"
                                    />
                                  ))}
                                </div>
                              ) : groupMembers && groupMembers.length > 0 ? (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-10" />
                                      <TableHead>Display Name</TableHead>
                                      <TableHead>Email</TableHead>
                                      <TableHead>UPN</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {groupMembers.map((member) => (
                                      <TableRow key={member.id}>
                                        <TableCell>
                                          <Checkbox
                                            checked={
                                              !!selectedUserIds[member.id]
                                            }
                                            onCheckedChange={() =>
                                              toggleUserSelection(member.id)
                                            }
                                          />
                                        </TableCell>
                                        <TableCell className="font-medium">
                                          {member.displayName}
                                        </TableCell>
                                        <TableCell>
                                          {member.mail ?? "-"}
                                        </TableCell>
                                        <TableCell>
                                          {member.userPrincipalName}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              ) : (
                                <p className="py-2 text-sm text-muted-foreground">
                                  No members found.
                                </p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No assignees found for this license.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
