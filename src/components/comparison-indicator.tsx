"use client";

import { useActiveList } from "@/contexts/list-panel-context";
import { cn } from "@/lib/utils";

export function ComparisonIndicator({ userId }: { userId: string }) {
  const { activeListId, isInActiveList } = useActiveList();

  if (!activeListId) return null;

  const inList = isInActiveList(userId);

  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full",
        inList ? "bg-green-500" : "bg-muted-foreground/20"
      )}
      title={inList ? "In active list" : "Not in active list"}
    />
  );
}
