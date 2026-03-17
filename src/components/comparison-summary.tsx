"use client";

import { useMemo } from "react";
import { useActiveList, useVisibleUsers } from "@/contexts/list-panel-context";
import { Badge } from "@/components/ui/badge";

export function ComparisonSummary() {
  const { activeListId, activeListMemberIds } = useActiveList();
  const { visibleUserIds } = useVisibleUsers();

  const stats = useMemo(() => {
    if (!activeListId) return null;
    const visibleSet = new Set(visibleUserIds);
    let common = 0;
    let onlyScreen = 0;
    let onlyList = 0;

    for (const id of visibleUserIds) {
      if (activeListMemberIds.has(id)) common++;
      else onlyScreen++;
    }
    for (const id of activeListMemberIds) {
      if (!visibleSet.has(id)) onlyList++;
    }

    return { common, onlyScreen, onlyList };
  }, [activeListId, activeListMemberIds, visibleUserIds]);

  if (!stats) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <Badge variant="outline" className="gap-1">
        <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
        {stats.common} in common
      </Badge>
      <Badge variant="outline" className="gap-1">
        <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/20" />
        {stats.onlyScreen} only here
      </Badge>
      <Badge variant="outline" className="gap-1">
        {stats.onlyList} only in list
      </Badge>
    </div>
  );
}
