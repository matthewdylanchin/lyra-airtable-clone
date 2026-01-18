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
  // ✅ Calculate initial column widths from data or localStorage
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
    // Only access localStorage on the client
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
    // If no saved sizes, calculate initial sizes based on column definitions
    // This will be overridden by the columns' default sizes, but we return empty
    // so that TanStack Table uses the column.size from column definitions
    return {};
  });

  // ✅ Save to localStorage whenever column sizes change
  useEffect(() => {
    if (typeof window === "undefined") return;

    localStorage.setItem(
      `table-column-sizing-${tableId}`,
      JSON.stringify(columnSizing),
    );
  }, [columnSizing, tableId]);

  // ✅ Use position coordinates instead of ref
  const [addColumnOpen, setAddColumnOpen] = useState<AddColumnState>(null);

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
    onSuccess: async () => {
      await utils.table.getData.invalidate({ tableId, limit: 50 });
    },
  });

  const data = q.data;

  /* ---------- Selection ---------- */
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);

  /* ---------- Data shaping ---------- */
  const { cellByKey, tableData } = useTableData(data);

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
    ],
  );

  /* ---------- Table ---------- */
  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),

    // ✅ Column resizing configuration
    enableColumnResizing: true,
    columnResizeMode: "onEnd", // Changed from "onChange" for better independent column resizing

    state: {
      columnSizing,
    },

    onColumnSizingChange: setColumnSizing,

    // ✅ Default column sizes
    defaultColumn: {
      size: 150,
      minSize: 50,
      maxSize: 500,
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
      {/* Error banner - only shows if there's an error */}
      {(localError ?? upsert.error) && (
        <div className="flex-shrink-0 border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-600">
          {localError ?? upsert.error?.message}
        </div>
      )}

      {/* Table - fills remaining space */}
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
