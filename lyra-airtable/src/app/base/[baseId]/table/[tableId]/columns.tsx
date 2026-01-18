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

  // Check for specific patterns in column names
  if (
    name.includes("note") ||
    name.includes("description") ||
    name.includes("comment")
  ) {
    return 300; // Wide for long text
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

  // Fallback to column type
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

  // Default
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
      header: "#",
      size: 60, // ✅ Fixed width for row numbers
      minSize: 50,
      cell: (info) => info.row.index + 1,
    },

    ...data.columns.map((c) => ({
      id: c.id,
      accessorFn: (row: TableRow) => row[c.id] ?? null,

      // ✅ Add size based on column type and name
      size: getColumnWidth(c.name, c.type),
      minSize: 50,

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

        // ✅ Check if this cell has a pending mutation (for visual feedback)
        const isPending =
          upsert.isPending &&
          upsert.variables?.rowId === rowId &&
          upsert.variables?.columnId === c.id;

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
                    commitEdit();
                  }

                  if (e.key === "Tab") {
                    e.preventDefault();
                    commitEdit();
                    // Navigation will be handled by useKeyboardNavigation
                  }

                  if (e.key === "Escape") {
                    e.preventDefault();
                    cancelEdit();
                  }
                }}
                onBlur={() => {
                  // Commit when leaving the cell (clicking away / tabbing out)
                  commitEdit();
                }}
                className="h-full w-full border-none bg-transparent px-0 text-sm outline-none"
              />
            ) : (
              <span className="block truncate text-sm">
                {String(value ?? "")}
              </span>
            )}
          </div>
        );
      },
    })),
  ];
}
