// TableView.tsx
import { flexRender } from "@tanstack/react-table";
import type { Table } from "@tanstack/react-table";
import type { TableRow } from "./types";

export function TableView({
  table,
}: {
  table: Table<TableRow>;
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead className="sticky top-0 bg-zinc-50">
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id}>
            {hg.headers.map((header) => (
              <th
                key={header.id}
                className="border-b px-2 py-2 text-left font-medium"
              >
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext(),
                )}
              </th>
            ))}
          </tr>
        ))}
      </thead>

      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id} className="border-b">
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} className="px-1">
                {flexRender(
                  cell.column.columnDef.cell,
                  cell.getContext(),
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}