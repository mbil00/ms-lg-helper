"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
} from "react";
import { useQuery } from "@tanstack/react-query";

interface ListPanelState {
  panelOpen: boolean;
  activeListId: string | null;
  globalSelection: Set<string>;
  visibleUserIds: string[];
}

type Action =
  | { type: "TOGGLE_PANEL" }
  | { type: "SET_PANEL_OPEN"; open: boolean }
  | { type: "SET_ACTIVE_LIST"; listId: string | null }
  | { type: "SELECT_USERS"; ids: string[] }
  | { type: "DESELECT_USERS"; ids: string[] }
  | { type: "SET_SELECTION"; ids: string[] }
  | { type: "CLEAR_SELECTION" }
  | { type: "TOGGLE_USER"; id: string }
  | { type: "SET_VISIBLE_USERS"; ids: string[] };

function reducer(state: ListPanelState, action: Action): ListPanelState {
  switch (action.type) {
    case "TOGGLE_PANEL":
      return { ...state, panelOpen: !state.panelOpen };
    case "SET_PANEL_OPEN":
      return { ...state, panelOpen: action.open };
    case "SET_ACTIVE_LIST":
      return { ...state, activeListId: action.listId };
    case "SELECT_USERS": {
      const next = new Set(state.globalSelection);
      for (const id of action.ids) next.add(id);
      return { ...state, globalSelection: next };
    }
    case "DESELECT_USERS": {
      const next = new Set(state.globalSelection);
      for (const id of action.ids) next.delete(id);
      return { ...state, globalSelection: next };
    }
    case "SET_SELECTION":
      return { ...state, globalSelection: new Set(action.ids) };
    case "CLEAR_SELECTION":
      return { ...state, globalSelection: new Set() };
    case "TOGGLE_USER": {
      const next = new Set(state.globalSelection);
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return { ...state, globalSelection: next };
    }
    case "SET_VISIBLE_USERS":
      return { ...state, visibleUserIds: action.ids };
  }
}

const initialState: ListPanelState = {
  panelOpen: false,
  activeListId: null,
  globalSelection: new Set(),
  visibleUserIds: [],
};

interface ActiveListMember {
  userId: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
}

interface ListPanelContextValue {
  state: ListPanelState;
  dispatch: React.Dispatch<Action>;
  activeListMembers: ActiveListMember[];
  activeListMemberIds: Set<string>;
}

const ListPanelContext = createContext<ListPanelContextValue | null>(null);

export function ListPanelProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const { data: activeListData } = useQuery<{
    members: {
      userId: string;
      user?: {
        id: string;
        displayName: string;
        mail: string | null;
        userPrincipalName: string;
      };
      displayName?: string;
      mail?: string;
      userPrincipalName?: string;
    }[];
  }>({
    queryKey: ["list", state.activeListId],
    queryFn: async () => {
      const res = await fetch(`/api/lists/${state.activeListId}`);
      if (!res.ok) throw new Error("Failed to fetch active list");
      return res.json();
    },
    enabled: !!state.activeListId,
  });

  const activeListMembers: ActiveListMember[] = useMemo(() => {
    if (!activeListData?.members) return [];
    return activeListData.members.map((m) => ({
      userId: m.userId,
      displayName: m.user?.displayName ?? m.displayName ?? "",
      mail: m.user?.mail ?? m.mail ?? null,
      userPrincipalName:
        m.user?.userPrincipalName ?? m.userPrincipalName ?? "",
    }));
  }, [activeListData]);

  const activeListMemberIds = useMemo(
    () => new Set(activeListMembers.map((m) => m.userId)),
    [activeListMembers]
  );

  const value = useMemo(
    () => ({ state, dispatch, activeListMembers, activeListMemberIds }),
    [state, dispatch, activeListMembers, activeListMemberIds]
  );

  return (
    <ListPanelContext.Provider value={value}>
      {children}
    </ListPanelContext.Provider>
  );
}

function useListPanelContext() {
  const ctx = useContext(ListPanelContext);
  if (!ctx)
    throw new Error("useListPanelContext must be used within ListPanelProvider");
  return ctx;
}

export function useListPanelOpen() {
  const { state, dispatch } = useListPanelContext();
  return {
    panelOpen: state.panelOpen,
    togglePanel: useCallback(() => dispatch({ type: "TOGGLE_PANEL" }), [dispatch]),
    setOpen: useCallback(
      (open: boolean) => dispatch({ type: "SET_PANEL_OPEN", open }),
      [dispatch]
    ),
  };
}

export function useGlobalSelection() {
  const { state, dispatch } = useListPanelContext();

  return {
    selectedIds: state.globalSelection,
    selectedCount: state.globalSelection.size,
    select: useCallback(
      (ids: string[]) => dispatch({ type: "SELECT_USERS", ids }),
      [dispatch]
    ),
    deselect: useCallback(
      (ids: string[]) => dispatch({ type: "DESELECT_USERS", ids }),
      [dispatch]
    ),
    setSelection: useCallback(
      (ids: string[]) => dispatch({ type: "SET_SELECTION", ids }),
      [dispatch]
    ),
    clear: useCallback(
      () => dispatch({ type: "CLEAR_SELECTION" }),
      [dispatch]
    ),
    toggle: useCallback(
      (id: string) => dispatch({ type: "TOGGLE_USER", id }),
      [dispatch]
    ),
    isSelected: useCallback(
      (id: string) => state.globalSelection.has(id),
      [state.globalSelection]
    ),
  };
}

export function useActiveList() {
  const { state, dispatch, activeListMembers, activeListMemberIds } =
    useListPanelContext();

  return {
    activeListId: state.activeListId,
    activeListMembers,
    activeListMemberIds,
    setActiveList: useCallback(
      (listId: string | null) =>
        dispatch({ type: "SET_ACTIVE_LIST", listId }),
      [dispatch]
    ),
    clearActiveList: useCallback(
      () => dispatch({ type: "SET_ACTIVE_LIST", listId: null }),
      [dispatch]
    ),
    isInActiveList: useCallback(
      (userId: string) => activeListMemberIds.has(userId),
      [activeListMemberIds]
    ),
  };
}

export function useVisibleUsers() {
  const { state, dispatch } = useListPanelContext();

  return {
    visibleUserIds: state.visibleUserIds,
    setVisibleUsers: useCallback(
      (ids: string[]) => dispatch({ type: "SET_VISIBLE_USERS", ids }),
      [dispatch]
    ),
  };
}
