"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ColumnSizingState } from "@tanstack/react-table";
import { api } from "@/trpc/react";
import SortPanel from "./Components/SortPanel";
import { useTableData } from "./hooks/useTableData";
import {
  useTableEditing,
  type PendingEditsMap,
  type PendingEdit,
} from "./hooks/useTableEditing";
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
} from "./types";
import FilterPanel from "./Components/FilterPanel";
import BottomBar from "@/app/_components/shell/BottomBar";
import type { SortType } from "./types";

function getRowsWithCellData(data: TableDataType | undefined): Set<string> {
  if (!data) return new Set();

  const rowsWithData = new Set<string>();

  // A row has data if it has at least one cell
  data.cells.forEach((cell) => {
    rowsWithData.add(cell.rowId);
  });

  return rowsWithData;
}

type ColumnType = {
  id: string;
  name: string;
  type: "TEXT" | "NUMBER";
  order: number;
};

type TableDataType = {
  table: { id: string; name: string; baseId: string };
  columns: ColumnType[];
  rows: Array<{ id: string; rowIndex: number }>;
  cells: Array<{
    id: string;
    rowId: string;
    columnId: string;
    textValue: string | null;
    numberValue: number | null;
    updatedAt: Date;
  }>;
  totalCount: number;
  nextCursor: number | undefined;
};

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

  // ✅ NEW: Ref to store pending edits for temp rows
  const pendingEditsRef = useRef<PendingEditsMap>(new Map());

  const utils = api.useUtils();

  const queryKey = useMemo(
    () => ({
      tableId,
      limit: 5000,
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

  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
    isLoading,
    error,
    refetch,
  } = api.table.getData.useInfiniteQuery(queryKey, {
    enabled: !!tableId,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: isBulkLoading ? 0 : 5 * 60 * 1000, // ✅ Force refetch during bulk load
    gcTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    refetchInterval: isBulkLoading ? 2000 : false, // ✅ Auto-refetch every 2s during bulk load
  });

  const data = useMemo((): TableDataType | undefined => {
    if (!infiniteData?.pages) return undefined;

    const firstPage = infiniteData.pages[0];
    if (!firstPage) return undefined;

    const combinedRows = infiniteData.pages.flatMap((page) => page.rows);
    const combinedCells = infiniteData.pages.flatMap((page) => page.cells);

    return {
      table: firstPage.table,
      columns: firstPage.columns as ColumnType[],
      rows: combinedRows,
      cells: combinedCells,
      totalCount: firstPage.totalCount,
      nextCursor: undefined,
    };
  }, [infiniteData]);

  const upsert = api.cell.upsertValue.useMutation({
    onMutate: async (variables) => {
      // ✅ UPDATED: Skip backend for temp IDs (let the queue handle it)
      if (
        variables.rowId.startsWith("temp-") ||
        variables.columnId.startsWith("temp-")
      ) {
        return; // Don't do anything for temp rows
      }

      await utils.table.getData.cancel(queryKey);

      const previousData = utils.table.getData.getInfiniteData(queryKey);

      utils.table.getData.setInfiniteData(queryKey, (old) => {
        if (!old) return old;

        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            cells: page.cells.map((cell) => {
              if (
                cell.rowId === variables.rowId &&
                cell.columnId === variables.columnId
              ) {
                return {
                  ...cell,
                  textValue: variables.textValue,
                  numberValue: variables.numberValue,
                };
              }
              return cell;
            }),
          })),
        };
      });

      return { previousData };
    },

    onSuccess: (_data, variables) => {
      setPendingUpdates((prev) => {
        const next = { ...prev };
        delete next[`${variables.rowId}:${variables.columnId}`];
        return next;
      });
    },

    onError: (_err, variables, context) => {
      if (context?.previousData) {
        utils.table.getData.setInfiniteData(queryKey, context.previousData);
      }

      setPendingUpdates((prev) => {
        const next = { ...prev };
        delete next[`${variables.rowId}:${variables.columnId}`];
        return next;
      });
    },
  });

  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);
  const { cellByKey, tableData } = useTableData(data);

  const tableDataWithPending = useMemo(() => {
    if (Object.keys(pendingUpdates).length === 0) return tableData;

    return tableData.map((row) => {
      const rowId = row.__rowId;
      const updatedRow = { ...row };

      Object.entries(pendingUpdates).forEach(([key, value]) => {
        const parts = key.split(":");
        const updateRowId = parts[0];
        const columnId = parts[1];

        if (updateRowId === rowId && columnId) {
          updatedRow[columnId] = value;
        }
      });

      return updatedRow;
    });
  }, [tableData, pendingUpdates]);

  const commitEditSafe = () => {
    void commitEdit();
  };

  const {
    editing,
    draft,
    localError,
    startEdit,
    cancelEdit,
    commitEdit,
    setDraft,
    updateEditingRowId,
    updateEditingColumnId,
    editingRef,
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

  // ✅ NEW: Function to flush pending edits when temp ID is replaced with real ID
  const flushPendingEdits = useCallback(
    (tempId: string, realId: string, type: "row" | "column" = "row") => {
      if (type === "row") {
        // Existing row logic
        updateEditingRowId(tempId, realId);

        const pendingEdits = pendingEditsRef.current.get(tempId);

        if (pendingEdits && pendingEdits.length > 0) {
          console.log(
            `🚀 [flushPendingEdits] Flushing ${pendingEdits.length} row edits for ${tempId} → ${realId}`,
          );

          pendingEdits.forEach((edit) => {
            console.log(`  📤 Sending edit:`, {
              realId,
              columnId: edit.columnId,
            });

            upsert.mutate({
              rowId: realId,
              columnId: edit.columnId,
              textValue: edit.textValue,
              numberValue: edit.numberValue,
            });
          });

          pendingEditsRef.current.delete(tempId);
        }

        // Update pendingUpdates keys from temp to real
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
        // ✅ Column logic
        updateEditingColumnId(tempId, realId);

        const queueKey = `col:${tempId}`;
        const pendingEdits = pendingEditsRef.current.get(queueKey);

        if (pendingEdits && pendingEdits.length > 0) {
          console.log(
            `🚀 [flushPendingEdits] Flushing ${pendingEdits.length} column edits for ${tempId} → ${realId}`,
          );

          pendingEdits.forEach((edit) => {
            const rowId = edit.rowId;
            if (!rowId) return;

            console.log(`  📤 Sending edit:`, {
              rowId,
              columnId: realId,
            });

            upsert.mutate({
              rowId,
              columnId: realId,
              textValue: edit.textValue,
              numberValue: edit.numberValue,
            });
          });

          pendingEditsRef.current.delete(queueKey);
        }

        // Update pendingUpdates keys from temp column to real
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

  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  const matchingCells = useMemo(() => {
    if (!searchQuery || !data) return [];

    const matches: Array<{
      rowId: string;
      columnId: string;
      rowIndex: number;
      colIndex: number;
    }> = [];

    data.rows.forEach((row, rowIndex) => {
      data.columns.forEach((col, colIndex) => {
        const cellKey = `${row.id}:${col.id}`;
        const cell = cellByKey.get(cellKey);
        const value = cell?.textValue ?? "";

        if (value?.toLowerCase().includes(searchQuery.toLowerCase())) {
          matches.push({
            rowId: row.id,
            columnId: col.id,
            rowIndex,
            colIndex: colIndex + 1,
          });
        }
      });
    });

    return matches;
  }, [searchQuery, data, cellByKey]);

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

  const rowsWithCellData = useMemo(() => {
    return getRowsWithCellData(data);
  }, [data]);

  const columns = useMemo(
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
        isBulkLoading, // ✅ ADD THIS
        rowsWithCellData, // ✅ ADD THIS
      }),
    [
      data,
      editing,
      selectedCell,
      startEdit,
      cancelEdit,
      setDraft,
      upsert,
      searchQuery,
      currentMatch,
      filteredColumnIds,
      sortedColumnIds,
      hiddenColumnIds,
      isBulkLoading, // ✅ ADD THIS
      rowsWithCellData, // ✅ ADD THIS
    ],
  );

  const table = useReactTable({
    data: tableDataWithPending,
    columns,
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

  // ✅ UPDATED: Use totalCount during bulk loading (to show skeletons), otherwise use actual rows length
  const totalRows = data?.totalCount ?? data?.rows.length ?? 0;

  const rowVirtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 35,
    overscan: 150,
  });

  const timeoutIds = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    return () => {
      timeoutIds.current.forEach((id) => clearTimeout(id));
      timeoutIds.current = [];
    };
  }, []);

  useKeyboardNavigation({
    table,
    selectedCell,
    setSelectedCell,
    editing,
    startEdit,
    setDraft,
  });

  const isBusy =
    isLoading || isFetchingNextPage || upsert.isPending || isFetching;

  useEffect(() => {
    setIsBusy(isBusy);
  }, [isBusy, setIsBusy]);

  useEffect(() => {
    const items = rowVirtualizer.getVirtualItems();
    if (!items.length || !data) return;

    const lastItem = items[items.length - 1];
    if (!lastItem) return;

    const loaded = data.rows.length;

    if (lastItem.index >= loaded - 50 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [
    rowVirtualizer.getVirtualItems(),
    data?.rows.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  useEffect(() => {
    if (!optimisticRowCount || !data) return;

    if (data.rows.length >= optimisticRowCount) {
      setOptimisticRowCount(null);
    }
  }, [data?.rows.length, optimisticRowCount]);

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

  if (isLoading) {
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

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-gray-600">No data</div>
      </div>
    );
  }

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
        columns={data?.columns ?? []}
        filters={filters}
        onChange={setFilters}
        triggerRef={filterButtonRef ?? undefined}
        conjunctionMode={filterConjunction}
        onConjunctionModeChange={setFilterConjunction}
      />

      <SortPanel
        isOpen={sortPanelOpen}
        onClose={() => setSortPanelOpen(false)}
        columns={data?.columns ?? []}
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
          isFetchingNextPage={isFetchingNextPage}
          onOpenSearch={() => setSearchBarOpen(true)}
          queryKey={queryKey}
          onFlushPendingEdits={flushPendingEdits}
          onFlushPendingColumnEdits={flushPendingColumnEdits}
        />
      </div>
      <BottomBar rowCount={optimisticRowCount ?? data.totalCount} />
    </div>
  );
}
