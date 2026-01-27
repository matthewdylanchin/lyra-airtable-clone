"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ColumnSizingState } from "@tanstack/react-table";
import { api } from "@/trpc/react";
import SortPanel from "./Components/SortPanel";
import { useTableEditing, type PendingEditsMap } from "./hooks/useTableEditing";
import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation";
import { useTableView } from "./TableViewContext";
import { createColumns } from "./columns";
import { TableView } from "./TableView";
import SearchBar from "./Components/Searchbar";
import type {
  SelectedCell,
  ColumnInsertPosition,
  AddColumnState,
  FilterCondition,
  TableRow,
} from "./types";
import FilterPanel from "./Components/FilterPanel";
import BottomBar from "@/app/_components/shell/BottomBar";
import type { SortType } from "./types";
import { useWindowedData } from "./hooks/useWindowedData";

export default function TableClient() {
  const params = useParams<{ tableId: string }>();
  const tableId = params.tableId;
  const { hiddenColumnIds } = useTableView();

  const {
    searchBarOpen,
    setSearchBarOpen,
    filterPanelOpen,
    setFilterPanelOpen,
    filterButtonRef,
    sortPanelOpen,
    setSortPanelOpen,
    sortButtonRef,
    setIsBusy,
    isBulkLoading,
  } = useTableView();

  // ========================================
  // DEBOUNCED SEARCH AND FILTER STATE
  // ========================================

  // Local state for immediate UI feedback
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const [localFilters, setLocalFilters] = useState<FilterCondition[]>([]);
  const [localFilterConjunction, setLocalFilterConjunction] = useState<
    "and" | "or"
  >("and");
  const [localSorts, setSorts] = useState<SortType[]>([]);

  // Debounced state that actually triggers queries
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [debouncedFilters, setDebouncedFilters] = useState<FilterCondition[]>(
    [],
  );
  const [debouncedFilterConjunction, setDebouncedFilterConjunction] = useState<
    "and" | "or"
  >("and");

  // Debounce search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(localSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearchQuery]);

  // Debounce filters (500ms - longer since more complex)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(localFilters);
      setDebouncedFilterConjunction(localFilterConjunction);
    }, 500);
    return () => clearTimeout(timer);
  }, [localFilters, localFilterConjunction]);

  const searchButtonRef = useRef<HTMLButtonElement>(null);

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
    if (typeof window === "undefined") return {};
    const saved = localStorage.getItem(`table-column-sizing-${tableId}`);
    if (saved != null) {
      try {
        return JSON.parse(saved) as ColumnSizingState;
      } catch {
        console.warn("Invalid column sizing in localStorage, resetting.");
      }
    }
    return {} as ColumnSizingState;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      `table-column-sizing-${tableId}`,
      JSON.stringify(columnSizing),
    );
  }, [columnSizing, tableId]);

  const [addColumnOpen, setAddColumnOpen] = useState<AddColumnState>(null);
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, string>>(
    {},
  );
  const pendingEditsRef = useRef<PendingEditsMap>(new Map());

  // Use windowed data hook with debounced values
  const {
    table: tableInfo,
    columns,
    totalCount,
    getRowAtIndex,
    getCellValue,
    isRowLoaded,
    loadRange,
    isInitialLoading,
    isLoadingRange,
    error,
    invalidateCache,
    cellByKey,
    data,
    addOptimisticRow,
    insertOptimisticRow,
    removeOptimisticRow,
    replaceOptimisticRowId,
    deleteRowOptimistically,
    addOptimisticColumn,
    removeOptimisticColumn,
    replaceOptimisticColumnId,
    setPendingCellEdit,
    clearPendingCellEdit,
  } = useWindowedData({
    tableId,
    windowSize: 500,
    overscan: 100,
    searchQuery: debouncedSearchQuery || undefined,
    filters: debouncedFilters.length > 0 ? debouncedFilters : undefined,
    filterConjunction: debouncedFilterConjunction,
    sorts: localSorts.length > 0 ? localSorts : undefined,
  });

  // Build query key for mutations
  const queryKey = useMemo(
    () => ({
      tableId,
      limit: 500,
      searchQuery: debouncedSearchQuery || undefined,
      filterConjunction: debouncedFilterConjunction,
      filters:
        debouncedFilters.length > 0
          ? debouncedFilters
              .filter((f): f is Required<FilterCondition> => !!f.value)
              .map((f) => ({
                columnId: f.columnId,
                operator: f.operator,
                value: f.value,
              }))
          : undefined,
      sorts:
        localSorts.length > 0
          ? localSorts.map((s: SortType) => ({
              columnId: s.columnId,
              type: "text" as const,
              direction: s.direction,
            }))
          : undefined,
    }),
    [
      tableId,
      debouncedSearchQuery,
      debouncedFilterConjunction,
      debouncedFilters,
      localSorts,
    ],
  );

  const { setDataQueryKey } = useTableView();

  useEffect(() => {
    setDataQueryKey(queryKey);
  }, [queryKey, setDataQueryKey]);

  // Cell upsert mutation
  const upsert = api.cell.upsertValue.useMutation({
    onMutate: async (variables) => {
      if (
        variables.rowId.startsWith("temp-") ||
        variables.columnId.startsWith("temp-")
      ) {
        return;
      }

      // Mark cell as pending
      setPendingCellEdit(
        variables.rowId,
        variables.columnId,
        variables.textValue ?? null,
        variables.numberValue ?? null,
      );

      setPendingUpdates((prev) => ({
        ...prev,
        [`${variables.rowId}:${variables.columnId}`]:
          variables.textValue ?? String(variables.numberValue ?? ""),
      }));
    },

    onSuccess: (_data, variables) => {
      // Just clean up pendingUpdates tracking
      setPendingUpdates((prev) => {
        const next = { ...prev };
        delete next[`${variables.rowId}:${variables.columnId}`];
        return next;
      });
    },

    onError: (_err, variables) => {
      // Clean up pendingUpdates tracking
      setPendingUpdates((prev) => {
        const next = { ...prev };
        delete next[`${variables.rowId}:${variables.columnId}`];
        return next;
      });
    },
  });
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);

  // Build table data from windowed cache + optimistic + pending edits
  const tableData = useMemo((): TableRow[] => {
    const rows: TableRow[] = [];

    for (let i = 0; i < totalCount; i++) {
      const row = getRowAtIndex(i);

      if (row) {
        const rowData: TableRow = { __rowId: row.id };

        columns.forEach((col) => {
          // getCellValue already checks pending edits first!
          const cell = getCellValue(row.id, col.id);
          rowData[col.id] = cell?.textValue ?? cell?.numberValue ?? null;
        });

        rows.push(rowData);
      } else {
        // Placeholder for unloaded row
        const placeholderRow: TableRow = { __rowId: `placeholder-${i}` };
        columns.forEach((col) => {
          placeholderRow[col.id] = null;
        });
        rows.push(placeholderRow);
      }
    }

    return rows;
  }, [totalCount, getRowAtIndex, getCellValue, columns]);

  const commitEditSafe = () => {
    void commitEdit();
  };

  const {
    editing,
    localError,
    startEdit,
    cancelEdit,
    commitEdit,
    setDraft,
    updateEditingRowId,
    updateEditingColumnId,
    draftRef,
    editingRef,
  } = useTableEditing({
    data,
    cellByKey,
    upsert,
    pendingEditsRef,
    onCommit: (rowId, columnId, value) => {
      setPendingUpdates((prev) => ({
        ...prev,
        [`${rowId}:${columnId}`]: value,
      }));
    },
    setPendingCellEdit,
    clearPendingCellEdit,
  });

  const flushPendingEdits = useCallback(
    (tempId: string, realId: string, type: "row" | "column" = "row") => {
      if (type === "row") {
        updateEditingRowId(tempId, realId);

        // Replace optimistic row with real ID
        replaceOptimisticRowId(tempId, realId);

        const pendingEdits = pendingEditsRef.current.get(tempId);

        if (pendingEdits && pendingEdits.length > 0) {
          pendingEdits.forEach((edit) => {
            upsert.mutate({
              rowId: realId,
              columnId: edit.columnId,
              textValue: edit.textValue,
              numberValue: edit.numberValue,
            });
          });

          pendingEditsRef.current.delete(tempId);
        }

        setPendingUpdates((prev) => {
          const next: Record<string, string> = {};

          Object.entries(prev).forEach(([key, value]) => {
            if (key.startsWith(`${tempId}:`)) {
              const columnId = key.split(":")[1];
              next[`${realId}:${columnId}`] = value;
            } else {
              next[key] = value;
            }
          });

          return next;
        });
      } else {
        updateEditingColumnId(tempId, realId);

        // Replace optimistic column with real ID
        replaceOptimisticColumnId(tempId, realId);

        const queueKey = `col:${tempId}`;
        const pendingEdits = pendingEditsRef.current.get(queueKey);

        if (pendingEdits && pendingEdits.length > 0) {
          pendingEdits.forEach((edit) => {
            const rowId = edit.rowId;
            if (!rowId) return;

            upsert.mutate({
              rowId,
              columnId: realId,
              textValue: edit.textValue,
              numberValue: edit.numberValue,
            });
          });

          pendingEditsRef.current.delete(queueKey);
        }

        setPendingUpdates((prev) => {
          const next: Record<string, string> = {};

          Object.entries(prev).forEach(([key, value]) => {
            if (key.endsWith(`:${tempId}`)) {
              const rowId = key.split(":")[0];
              next[`${rowId}:${realId}`] = value;
            } else {
              next[key] = value;
            }
          });

          return next;
        });
      }
    },
    [
      upsert,
      updateEditingRowId,
      updateEditingColumnId,
      replaceOptimisticRowId,
      replaceOptimisticColumnId,
    ],
  );

  const flushPendingColumnEdits = useCallback(
    (tempId: string, realId: string) => {
      flushPendingEdits(tempId, realId, "column");
    },
    [flushPendingEdits],
  );

  // Search match tracking - use LOCAL search query for immediate highlighting
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  const matchingCells = useMemo(() => {
    if (!localSearchQuery || columns.length === 0) return [];

    const matches: Array<{
      rowId: string;
      columnId: string;
      rowIndex: number;
      colIndex: number;
    }> = [];

    tableData.forEach((row, rowIndex) => {
      if (row.__rowId.startsWith("placeholder-")) return;

      columns.forEach((col, colIndex) => {
        const value = row[col.id];
        const valueStr = value != null ? String(value) : "";

        if (valueStr.toLowerCase().includes(localSearchQuery.toLowerCase())) {
          matches.push({
            rowId: row.__rowId,
            columnId: col.id,
            rowIndex,
            colIndex: colIndex + 1,
          });
        }
      });
    });

    return matches;
  }, [localSearchQuery, tableData, columns]);

  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [localSearchQuery]);

  const currentMatch = matchingCells[currentMatchIndex] ?? null;

  const goToNextMatch = useCallback(() => {
    if (matchingCells.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % matchingCells.length);
  }, [matchingCells.length]);

  const goToPreviousMatch = useCallback(() => {
    if (matchingCells.length === 0) return;
    setCurrentMatchIndex((prev) =>
      prev === 0 ? matchingCells.length - 1 : prev - 1,
    );
  }, [matchingCells.length]);

  useEffect(() => {
    if (!currentMatch || searchBarOpen) return;

    setSelectedCell({
      rowIndex: currentMatch.rowIndex,
      colIndex: currentMatch.colIndex,
    });
  }, [currentMatch, searchBarOpen]);

  const filteredColumnIds = useMemo(() => {
    return new Set(debouncedFilters.map((f) => f.columnId));
  }, [debouncedFilters]);

  const sortedColumnIds = useMemo(() => {
    return new Set(localSorts.map((s) => s.columnId));
  }, [localSorts]);

  const rowsWithCellData = useMemo(() => {
    const set = new Set<string>();

    for (let i = 0; i < totalCount; i++) {
      if (isRowLoaded(i)) {
        const row = getRowAtIndex(i);
        if (row) {
          set.add(row.id);
        }
      }
    }

    return set;
  }, [totalCount, getRowAtIndex, isRowLoaded]);

  const typedColumns = columns as Array<{
    id: string;
    name: string;
    type: "TEXT" | "NUMBER";
    order: number;
  }>;

  const tableColumns = useMemo(
    () =>
      createColumns({
        data,
        editing,
        draftRef,
        selectedCell,
        setSelectedCell,
        startEdit,
        commitEdit: commitEditSafe,
        cancelEdit,
        onInsert: (
          insert: ColumnInsertPosition,
          position: { top: number; left: number },
        ) => {
          setAddColumnOpen({ insert, position });
        },
        upsert,
        searchQuery: localSearchQuery, // Use local for immediate highlighting
        currentMatch,
        filteredColumnIds,
        sortedColumnIds,
        hiddenColumnIds,
        isBulkLoading,
        rowsWithCellData,
      }),
    [
      data,
      editing,
      selectedCell,
      startEdit,
      cancelEdit,
      upsert,
      localSearchQuery,
      currentMatch,
      filteredColumnIds,
      sortedColumnIds,
      hiddenColumnIds,
      isBulkLoading,
      rowsWithCellData,
    ],
  );

  const table = useReactTable({
    data: tableData,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    state: {
      columnSizing,
    },
    onColumnSizingChange: setColumnSizing,
    defaultColumn: {
      size: 150,
      minSize: 50,
    },
  });

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: totalCount,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 35,
    overscan: 20,
  });

  // Load data as user scrolls
  useEffect(() => {
    const virtualItems = rowVirtualizer.getVirtualItems();
    if (virtualItems.length === 0) return;

    const startIndex = virtualItems[0]?.index ?? 0;
    const endIndex = virtualItems[virtualItems.length - 1]?.index ?? 0;

    void loadRange(startIndex, endIndex + 1);
  }, [rowVirtualizer.getVirtualItems(), loadRange]);

  useKeyboardNavigation({
    table,
    selectedCell,
    setSelectedCell,
    editing,
    editingRef, // ✅ Pass editingRef
    startEdit,
    setDraft,
    commitEdit, // ✅ Pass commitEdit
  });
  const isBusy = isInitialLoading || upsert.isPending;

  useEffect(() => {
    setIsBusy(isBusy);
  }, [isBusy, setIsBusy]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setSearchBarOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setSearchBarOpen]);

  if (isInitialLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-gray-600">Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-red-600">{error.message}</div>
      </div>
    );
  }

  if (!tableInfo) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-gray-600">No data</div>
      </div>
    );
  }

  const columnsForPanels = typedColumns as Array<{
    id: string;
    name: string;
    type: "TEXT" | "NUMBER";
  }>;

  return (
    <div className="flex h-full flex-col">
      <SearchBar
        isOpen={searchBarOpen}
        onClose={() => {
          setSearchBarOpen(false);
          setLocalSearchQuery("");
          setCurrentMatchIndex(0);
        }}
        searchQuery={localSearchQuery}
        onSearchChange={setLocalSearchQuery}
        totalResults={matchingCells.length}
        currentResultIndex={currentMatchIndex}
        onNextResult={goToNextMatch}
        onPreviousResult={goToPreviousMatch}
        searchButtonRef={searchButtonRef}
      />

      {(localError ?? upsert.error) && (
        <div className="flex-shrink-0 border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-600">
          {localError ?? upsert.error?.message}
        </div>
      )}

      <FilterPanel
        isOpen={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        columns={columnsForPanels}
        filters={localFilters}
        onChange={setLocalFilters}
        triggerRef={filterButtonRef ?? undefined}
        conjunctionMode={localFilterConjunction}
        onConjunctionModeChange={setLocalFilterConjunction}
      />

      <SortPanel
        isOpen={sortPanelOpen}
        onClose={() => setSortPanelOpen(false)}
        columns={columnsForPanels}
        sorts={localSorts}
        onChange={setSorts}
        triggerRef={sortButtonRef ?? undefined}
      />

      <div className="min-h-0 flex-1">
        <TableView
          table={table}
          addColumnOpen={addColumnOpen}
          onCloseAddColumn={() => setAddColumnOpen(null)}
          focusedRowIndex={selectedCell?.rowIndex ?? null}
          focusedColumnIndex={selectedCell?.colIndex ?? null}
          rowVirtualizer={rowVirtualizer}
          tableContainerRef={tableContainerRef}
          isFetchingNextPage={isLoadingRange(
            rowVirtualizer.getVirtualItems()[0]?.index ?? 0,
            (rowVirtualizer.getVirtualItems()[
              rowVirtualizer.getVirtualItems().length - 1
            ]?.index ?? 0) + 1,
          )}
          onOpenSearch={() => setSearchBarOpen(true)}
          queryKey={queryKey}
          onFlushPendingEdits={flushPendingEdits}
          onFlushPendingColumnEdits={flushPendingColumnEdits}
          totalCount={totalCount}
          isRowLoaded={isRowLoaded}
          // Pass optimistic functions
          addOptimisticRow={addOptimisticRow}
          insertOptimisticRow={insertOptimisticRow}
          removeOptimisticRow={removeOptimisticRow}
          deleteRowOptimistically={deleteRowOptimistically}
          // Pass column optimistic functions
          addOptimisticColumn={addOptimisticColumn}
          removeOptimisticColumn={removeOptimisticColumn}
          replaceOptimisticColumnId={replaceOptimisticColumnId}
        />
      </div>
      <BottomBar rowCount={totalCount} />
    </div>
  );
}
