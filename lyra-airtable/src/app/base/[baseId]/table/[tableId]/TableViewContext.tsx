"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useParams } from "next/navigation";
import type { FilterCondition, SortType } from "./types";
import type { RouterInputs, RouterOutputs } from "@/trpc/react";
import { api } from "@/trpc/react";

type TableDataQueryInput = RouterInputs["table"]["getData"];
type View = RouterOutputs["view"]["getViews"][number];

type TableViewContextType = {
  // Search
  searchBarOpen: boolean;
  setSearchBarOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchButtonRef: React.RefObject<HTMLButtonElement | null> | null;
  setSearchButtonRef: React.Dispatch<
    React.SetStateAction<React.RefObject<HTMLButtonElement | null> | null>
  >;

  // Filters
  filterPanelOpen: boolean;
  setFilterPanelOpen: (open: boolean) => void;
  filterButtonRef: React.RefObject<HTMLButtonElement | null> | null;
  setFilterButtonRef: React.Dispatch<
    React.SetStateAction<React.RefObject<HTMLButtonElement | null> | null>
  >;
  filters: FilterCondition[];
  setFilters: (filters: FilterCondition[]) => void;
  filterConjunction: "and" | "or";
  setFilterConjunction: (mode: "and" | "or") => void;

  // Sorts
  sortPanelOpen: boolean;
  setSortPanelOpen: (open: boolean) => void;
  sortButtonRef: React.RefObject<HTMLButtonElement | null> | null;
  setSortButtonRef: React.Dispatch<
    React.SetStateAction<React.RefObject<HTMLButtonElement | null> | null>
  >;
  sorts: SortType[];
  setSorts: (sorts: SortType[]) => void;

  // Query key
  dataQueryKey: TableDataQueryInput | null;
  setDataQueryKey: (key: TableDataQueryInput) => void;

  // Busy state
  isBusy: boolean;
  setIsBusy: (v: boolean) => void;

  // ✅ NEW: Views
  views: View[];
  viewsLoading: boolean;
  currentViewId: string | null;
  currentView: View | null;
  setCurrentViewId: (viewId: string | null) => void;
  createView: (name: string) => Promise<View>;
  deleteView: (viewId: string) => Promise<void>;
  renameView: (viewId: string, name: string) => Promise<void>;
  duplicateView: (viewId: string) => Promise<View>;
  isViewDirty: boolean; // Has unsaved changes
};

const TableViewContext = createContext<TableViewContextType | null>(null);

