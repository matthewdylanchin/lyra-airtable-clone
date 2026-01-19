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
    { tableId, limit: 50 },
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
      nextCursor: undefined, // Not used in client, only for pagination
    };
  }, [infiniteData]);

  const upsert = api.cell.upsertValue.useMutation({
    onSuccess: async (data, variables) => {
      console.log("✅ [onSuccess] Refetching fresh data from server");

      // Invalidate and refetch
      await utils.table.getData.invalidate({ tableId, limit: 50 });

      console.log("✅ [onSuccess] Refetch complete, removing pending update");

      setPendingUpdates((prev) => {
        const next = { ...prev };
        delete next[`${variables.rowId}:${variables.columnId}`];
        return next;
      });
    },

    onError: (err, variables) => {
      console.log("🔴 [onError]", err);
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
    console.log("🔄 [tableDataWithPending] Recomputing", {
      pendingCount: Object.keys(pendingUpdates).length,
      pendingUpdates,
    });

    if (Object.keys(pendingUpdates).length === 0) return tableData;

    return tableData.map((row) => {
      const rowId = row.__rowId;
      const updatedRow = { ...row };

      Object.entries(pendingUpdates).forEach(([key, value]) => {
        const parts = key.split(":");
        const updateRowId = parts[0];
        const columnId = parts[1];

        if (updateRowId === rowId && columnId) {
          console.log("✅ Applying pending update", { rowId, columnId, value });
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
      console.log("⚡ [INSTANT] Adding pending update", {
        rowId,
        columnId,
        value,
      });
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
    estimateSize: () => 35, // Row height in pixels
    overscan: 20, // Render extra rows above/below viewport
  });

  // Track if we're currently fetching to prevent scroll jumps
  const isFetchingRef = useRef(false);

  useEffect(() => {
    isFetchingRef.current = isFetchingNextPage;
  }, [isFetchingNextPage]);

  // Infinite scroll trigger with improved logic
  useEffect(() => {
    const virtualItems = rowVirtualizer.getVirtualItems();
    if (!virtualItems.length) return;

    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;

    const loadedRowCount = data?.rows.length ?? 0;

    // Only trigger if:
    // 1. We're near the end of loaded rows (within 10 rows)
    // 2. There's more data to fetch
    // 3. We're not already fetching
    if (
      lastItem.index >= loadedRowCount - 10 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      console.log("🔄 Fetching next page...", {
        lastVisibleIndex: lastItem.index,
        loadedRowCount,
        totalCount: data?.totalCount,
      });
      void fetchNextPage();
    }
  }, [
    rowVirtualizer.getVirtualItems(),
    data?.rows.length,
    data?.totalCount,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

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
          isFetchingNextPage={isFetchingNextPage}
        />
      </div>
    </div>
  );
}
