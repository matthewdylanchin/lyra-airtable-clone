"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";

import { api } from "@/trpc/react";

import { useTableData } from "./hooks/useTableData";
import { useTableEditing } from "./hooks/useTableEditing";
import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation";
import { createColumns } from "./columns";
import { TableView } from "./TableView";
import type { SelectedCell, ColumnInsertPosition } from "./types";

export default function TableClient() {
  /* ---------- Routing ---------- */
  const params = useParams<{ tableId: string }>();
  const tableId = params.tableId;

  const [addColumnOpen, setAddColumnOpen] =
    useState<ColumnInsertPosition | null>(null);

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
        onInsert: setAddColumnOpen,
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
      setAddColumnOpen,
    ],
  );

  /* ---------- Table ---------- */
  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
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
  if (q.isLoading) return <div className="p-6">Loading…</div>;
  if (q.error)
    return <div className="p-6 text-sm text-red-600">{q.error.message}</div>;
  if (!data) return <div className="p-6">No data</div>;

  /* ---------- Render ---------- */
  return (
    <div className="p-6">
      <div className="text-lg font-semibold">{data.table.name}</div>

      {/* ❌ REMOVED - only render in TableView */}

      {(localError ?? upsert.error) && (
        <div className="mt-2 text-sm text-red-600">
          {localError ?? upsert.error?.message}
        </div>
      )}

      <div className="mt-4 overflow-auto rounded-md border border-zinc-200">
        <TableView
          table={table}
          addColumnOpen={addColumnOpen}
          onCloseAddColumn={() => setAddColumnOpen(null)}
        />
      </div>
    </div>
  );
}
