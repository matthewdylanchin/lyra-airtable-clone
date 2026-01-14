// table/columns.tsx
import { cn } from "@/lib/utils";
import type { ColumnDef, CellContext } from "@tanstack/react-table";
import type { TableRow, CellValue } from "./types";

export function createColumns({
  data,
  editing,
  draft,
  selectedCell,
  setSelectedCell,
  startEdit,
  commitEdit,
  cancelEdit,
  setDraft,
}: any): ColumnDef<TableRow, CellValue>[] {
  if (!data) return [];

  return [
    {
      id: "__index",
      header: "#",
      cell: (info) => info.row.index + 1,
    },
    ...data.columns.map((c: any) => ({
      id: c.id,
      header: c.name,
      accessorFn: (row: TableRow) => row[c.id] ?? null,
      cell: (info: CellContext<TableRow, CellValue>) => {
        const value = info.getValue();
        const rowId = info.row.original.__rowId;
        const rowIndex = info.row.index;
        const colIndex = info.column.getIndex();

        const isSelected =
          selectedCell?.rowIndex === rowIndex &&
          selectedCell?.colIndex === colIndex;

        const isEditing =
          editing?.rowId === rowId && editing?.columnId === c.id;

        return (
          <div
            className={cn(
              "relative h-8 w-full px-2 py-1",
              isSelected && "ring-2 ring-blue-600 ring-inset",
            )}
            onClick={() => setSelectedCell({ rowIndex, colIndex })}
            onDoubleClick={() => startEdit(rowId, c.id, "append")}
          >
            {isEditing ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit();
                  if (e.key === "Escape") cancelEdit();
                }}
                className="absolute inset-0 px-2 ring-2 ring-blue-600"
              />
            ) : (
              String(value ?? "")
            )}
          </div>
        );
      },
    })),
  ];
}