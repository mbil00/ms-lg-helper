"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ListPlus,
  RotateCcw,
  CheckSquare,
  Square,
  Percent,
  Hash,
  Zap,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { AddToListDialog } from "@/components/add-to-list-dialog";

interface UserSelectionToolbarProps {
  totalCount: number;
  selectedIds: string[];
  allIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function UserSelectionToolbar({
  totalCount,
  selectedIds,
  allIds,
  onSelectionChange,
}: UserSelectionToolbarProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectNOpen, setSelectNOpen] = useState(false);
  const [selectNValue, setSelectNValue] = useState("");
  const [isStartingAction, setIsStartingAction] = useState(false);

  const handleSelectAll = () => {
    onSelectionChange([...allIds]);
  };

  const handleSelectNone = () => {
    onSelectionChange([]);
  };

  const handleSelectHalf = () => {
    const half = Math.ceil(allIds.length / 2);
    onSelectionChange(allIds.slice(0, half));
  };

  const handleInvertSelection = () => {
    const selectedSet = new Set(selectedIds);
    const inverted = allIds.filter((id) => !selectedSet.has(id));
    onSelectionChange(inverted);
  };

  const handleSelectN = () => {
    const n = parseInt(selectNValue, 10);
    if (!isNaN(n) && n > 0) {
      onSelectionChange(allIds.slice(0, Math.min(n, allIds.length)));
    }
    setSelectNOpen(false);
    setSelectNValue("");
  };

  const handleRunAction = async () => {
    if (selectedIds.length === 0 || isStartingAction) {
      return;
    }

    setIsStartingAction(true);

    try {
      const timestamp = new Date().toLocaleString();

      const createListResponse = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Action ${timestamp}`,
          description: "Temporary list created from the selection toolbar.",
        }),
      });

      if (!createListResponse.ok) {
        throw new Error("Failed to create action list");
      }

      const list = (await createListResponse.json()) as { id: string };

      const addMembersResponse = await fetch(`/api/lists/${list.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selectedIds }),
      });

      if (!addMembersResponse.ok) {
        throw new Error("Failed to populate action list");
      }

      queryClient.invalidateQueries({ queryKey: ["lists"] });
      onSelectionChange([]);
      toast.success("Temporary action list created");
      router.push(`/actions?listId=${list.id}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start action";
      toast.error(message);
    } finally {
      setIsStartingAction(false);
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
      <Badge variant="secondary">{selectedIds.length} selected</Badge>

      <div className="mx-1 h-4 w-px bg-border" />

      <Button variant="ghost" size="sm" onClick={handleSelectAll}>
        <CheckSquare className="mr-1 h-3.5 w-3.5" />
        Select all
      </Button>

      <Button variant="ghost" size="sm" onClick={handleSelectNone}>
        <Square className="mr-1 h-3.5 w-3.5" />
        Select none
      </Button>

      <Button variant="ghost" size="sm" onClick={handleSelectHalf}>
        <Percent className="mr-1 h-3.5 w-3.5" />
        Select 50%
      </Button>

      <Popover open={selectNOpen} onOpenChange={setSelectNOpen}>
        <PopoverTrigger
          render={
            <Button variant="ghost" size="sm" />
          }
        >
          <Hash className="mr-1 h-3.5 w-3.5" />
          Select N...
        </PopoverTrigger>
        <PopoverContent className="w-48">
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Select first N users
            </p>
            <Input
              type="number"
              min={1}
              max={totalCount}
              value={selectNValue}
              onChange={(e) => setSelectNValue(e.target.value)}
              placeholder={`1 - ${totalCount}`}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSelectN();
              }}
            />
            <Button size="sm" className="w-full" onClick={handleSelectN}>
              Select
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Button variant="ghost" size="sm" onClick={handleInvertSelection}>
        <RotateCcw className="mr-1 h-3.5 w-3.5" />
        Invert
      </Button>

      <div className="mx-1 h-4 w-px bg-border" />

      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setDialogOpen(true);
        }}
        disabled={selectedIds.length === 0}
      >
        <ListPlus className="mr-1 h-3.5 w-3.5" />
        Add to list
      </Button>

      <Button
        size="sm"
        onClick={handleRunAction}
        disabled={selectedIds.length === 0 || isStartingAction}
      >
        {isStartingAction ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Zap className="mr-1 h-3.5 w-3.5" />
        )}
        Run action
      </Button>

      <AddToListDialog
        selectedUserIds={selectedIds}
        onDone={handleSelectNone}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
