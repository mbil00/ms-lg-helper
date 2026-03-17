"use client";

import { PanelRight } from "lucide-react";
import { useListPanelOpen, useGlobalSelection } from "@/contexts/list-panel-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ListPanelToggle() {
  const { panelOpen, togglePanel } = useListPanelOpen();
  const { selectedCount } = useGlobalSelection();

  if (panelOpen) return null;

  return (
    <div className="fixed right-0 top-1/2 z-40 -translate-y-1/2">
      <Button
        variant="outline"
        size="sm"
        className="rounded-l-md rounded-r-none border-r-0 shadow-md"
        onClick={togglePanel}
      >
        <PanelRight className="h-4 w-4" />
        {selectedCount > 0 && (
          <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 text-xs">
            {selectedCount}
          </Badge>
        )}
      </Button>
    </div>
  );
}
