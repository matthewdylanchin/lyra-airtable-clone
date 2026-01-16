import type { ColumnDef, CellContext } from "@tanstack/react-table";
import type {
  TableData,
  TableRow,
  CellValue,
  Editing,
  SelectedCell,
} from "./types";
import { cn } from "@/lib/utils";
import ColumnHeader from "@/app/_components/column/ColumnHeader";
import type { ColumnInsertPosition } from "./types";

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
  onInsert,
}: {
  data: TableData | undefined;
  editing: Editing;
  draft: string;
  selectedCell: SelectedCell;
  setSelectedCell: (v: SelectedCell) => void;
  startEdit: (
    rowId: string,
    columnId: string,
    mode?: "replace" | "append",
  ) => void;
  commitEdit: () => void;
  cancelEdit: () => void;
  setDraft: (v: string) => void;
  onInsert: (
    insert: ColumnInsertPosition,
    position: { top: number; left: number },
  ) => void;
}): ColumnDef<TableRow, CellValue>[] {
  if (!data) return [];

  return [
    {
      id: "__index",
      header: "#",
      cell: (info) => info.row.index + 1,
    },

    ...data.columns.map((c) => ({
      id: c.id,
      accessorFn: (row: TableRow) => row[c.id] ?? null,

      /** ⭐ Add full meta so the header menu works */
      meta: {
        id: c.id,
        name: c.name,
        type: c.type,
      },

      /** ⭐ Use ColumnHeader component */
      header: () => (
        <ColumnHeader
          column={{ id: c.id, name: c.name, type: c.type }}
          tableId={data.table.id}
          onInsert={onInsert}
        />
      ),
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

        const isNumberCol = c.type === "NUMBER";

        return (
          <div
            className={cn(
              "relative h-8 w-full cursor-default px-2 py-1 outline-none",
              isSelected && "ring-2 ring-blue-600 ring-inset",
              !isEditing && "hover:bg-zinc-50",
            )}
            onClick={() => setSelectedCell({ rowIndex, colIndex })}
            onDoubleClick={() => startEdit(rowId, c.id, "append")}
          >
            {isEditing ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => {
                  const val = e.target.value;

                  // ⭐ NUMBER COLUMN VALIDATION
                  if (isNumberCol) {
                    // Allow: digits, optional decimal
                    if (/^-?\d*\.?\d*$/.test(val)) {
                      setDraft(val);
                    }
                    return;
                  }

                  setDraft(val);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void commitEdit();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    cancelEdit();
                  }
                }}
                className="absolute inset-0 box-border px-2 ring-2 ring-blue-600 outline-none"
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
