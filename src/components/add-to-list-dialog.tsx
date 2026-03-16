"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface AddToListDialogProps {
  selectedUserIds: string[];
  onDone: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ListItem {
  id: string;
  name: string;
  description: string | null;
  _count?: { members: number };
}

export function AddToListDialog({
  selectedUserIds,
  onDone,
  open,
  onOpenChange,
}: AddToListDialogProps) {
  const queryClient = useQueryClient();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const { data: lists, isLoading: listsLoading } = useQuery<ListItem[]>({
    queryKey: ["lists"],
    queryFn: async () => {
      const res = await fetch("/api/lists");
      if (!res.ok) throw new Error("Failed to fetch lists");
      return res.json();
    },
    enabled: open,
  });

  const createListMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: newDescription }),
      });
      if (!res.ok) throw new Error("Failed to create list");
      return res.json() as Promise<ListItem>;
    },
  });

  const addMembersMutation = useMutation({
    mutationFn: async (listId: string) => {
      const res = await fetch(`/api/lists/${listId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selectedUserIds }),
      });
      if (!res.ok) throw new Error("Failed to add members");
      return res.json();
    },
  });

  const finalize = (listId: string) => {
    queryClient.invalidateQueries({ queryKey: ["lists"] });
    queryClient.invalidateQueries({ queryKey: ["list", listId] });
    setSelectedListId(null);
    setShowCreate(false);
    setNewName("");
    setNewDescription("");
    onOpenChange(false);
    onDone();
  };

  const handleAdd = async () => {
    if (!selectedListId) return;

    try {
      await addMembersMutation.mutateAsync(selectedListId);
      toast.success(
        `Added ${selectedUserIds.length} user${selectedUserIds.length !== 1 ? "s" : ""} to list`
      );
      finalize(selectedListId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add members";
      toast.error(message);
    }
  };

  const handleCreateAndAdd = async () => {
    try {
      const list = await createListMutation.mutateAsync();
      await addMembersMutation.mutateAsync(list.id);
      toast.success(
        `Created list and added ${selectedUserIds.length} user${selectedUserIds.length !== 1 ? "s" : ""}`
      );
      finalize(list.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create list";
      toast.error(message);
    }
  };

  const isPending = addMembersMutation.isPending || createListMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to List</DialogTitle>
          <DialogDescription>
            Add {selectedUserIds.length} selected user
            {selectedUserIds.length !== 1 ? "s" : ""} to a list.
          </DialogDescription>
        </DialogHeader>

        {showCreate ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-list-name">List name</Label>
              <Input
                id="new-list-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter list name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-list-desc">Description (optional)</Label>
              <Textarea
                id="new-list-desc"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Enter description"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {listsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : lists && lists.length > 0 ? (
              <ScrollArea className="max-h-60">
                <div className="space-y-1">
                  {lists.map((list) => (
                    <button
                      key={list.id}
                      type="button"
                      onClick={() => setSelectedListId(list.id)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                        selectedListId === list.id &&
                          "bg-accent text-accent-foreground"
                      )}
                    >
                      <span className="font-medium">{list.name}</span>
                      {list._count && (
                        <span className="text-xs text-muted-foreground">
                          {list._count.members} members
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No lists yet. Create one to get started.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {showCreate ? (
            <>
              <Button
                variant="outline"
                onClick={() => setShowCreate(false)}
                disabled={isPending}
              >
                Back
              </Button>
              <Button
                onClick={handleCreateAndAdd}
                disabled={!newName.trim() || isPending}
              >
                {isPending && (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                )}
                Create List
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                New List
              </Button>
              <Button
                onClick={handleAdd}
                disabled={!selectedListId || isPending}
              >
                {addMembersMutation.isPending && (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                )}
                Add to List
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
