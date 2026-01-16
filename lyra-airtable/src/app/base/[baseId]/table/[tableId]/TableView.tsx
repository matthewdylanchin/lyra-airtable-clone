"use client";

import { flexRender } from "@tanstack/react-table";
import type { Table } from "@tanstack/react-table";
import type { TableRow, AddColumnState } from "./types";
import AddColumnButton from "./Components/AddColumnButton";
import { useParams } from "next/navigation";
import type { ColumnInsertPosition } from "./types";
import { api } from "@/trpc/react"; // ✅ add this

export function TableView({
  table,
  addColumnOpen,
  onCloseAddColumn,
}: {
  table: Table<TableRow>;
  addColumnOpen: AddColumnState;
  onCloseAddColumn: () => void;
}) {
  const { tableId } = useParams<{ tableId: string }>();

  const utils = api.useUtils();
  const addRow = api.row.add.useMutation({
    onSuccess: () => {
      void utils.table.getData.invalidate({ tableId, limit: 50 });
    },
  });

  const visibleCols = table.getVisibleLeafColumns().length;

  return (
    <>
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-zinc-50">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className="border-b px-2 py-2 text-left font-medium whitespace-nowrap"
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                </th>
              ))}

              {/* ADD COLUMN BUTTON */}
              <th className="border-b px-2 py-2 text-left font-medium">
                <AddColumnButton tableId={tableId} />
              </th>
            </tr>
          ))}
        </thead>

        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-1">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}

          {/* Add row bar */}
          <tr>
            <td
              colSpan={visibleCols + 1} // existing cols + the extra header col
              className="px-2 py-2 text-left"
            >
              <button
                type="button"
                onClick={() => {
                  void addRow.mutate({ tableId });
                }}
                disabled={addRow.isPending}
                className="inline-flex items-center gap-2 rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="text-base leading-none">＋</span>
                <span>{addRow.isPending ? "Adding row…" : "Add row"}</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      {addColumnOpen && (
        <AddColumnButton
          tableId={tableId}
          insert={addColumnOpen.insert}
          onClose={onCloseAddColumn}
          autoOpen
          initialPosition={addColumnOpen.position}
        />
      )}
    </>
  );
}
