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
    searchQuery,
    setSearchQuery,
    searchButtonRef,
    filterPanelOpen,
    setFilterPanelOpen,
    filterButtonRef,
    filters,
    setFilters,
    filterConjunction,
    setFilterConjunction,
    sortPanelOpen,
    setSortPanelOpen,
    sortButtonRef,
    sorts,
    setSorts,
    setIsBusy,
    isBulkLoading,
    setIsBulkLoading,
    optimisticRowCount,
    setOptimisticRowCount,
  } = useTableView();

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

  const utils = api.useUtils();

  // Use windowed data hook
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
  } = useWindowedData({
    tableId,
    windowSize: 1000,
    overscan: 200,
    searchQuery: searchQuery || undefined,
    filters: filters.length > 0 ? filters : undefined,
    filterConjunction,
    sorts: sorts.length > 0 ? sorts : undefined,
  });

  // Build query key for mutations
  const queryKey = useMemo(
    () => ({
      tableId,
      limit: 100,
      searchQuery: searchQuery || undefined,
      filterConjunction,
      filters:
        filters.length > 0
          ? filters
              .filter((f): f is Required<FilterCondition> => !!f.value)
              .map((f) => ({
                columnId: f.columnId,
                operator: f.operator,
                value: f.value,
              }))
          : undefined,
      sorts:
        sorts.length > 0
          ? sorts.map((s: SortType) => ({
              columnId: s.columnId,
              type: "text" as const,
              direction: s.direction,
            }))
          : undefined,
    }),
    [tableId, searchQuery, filterConjunction, filters, sorts],
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

      setPendingUpdates((prev) => ({
        ...prev,
        [`${variables.rowId}:${variables.columnId}`]:
          variables.textValue ?? String(variables.numberValue ?? ""),
      }));
    },

    onSuccess: (_data, variables) => {
      setPendingUpdates((prev) => {
        const next = { ...prev };
        delete next[`${variables.rowId}:${variables.columnId}`];
        return next;
      });
    },

    onError: (_err, variables) => {
      setPendingUpdates((prev) => {
        const next = { ...prev };
        delete next[`${variables.rowId}:${variables.columnId}`];
        return next;
      });
    },
  });

  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);

  // Build table data from windowed cache
  const tableData = useMemo((): TableRow[] => {
    const rows: TableRow[] = [];
    const rowCount = optimisticRowCount ?? totalCount;

    for (let i = 0; i < rowCount; i++) {
      const row = getRowAtIndex(i);

      if (row) {
        const rowData: TableRow = { __rowId: row.id };

        columns.forEach((col) => {
          const cell = getCellValue(row.id, col.id);
          const pendingKey = `${row.id}:${col.id}`;

          if (pendingUpdates[pendingKey] !== undefined) {
            rowData[col.id] = pendingUpdates[pendingKey];
          } else if (cell) {
            rowData[col.id] = cell.textValue ?? cell.numberValue ?? null;
          } else {
            rowData[col.id] = null;
          }
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
  }, [
    totalCount,
    optimisticRowCount,
    getRowAtIndex,
    getCellValue,
    columns,
    pendingUpdates,
  ]);

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
  });

  const flushPendingEdits = useCallback(
    (tempId: string, realId: string, type: "row" | "column" = "row") => {
      if (type === "row") {
        updateEditingRowId(tempId, realId);

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
    [upsert, updateEditingRowId, updateEditingColumnId],
  );

  const flushPendingColumnEdits = useCallback(
    (tempId: string, realId: string) => {
      flushPendingEdits(tempId, realId, "column");
    },
    [flushPendingEdits],
  );

  // Search match tracking
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  const matchingCells = useMemo(() => {
    if (!searchQuery || columns.length === 0) return [];

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

        if (valueStr.toLowerCase().includes(searchQuery.toLowerCase())) {
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
  }, [searchQuery, tableData, columns]);

  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchQuery]);

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
    return new Set(filters.map((f) => f.columnId));
  }, [filters]);

  const sortedColumnIds = useMemo(() => {
    return new Set(sorts.map((s) => s.columnId));
  }, [sorts]);

  // Rows with cell data for skeleton detection
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

  // Cast columns to the expected type for createColumns
  const typedColumns = columns as Array<{
    id: string;
    name: string;
    type: "TEXT" | "NUMBER";
    order: number;
  }>;

  // Create columns definition
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
        searchQuery,
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
      searchQuery,
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

  // Virtualizer uses TOTAL count for proper scrollbar
  const rowVirtualizer = useVirtualizer({
    count: optimisticRowCount ?? totalCount,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 35,
    overscan: 20,
  });

  // Load data as user scrolls - THIS IS THE INFINITE SCROLL PART
  useEffect(() => {
    const virtualItems = rowVirtualizer.getVirtualItems();
    if (virtualItems.length === 0) return;

    const startIndex = virtualItems[0]?.index ?? 0;
    const endIndex = virtualItems[virtualItems.length - 1]?.index ?? 0;

    // Load the visible range plus overscan
    void loadRange(startIndex, endIndex + 1);
  }, [rowVirtualizer.getVirtualItems(), loadRange]);

  useKeyboardNavigation({
    table,
    selectedCell,
    setSelectedCell,
    editing,
    startEdit,
    setDraft,
  });

  const isBusy = isInitialLoading || upsert.isPending;

  useEffect(() => {
    setIsBusy(isBusy);
  }, [isBusy, setIsBusy]);

  // Clear optimistic row count when data loads
  useEffect(() => {
    if (!optimisticRowCount) return;

    if (totalCount >= optimisticRowCount) {
      setOptimisticRowCount(null);
    }
  }, [totalCount, optimisticRowCount, setOptimisticRowCount]);

  // Keyboard shortcut for search
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

  // Cast columns for FilterPanel and SortPanel
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
          setSearchQuery("");
          setCurrentMatchIndex(0);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
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
        filters={filters}
        onChange={setFilters}
        triggerRef={filterButtonRef ?? undefined}
        conjunctionMode={filterConjunction}
        onConjunctionModeChange={setFilterConjunction}
      />

      <SortPanel
        isOpen={sortPanelOpen}
        onClose={() => setSortPanelOpen(false)}
        columns={columnsForPanels}
        sorts={sorts}
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
        />
      </div>
      <BottomBar rowCount={optimisticRowCount ?? totalCount} />
    </div>
  );
}
