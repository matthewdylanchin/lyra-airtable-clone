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
import type { CellUpsertMutation } from "./types";

/**
 * Helper function to estimate appropriate column width based on column type and name
 */
function getColumnWidth(columnName: string, columnType?: string): number {
  const name = columnName.toLowerCase();

  if (
    name.includes("note") ||
    name.includes("description") ||
    name.includes("comment")
  ) {
    return 300;
  }
  if (name.includes("summary")) {
    return 250;
  }
  if (name.includes("name") || name.includes("title")) {
    return 200;
  }
  if (name.includes("attachment") || name.includes("file")) {
    return 180;
  }
  if (
    name.includes("assignee") ||
    name.includes("owner") ||
    name.includes("user")
  ) {
    return 150;
  }
  if (
    name.includes("status") ||
    name.includes("priority") ||
    name.includes("type")
  ) {
    return 120;
  }
  if (
    name.includes("date") ||
    name.includes("time") ||
    name.includes("created") ||
    name.includes("updated")
  ) {
    return 140;
  }

  if (columnType === "LONG_TEXT" || columnType === "TEXT") {
    return 250;
  }
  if (columnType === "NUMBER") {
    return 100;
  }
  if (columnType === "DATE" || columnType === "DATETIME") {
    return 140;
  }
  if (columnType === "SELECT" || columnType === "SINGLE_SELECT") {
    return 130;
  }
  if (columnType === "MULTI_SELECT") {
    return 180;
  }

  return 150;
}

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
  upsert,
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
  upsert: CellUpsertMutation;
}): ColumnDef<TableRow, CellValue>[] {
  if (!data) return [];

  return [
    {
      id: "__index",
      header: "",
      size: 60,
      minSize: 50,
      cell: (info) => (
        <div className="flex h-full items-center justify-center text-sm text-gray-600">
          {info.row.index + 1}
        </div>
      ),
    },

    ...data.columns.map((c) => ({
      id: c.id,
      accessorFn: (row: TableRow) => row[c.id] ?? null,
      size: getColumnWidth(c.name, c.type),
      minSize: 50,

      meta: {
        id: c.id,
        name: c.name,
        type: c.type,
      },

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

        const isPending =
          upsert.isPending &&
          upsert.variables?.rowId === rowId &&
          upsert.variables?.columnId === c.id;

        return (
          <div
            className={cn(
              "relative flex h-9 w-full cursor-default items-center outline-none", // ✅ Added flex and items-center
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

                  if (isNumberCol) {
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
                    e.stopPropagation();
                    commitEdit();
                    return;
                  }

                  if (e.key === "Tab") {
                    e.preventDefault();
                    commitEdit();
                    return;
                  }

                  if (e.key === "Escape") {
                    e.preventDefault();
                    cancelEdit();
                    return;
                  }
                }}
                onBlur={() => {
                  commitEdit();
                }}
                // ✅ Use absolute positioning to fill entire cell
                className="absolute inset-0 h-full w-full border-none bg-transparent px-2.5 text-sm outline-none focus:ring-0 focus:outline-none"
                style={{ boxShadow: "none" }}
              />
            ) : (
              // ✅ Text naturally centered by parent's flex
              <span className="block truncate px-2.5 text-sm">
                {String(value ?? "")}
              </span>
            )}
          </div>
        );
      },
    })),
  ];
}
