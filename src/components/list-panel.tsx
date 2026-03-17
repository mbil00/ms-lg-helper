"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  Pin,
  PinOff,
  ChevronRight,
  ListPlus,
  Trash2,
  Users,
  Search,
} from "lucide-react";
import {
  useListPanelOpen,
  useGlobalSelection,
  useActiveList,
} from "@/contexts/list-panel-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AddToListDialog } from "@/components/add-to-list-dialog";
import { ComparisonSummary } from "@/components/comparison-summary";
import { cn } from "@/lib/utils";

interface ListItem {
  id: string;
  name: string;
  description: string | null;
  _count?: { members: number };
}

export function ListPanel() {
  const router = useRouter();
  const { panelOpen, setOpen } = useListPanelOpen();
  const { selectedIds, selectedCount, clear } = useGlobalSelection();
  const { activeListId, setActiveList, clearActiveList, activeListMembers } =
    useActiveList();
  const [expandedListId, setExpandedListId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [listSearch, setListSearch] = useState("");

  const { data: lists = [] } = useQuery<ListItem[]>({
    queryKey: ["lists"],
    queryFn: async () => {
      const res = await fetch("/api/lists");
      if (!res.ok) throw new Error("Failed to fetch lists");
      return res.json();
    },
  });

  const filteredLists = useMemo(() => {
    if (!listSearch.trim()) return lists;
    const q = listSearch.toLowerCase();
    return lists.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.description?.toLowerCase().includes(q)
    );
  }, [lists, listSearch]);

  if (!panelOpen) return null;

  return (
    <aside className="flex h-screen w-80 flex-col border-l bg-card">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <span className="font-semibold">Lists Panel</span>
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {/* Selection section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Selection</h3>
              <Badge variant="secondary">{selectedCount} users</Badge>
            </div>
            {selectedCount > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setDialogOpen(true)}
                >
                  <ListPlus className="mr-1.5 h-3.5 w-3.5" />
                  Save to list
                </Button>
                <Button variant="ghost" size="sm" onClick={clear}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Clear
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Active list / comparison */}
          {activeListId && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Comparing with</h3>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={clearActiveList}
                    title="Unpin list"
                  >
                    <PinOff className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="rounded-md border bg-muted/30 p-2">
                  <p className="text-sm font-medium">
                    {lists.find((l) => l.id === activeListId)?.name ??
                      "Loading..."}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeListMembers.length} members
                  </p>
                </div>
                <ComparisonSummary />
              </div>
              <Separator />
            </>
          )}

          {/* Lists */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Your Lists</h3>
            {lists.length > 0 && (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search lists..."
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  className="h-8 pl-7 text-xs"
                />
              </div>
            )}
            {lists.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lists yet.</p>
            ) : filteredLists.length === 0 ? (
              <p className="text-xs text-muted-foreground">No lists match.</p>
            ) : (
              <div className="space-y-1">
                {filteredLists.map((list) => (
                  <div key={list.id} className="space-y-0">
                    <div
                      className={cn(
                        "flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                        expandedListId === list.id && "bg-accent"
                      )}
                    >
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-5 w-5 shrink-0"
                        onClick={() =>
                          setExpandedListId(
                            expandedListId === list.id ? null : list.id
                          )
                        }
                      >
                        <ChevronRight
                          className={cn(
                            "h-3 w-3 transition-transform",
                            expandedListId === list.id && "rotate-90"
                          )}
                        />
                      </Button>
                      <button
                        className="flex-1 truncate text-left font-medium"
                        onClick={() => router.push(`/lists/${list.id}`)}
                      >
                        {list.name}
                      </button>
                      <Badge variant="secondary" className="text-xs">
                        {list._count?.members ?? 0}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-5 w-5 shrink-0"
                        onClick={() =>
                          activeListId === list.id
                            ? clearActiveList()
                            : setActiveList(list.id)
                        }
                        title={
                          activeListId === list.id
                            ? "Unpin list"
                            : "Pin for comparison"
                        }
                      >
                        {activeListId === list.id ? (
                          <PinOff className="h-3 w-3" />
                        ) : (
                          <Pin className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    {expandedListId === list.id && (
                      <ExpandedListMembers listId={list.id} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      <AddToListDialog
        selectedUserIds={[...selectedIds]}
        onDone={clear}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </aside>
  );
}

function ExpandedListMembers({ listId }: { listId: string }) {
  const { data, isLoading } = useQuery<{
    members: {
      userId: string;
      user?: {
        displayName: string;
        mail: string | null;
        userPrincipalName: string;
      };
      displayName?: string;
      userPrincipalName?: string;
    }[];
  }>({
    queryKey: ["list", listId],
    queryFn: async () => {
      const res = await fetch(`/api/lists/${listId}`);
      if (!res.ok) throw new Error("Failed to fetch list");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="px-6 py-2 text-xs text-muted-foreground">Loading...</div>
    );
  }

  if (!data?.members || data.members.length === 0) {
    return (
      <div className="px-6 py-2 text-xs text-muted-foreground">
        No members.
      </div>
    );
  }

  return (
    <div className="ml-6 space-y-0.5 border-l py-1 pl-2">
      {data.members.map((m) => (
        <div key={m.userId} className="flex items-center gap-1.5 px-1 py-0.5">
          <Users className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="truncate text-xs">
            {m.user?.displayName ?? m.displayName ?? m.userId}
          </span>
        </div>
      ))}
    </div>
  );
}
