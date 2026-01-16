"use client";

import { flexRender } from "@tanstack/react-table";
import type { Table } from "@tanstack/react-table";
import type { TableRow, AddColumnState } from "./types";
import AddColumnButton from "./Components/AddColumnButton";
import { useParams } from "next/navigation";

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
