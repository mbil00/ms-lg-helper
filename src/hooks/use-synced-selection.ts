"use client";

import { useCallback, useMemo } from "react";
import { useGlobalSelection } from "@/contexts/list-panel-context";
import type { Updater } from "@tanstack/react-table";

/**
 * Bridges the global selection context with TanStack Table's rowSelection.
 * Selections from other pages are preserved when this page changes its selection.
 */
export function useSyncedSelection(pageUserIds: string[]) {
  const { selectedIds, setSelection } = useGlobalSelection();

  const pageIdSet = useMemo(() => new Set(pageUserIds), [pageUserIds]);

  // Derive rowSelection from global state, filtered to this page's users
  const rowSelection = useMemo(() => {
    const record: Record<string, boolean> = {};
    for (const id of pageUserIds) {
      if (selectedIds.has(id)) record[id] = true;
    }
    return record;
  }, [selectedIds, pageUserIds]);

  // When table selection changes, update global state
  const onRowSelectionChange = useCallback(
    (updaterOrValue: Updater<Record<string, boolean>>) => {
      const newTableSelection =
        typeof updaterOrValue === "function"
          ? updaterOrValue(rowSelection)
          : updaterOrValue;

      // Keep selections from other pages, replace this page's selections
      const otherPageSelections = [...selectedIds].filter(
        (id) => !pageIdSet.has(id)
      );
      const thisPageSelections = Object.keys(newTableSelection).filter(
        (k) => newTableSelection[k]
      );
      setSelection([...otherPageSelections, ...thisPageSelections]);
    },
    [rowSelection, selectedIds, pageIdSet, setSelection]
  );

  // Selected IDs scoped to this page
  const pageSelectedIds = useMemo(
    () => Object.keys(rowSelection).filter((k) => rowSelection[k]),
    [rowSelection]
  );

  return { rowSelection, onRowSelectionChange, pageSelectedIds };
}
