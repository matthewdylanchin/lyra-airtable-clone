"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
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

  /* ---------- tRPC Infinite Query with LARGE pages ---------- */
  const utils = api.useUtils();

  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = api.table.getData.useInfiniteQuery(
    { tableId, limit: 5000 }, // 🚀 5000 rows per page (was 1000)
    {
      enabled: !!tableId,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      staleTime: 5 * 60 * 1000, // 🚀 Cache for 5 minutes
      gcTime: 10 * 60 * 1000, // 🚀 Keep in cache for 10 minutes (was cacheTime in v4)
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
      await utils.table.getData.invalidate({ tableId, limit: 5000 });
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
    overscan: 150, // 🚀 Increased from 100 to 150
  });

  /* ---------- CLEANUP TIMEOUTS ---------- */
  const timeoutIds = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    return () => {
      // Cleanup all timeouts on unmount
      timeoutIds.current.forEach((id) => clearTimeout(id));
      timeoutIds.current = [];
    };
  }, []);

  /* ---------- JUMP DETECTION & SMART LOADING (FIXED) ---------- */
  const lastScrollTop = useRef(0);
  const isLoadingJump = useRef(false);

  const handleJumpFetch = useCallback(
    async (pagesToFetch: number) => {
      isLoadingJump.current = true;

      try {
        // Fetch pages sequentially (no setTimeout needed!)
        for (let i = 0; i < pagesToFetch; i++) {
          if (hasNextPage && !isFetchingNextPage) {
            await fetchNextPage();
          }
        }
      } catch (error) {
        console.error("Error in jump fetch:", error);
      } finally {
        isLoadingJump.current = false;
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const currentScrollTop = container.scrollTop;
      const scrollDiff = Math.abs(currentScrollTop - lastScrollTop.current);

      // Detect scrollbar jumps (>3000px for 5000-row pages)
      if (scrollDiff > 3000 && !isLoadingJump.current) {
        const virtualItems = rowVirtualizer.getVirtualItems();
        if (!virtualItems.length) return;

        const firstVisible = virtualItems[0]?.index ?? 0;
        const loadedRowCount = data?.rows.length ?? 0;

        console.log("🎯 JUMP DETECTED!", {
          scrollDiff,
          firstVisible,
          loadedRowCount,
        });

        // If jumped beyond loaded data
        if (firstVisible >= loadedRowCount - 500) {
          const rowsNeeded = firstVisible - loadedRowCount;
          const pagesNeeded = Math.ceil(rowsNeeded / 5000);
          const pagesToFetch = Math.min(pagesNeeded + 1, 5); // Max 5 pages at once

          console.log(`🔄 Fetching ${pagesToFetch} pages for jump...`);
          void handleJumpFetch(pagesToFetch);
        }
      }

      lastScrollTop.current = currentScrollTop;
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [data?.rows.length, rowVirtualizer, handleJumpFetch]);

  /* ---------- AGGRESSIVE PREFETCHING (for normal scrolling) ---------- */
  const isFetchingMultiple = useRef(false);

  const handleEmergencyFetch = useCallback(async () => {
    isFetchingMultiple.current = true;

    try {
      // Fetch 2 pages sequentially
      await fetchNextPage();
      await fetchNextPage();
    } catch (error) {
      console.error("Error in emergency fetch:", error);
    } finally {
      isFetchingMultiple.current = false;
    }
  }, [fetchNextPage]);

  useEffect(() => {
    if (isFetchingMultiple.current || isLoadingJump.current) return;

    const virtualItems = rowVirtualizer.getVirtualItems();
    if (!virtualItems.length) return;

    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;

    const loadedRowCount = data?.rows.length ?? 0;
    const remainingBuffer = loadedRowCount - lastItem.index;

    // 🚀 Trigger when 2000 rows remain (40% of 5000-row page)
    if (remainingBuffer < 2000 && hasNextPage && !isFetchingNextPage) {
      console.log("🔄 Normal prefetch", {
        lastVisible: lastItem.index,
        loaded: loadedRowCount,
        remaining: remainingBuffer,
      });

      // 🚀 Emergency: fetch 2 pages when <500 rows remain
      if (remainingBuffer < 500) {
        console.log("🔥 EMERGENCY: Fetching multiple pages!");
        void handleEmergencyFetch();
      } else {
        void fetchNextPage();
      }
    }
  }, [
    rowVirtualizer.getVirtualItems(),
    data?.rows.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    handleEmergencyFetch,
  ]);

  /* ---------- Preload on mount ---------- */
  useEffect(() => {
    // Preload 2 pages (10,000 rows) on mount
    if (
      data &&
      data.rows.length < 10000 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
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
          isFetchingNextPage={
            isFetchingNextPage ||
            isFetchingMultiple.current ||
            isLoadingJump.current
          }
        />
      </div>
    </div>
  );
}
