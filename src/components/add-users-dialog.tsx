"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Loader2, CheckSquare, Square } from "lucide-react";
import type { GraphUser } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AddUsersDialogProps {
  listId: string;
  existingUserIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

export function AddUsersDialog({
  listId,
  existingUserIds,
  open,
  onOpenChange,
  onDone,
}: AddUsersDialogProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: users = [], isLoading } = useQuery<GraphUser[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: open,
  });

  const existingSet = useMemo(
    () => new Set(existingUserIds),
    [existingUserIds]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.displayName?.toLowerCase().includes(q) ||
        u.mail?.toLowerCase().includes(q) ||
        u.userPrincipalName?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const u of filtered) {
        if (!existingSet.has(u.id)) next.add(u.id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelected(new Set());
  };

  const addMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      const res = await fetch(`/api/lists/${listId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds }),
      });
      if (!res.ok) throw new Error("Failed to add users");
      return res.json();
    },
    onSuccess: () => {
      const count = selected.size;
      toast.success(
        `Added ${count} user${count !== 1 ? "s" : ""} to list`
      );
      queryClient.invalidateQueries({ queryKey: ["list", listId] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      setSelected(new Set());
      setSearch("");
      onOpenChange(false);
      onDone();
    },
    onError: (err) => {
      toast.error(`Failed to add users: ${err.message}`);
    },
  });

  const handleAdd = () => {
    if (selected.size === 0) return;
    addMutation.mutate([...selected]);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelected(new Set());
      setSearch("");
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Users to List</DialogTitle>
          <DialogDescription>
            Search and select users from your directory.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or UPN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={selectAllFiltered}>
              <CheckSquare className="mr-1 h-3.5 w-3.5" />
              Select all
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <Square className="mr-1 h-3.5 w-3.5" />
              Select none
            </Button>
            {selected.size > 0 && (
              <Badge variant="secondary">{selected.size} selected</Badge>
            )}
          </div>

          <ScrollArea className="h-72 rounded-md border">
            {isLoading ? (
              <div className="flex h-full items-center justify-center p-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                {search ? "No users match your search." : "No users found."}
              </p>
            ) : (
              <div className="divide-y">
                {filtered.map((user) => {
                  const alreadyInList = existingSet.has(user.id);
                  const isSelected = selected.has(user.id);
                  return (
                    <label
                      key={user.id}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent"
                      data-disabled={alreadyInList || undefined}
                    >
                      <Checkbox
                        checked={alreadyInList || isSelected}
                        disabled={alreadyInList}
                        onCheckedChange={() => toggle(user.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {user.displayName}
                          {alreadyInList && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              (already in list)
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {user.mail ?? user.userPrincipalName}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={addMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={selected.size === 0 || addMutation.isPending}
          >
            {addMutation.isPending && (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            )}
            Add {selected.size > 0 ? `${selected.size} users` : "to list"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
