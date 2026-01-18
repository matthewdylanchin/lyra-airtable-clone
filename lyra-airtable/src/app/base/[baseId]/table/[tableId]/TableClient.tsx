"use client";

import { useMemo, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
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
  // ✅ Store pending updates - NEVER remove them, let them be overwritten by fresh data
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, string>>(
    {},
  );

  const commitEditSafe = () => {
    void commitEdit();
  };

  /* ---------- tRPC ---------- */
  const utils = api.useUtils();

  const q = api.table.getData.useQuery(
    { tableId, limit: 50 },
    { enabled: !!tableId },
  );

  const upsert = api.cell.upsertValue.useMutation({
    onSuccess: async (data, variables) => {
      console.log("✅ [onSuccess] Refetching fresh data from server");

      // Refetch to get the latest data and WAIT for it
      await utils.table.getData.refetch({ tableId, limit: 50 });

      console.log("✅ [onSuccess] Refetch complete, removing pending update");

      // NOW remove the pending update - the fresh data is guaranteed to be here
      setPendingUpdates((prev) => {
        const next = { ...prev };
        delete next[`${variables.rowId}:${variables.columnId}`];
        console.log("🧹 Cleaned up pending update", {
          rowId: variables.rowId,
          columnId: variables.columnId,
        });
        return next;
      });
    },

    onError: (err, variables) => {
      console.log("🔴 [onError]", err);
      // Remove pending update on error
      setPendingUpdates((prev) => {
        const next = { ...prev };
        delete next[`${variables.rowId}:${variables.columnId}`];
        return next;
      });
    },
  });

  const data = q.data;

  /* ---------- Selection ---------- */
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);

  /* ---------- Data shaping ---------- */
  const { cellByKey, tableData } = useTableData(data);

  /* ---------- Apply pending updates to tableData ---------- */
  // ✅ Merge pending updates into the data (INSTANT display)
  const tableDataWithPending = useMemo(() => {
    console.log("🔄 [tableDataWithPending] Recomputing", {
      pendingCount: Object.keys(pendingUpdates).length,
      pendingUpdates,
    });

    if (Object.keys(pendingUpdates).length === 0) return tableData;

    return tableData.map((row) => {
      const rowId = row.__rowId;
      const updatedRow = { ...row };

      // Apply any pending updates for this row
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
    // ✅ Pass function to add pending updates
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
      commitEdit,
      cancelEdit,
      setDraft,
      upsert,
    ],
  );

  /* ---------- Table ---------- */
  const table = useReactTable({
    data: tableDataWithPending, // ✅ Use data with pending updates
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
  if (q.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-gray-600">Loading…</div>
      </div>
    );
  }

  if (q.error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-red-600">{q.error.message}</div>
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
        />
      </div>
    </div>
  );
}
