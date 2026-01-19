"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ColumnSizingState } from "@tanstack/react-table";
import { api } from "@/trpc/react";

import { useTableData } from "./hooks/useTableData";
import { useTableEditing } from "./hooks/useTableEditing";
import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation";
import { createColumns } from "./columns";
import { TableView } from "./TableView";
import type {
  SelectedCell,
  ColumnInsertPosition,
  AddColumnState,
} from "./types";

export default function TableClient() {
  /* ---------- Routing ---------- */
  const params = useParams<{ tableId: string }>();
  const tableId = params.tableId;

  /* ---------- Column Sizing State with localStorage ---------- */
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

  /* ---------- INSTANT OPTIMISTIC UPDATES ---------- */
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, string>>(
    {},
  );

  /* ---------- tRPC Infinite Query ---------- */
  const utils = api.useUtils();

  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = api.table.getData.useInfiniteQuery(
    { tableId, limit: 200 },
    {
      enabled: !!tableId,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  // Combine all pages into single data structure
  const data = useMemo(() => {
    if (!infiniteData?.pages) return undefined;

    const firstPage = infiniteData.pages[0];
    if (!firstPage) return undefined;

    const combinedRows = infiniteData.pages.flatMap((page) => page.rows);
    const combinedCells = infiniteData.pages.flatMap((page) => page.cells);

    return {
      table: firstPage.table,
      columns: firstPage.columns,
      rows: combinedRows,
      cells: combinedCells,
      totalCount: firstPage.totalCount,
      nextCursor: undefined,
    };
  }, [infiniteData]);

  const upsert = api.cell.upsertValue.useMutation({
    onSuccess: async (data, variables) => {
      await utils.table.getData.invalidate({ tableId, limit: 200 });
      setPendingUpdates((prev) => {
        const next = { ...prev };
        delete next[`${variables.rowId}:${variables.columnId}`];
        return next;
      });
    },

    onError: (err, variables) => {
      setPendingUpdates((prev) => {
        const next = { ...prev };
        delete next[`${variables.rowId}:${variables.columnId}`];
        return next;
      });
    },
  });

  /* ---------- Selection ---------- */
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);

  /* ---------- Data shaping ---------- */
  const { cellByKey, tableData } = useTableData(data);

  /* ---------- Apply pending updates to tableData ---------- */
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

  /* ---------- Editing ---------- */
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
  } = useTableEditing({
    data,
    cellByKey,
    upsert,
    onCommit: (rowId, columnId, value) => {
      setPendingUpdates((prev) => ({
        ...prev,
        [`${rowId}:${columnId}`]: value,
      }));
    },
  });

  /* ---------- Columns ---------- */
  const columns = useMemo(
    () =>
      createColumns({
        data,
        editing,
        draft,
        selectedCell,
        setSelectedCell,
        startEdit,
        commitEdit: commitEditSafe,
        cancelEdit,
        setDraft,
        onInsert: (
          insert: ColumnInsertPosition,
          position: { top: number; left: number },
        ) => {
          setAddColumnOpen({ insert, position });
        },
        upsert,
      }),
    [
      data,
      editing,
      draft,
      selectedCell,
      startEdit,
      cancelEdit,
      setDraft,
      upsert,
    ],
  );

  /* ---------- Table ---------- */
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

  /* ---------- Virtualization ---------- */
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: data?.totalCount ?? 0,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 35,
    overscan: 100, // 🚀 MASSIVE overscan - render 100 rows outside viewport
  });

  /* ---------- ULTRA AGGRESSIVE PREFETCHING ---------- */
  const isFetchingMultiple = useRef(false);
  const lastFetchTime = useRef(Date.now());

  useEffect(() => {
    // Don't run if already fetching multiple pages
    if (isFetchingMultiple.current) return;

    const virtualItems = rowVirtualizer.getVirtualItems();
    if (!virtualItems.length) return;

    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;

    const loadedRowCount = data?.rows.length ?? 0;
    const remainingBuffer = loadedRowCount - lastItem.index;

    // 🚀 SUPER AGGRESSIVE: Trigger when 150 rows remain (was 100)
    if (remainingBuffer < 150 && hasNextPage && !isFetchingNextPage) {
      const now = Date.now();
      const timeSinceLastFetch = now - lastFetchTime.current;

      console.log("🚀 AGGRESSIVE PREFETCH:", {
        lastVisibleIndex: lastItem.index,
        loadedRowCount,
        remainingBuffer,
        timeSinceLastFetch,
      });

      // If we're close to running out, fetch MULTIPLE pages at once
      if (remainingBuffer < 50) {
        console.log("🔥 EMERGENCY: Loading multiple pages!");
        isFetchingMultiple.current = true;

        const fetchMultiple = async () => {
          // Fetch 3 pages in parallel (600 rows)
          try {
            await Promise.all([
              fetchNextPage(),
              new Promise((resolve) => setTimeout(resolve, 100)).then(() =>
                fetchNextPage(),
              ),
              new Promise((resolve) => setTimeout(resolve, 200)).then(() =>
                fetchNextPage(),
              ),
            ]);
          } catch (error) {
            console.error("Error fetching multiple pages:", error);
          } finally {
            isFetchingMultiple.current = false;
            lastFetchTime.current = Date.now();
          }
        };

        void fetchMultiple();
      } else {
        // Normal single page fetch
        lastFetchTime.current = now;
        void fetchNextPage();
      }
    }
  }, [
    rowVirtualizer.getVirtualItems(),
    data?.rows.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  /* ---------- Preload on mount ---------- */
  useEffect(() => {
    // Preload 2 extra pages immediately on mount for better initial experience
    if (data && data.rows.length < 600 && hasNextPage && !isFetchingNextPage) {
      console.log("🎯 Preloading initial pages...");
      void fetchNextPage();
    }
  }, [data?.rows.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  /* ---------- Keyboard ---------- */
  useKeyboardNavigation({
    table,
    selectedCell,
    setSelectedCell,
    editing,
    startEdit,
    setDraft,
  });

  /* ---------- Loading / error ---------- */
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

  /* ---------- Render ---------- */
  return (
    <div className="flex h-full flex-col">
      {(localError ?? upsert.error) && (
        <div className="flex-shrink-0 border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-600">
          {localError ?? upsert.error?.message}
        </div>
      )}

      <div className="min-h-0 flex-1">
        <TableView
          table={table}
          addColumnOpen={addColumnOpen}
          onCloseAddColumn={() => setAddColumnOpen(null)}
          focusedRowIndex={selectedCell?.rowIndex ?? null}
          focusedColumnIndex={selectedCell?.colIndex ?? null}
          rowVirtualizer={rowVirtualizer}
          tableContainerRef={tableContainerRef}
          isFetchingNextPage={isFetchingNextPage || isFetchingMultiple.current}
        />
      </div>
    </div>
  );
}
