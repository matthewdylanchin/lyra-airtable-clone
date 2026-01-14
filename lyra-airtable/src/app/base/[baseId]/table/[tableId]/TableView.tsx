// table/TableView.tsx
import { flexRender } from "@tanstack/react-table";

export function TableView({ table }: { table: any }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        {table.getHeaderGroups().map((hg: any) => (
          <tr key={hg.id}>
            {hg.headers.map((h: any) => (
              <th key={h.id}>
                {flexRender(h.column.columnDef.header, h.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row: any) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell: any) => (
              <td key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}