export function TableViewProvider({ children }: { children: React.ReactNode }) {
  const params = useParams<{ tableId: string }>();
  const tableId = params.tableId;

  // Search state
  const [searchBarOpen, setSearchBarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchButtonRef, setSearchButtonRef] =
    useState<React.RefObject<HTMLButtonElement | null> | null>(null);

  // Filter state
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filterButtonRef, setFilterButtonRef] =
    useState<React.RefObject<HTMLButtonElement | null> | null>(null);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [filterConjunction, setFilterConjunction] = useState<"and" | "or">(
    "and",
  );

  // Sort state
  const [sortPanelOpen, setSortPanelOpen] = useState(false);
  const [sortButtonRef, setSortButtonRef] =
    useState<React.RefObject<HTMLButtonElement | null> | null>(null);
  const [sorts, setSorts] = useState<SortType[]>([]);

  // Other state
  const [isBusy, setIsBusy] = useState(false);
  const [dataQueryKey, setDataQueryKey] = useState<TableDataQueryInput | null>(
    null,
  );

  // ✅ NEW: View state
  const [currentViewId, setCurrentViewId] = useState<string | null>(null);
  const [isViewDirty, setIsViewDirty] = useState(false);
  const isLoadingView = useRef(false); // Prevent save while loading

  const utils = api.useUtils();

  // Fetch views for this table
  const { data: views = [], isLoading: viewsLoading } =
    api.view.getViews.useQuery({ tableId }, { enabled: !!tableId });

  // Get current view object
  const currentView = views.find((v) => v.id === currentViewId) ?? null;

  // Auto-select first view when views load
  useEffect(() => {
    if (views.length > 0 && !currentViewId) {
      setCurrentViewId(views[0]!.id);
    }
  }, [views, currentViewId]);

  // Load view data when view changes
  useEffect(() => {
    if (!currentView) return;

    isLoadingView.current = true;

    // Load filters from view
    const viewFilters =
      (currentView.filtersJson as unknown as FilterCondition[]) ?? [];
    setFilters(viewFilters);

    // Load filter conjunction
    setFilterConjunction(
      (currentView.filterConjunction as "and" | "or") ?? "and",
    );

    // Load sorts from view
    const viewSorts = (currentView.sortsJson as unknown as SortType[]) ?? [];
    setSorts(viewSorts);

    // Mark as clean after loading
    setIsViewDirty(false);

    // Allow saves after a brief delay
    setTimeout(() => {
      isLoadingView.current = false;
    }, 100);
  }, [currentViewId, currentView?.id]); // Only reload when view ID changes

  // Update view mutation
  const updateViewMutation = api.view.update.useMutation({
    onSuccess: () => {
      utils.view.getViews.invalidate({ tableId });
      setIsViewDirty(false);
    },
  });

  // Auto-save view when filters/sorts change (debounced)
  useEffect(() => {
    if (!currentViewId || isLoadingView.current) return;

    // Mark as dirty
    setIsViewDirty(true);

    const timeout = setTimeout(() => {
      updateViewMutation.mutate({
        viewId: currentViewId,
        filtersJson: filters,
        filterConjunction,
        sortsJson: sorts,
      });
    }, 1000); // Debounce 1 second

    return () => clearTimeout(timeout);
  }, [filters, filterConjunction, sorts, currentViewId]);

  // Create view mutation
  const createViewMutation = api.view.create.useMutation({
    onSuccess: (newView) => {
      utils.view.getViews.invalidate({ tableId });
      setCurrentViewId(newView.id);
    },
  });

  const createView = useCallback(
    async (name: string) => {
      const newView = await createViewMutation.mutateAsync({
        tableId,
        name,
      });
      return newView;
    },
    [tableId, createViewMutation],
  );

  // Delete view mutation
  const deleteViewMutation = api.view.delete.useMutation({
    onSuccess: () => {
      utils.view.getViews.invalidate({ tableId });
    },
  });

  const deleteView = useCallback(
    async (viewId: string) => {
      await deleteViewMutation.mutateAsync({ viewId });

      // If we deleted the current view, select another one
      if (viewId === currentViewId) {
        const remainingViews = views.filter((v) => v.id !== viewId);
        if (remainingViews.length > 0) {
          setCurrentViewId(remainingViews[0]!.id);
        } else {
          setCurrentViewId(null);
        }
      }
    },
    [deleteViewMutation, currentViewId, views],
  );

  // Rename view
  const renameView = useCallback(
    async (viewId: string, name: string) => {
      await updateViewMutation.mutateAsync({ viewId, name });
    },
    [updateViewMutation],
  );

  // Duplicate view
  const duplicateView = useCallback(
    async (viewId: string) => {
      const viewToDuplicate = views.find((v) => v.id === viewId);
      if (!viewToDuplicate) throw new Error("View not found");

      const newView = await createViewMutation.mutateAsync({
        tableId,
        name: `${viewToDuplicate.name} (copy)`,
      });

      // Copy filters/sorts to new view
      await updateViewMutation.mutateAsync({
        viewId: newView.id,
        filtersJson:
          viewToDuplicate.filtersJson as unknown as FilterCondition[],
        filterConjunction: viewToDuplicate.filterConjunction as "and" | "or",
        sortsJson: viewToDuplicate.sortsJson as unknown as SortType[],
        hiddenCols: viewToDuplicate.hiddenCols as unknown as string[],
      });

      return newView;
    },
    [tableId, views, createViewMutation, updateViewMutation],
  );

  // Add a ref to track if we've already tried to auto-create
  const hasAttemptedAutoCreate = useRef(false);

  // Auto-create default view if table has no views
  useEffect(() => {
    // Only attempt once per table
    if (hasAttemptedAutoCreate.current) return;

    // Wait until views have loaded
    if (viewsLoading) return;

    // Only create if there are no views and we're not already creating
    if (views.length === 0 && tableId && !createViewMutation.isPending) {
      hasAttemptedAutoCreate.current = true;
      createViewMutation.mutate({
        tableId,
        name: "Grid view",
      });
    }
  }, [viewsLoading, views.length, tableId, createViewMutation.isPending]);

  // Reset the flag when tableId changes (navigating to a different table)
  useEffect(() => {
    hasAttemptedAutoCreate.current = false;
  }, [tableId]);

  return (
    <TableViewContext.Provider
      value={{
        // Search
        searchBarOpen,
        setSearchBarOpen,
        searchQuery,
        setSearchQuery,
        searchButtonRef,
        setSearchButtonRef,

        // Filters
        filterPanelOpen,
        setFilterPanelOpen,
        filterButtonRef,
        setFilterButtonRef,
        filters,
        setFilters,
        filterConjunction,
        setFilterConjunction,

        // Sorts
        sortPanelOpen,
        setSortPanelOpen,
        sortButtonRef,
        setSortButtonRef,
        sorts,
        setSorts,

        // Query key
        dataQueryKey,
        setDataQueryKey,

        // Busy
        isBusy,
        setIsBusy,

        // Views
        views,
        viewsLoading,
        currentViewId,
        currentView,
        setCurrentViewId,
        createView,
        deleteView,
        renameView,
        duplicateView,
        isViewDirty,
      }}
    >
      {children}
    </TableViewContext.Provider>
  );
}

export function useTableView() {
  const context = useContext(TableViewContext);
  if (!context) {
    throw new Error("useTableView must be used within TableViewProvider");
  }
  return context;
}
