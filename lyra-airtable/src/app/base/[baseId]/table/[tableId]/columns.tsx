import type { ColumnDef, CellContext } from "@tanstack/react-table";
import type { TableData, TableRow, CellValue, SelectedCell } from "./types";
import { cn } from "@/lib/utils";
import ColumnHeader from "@/app/_components/column/ColumnHeader";
import type { ColumnInsertPosition } from "./types";
import { EditableCell } from "./EditableCell";

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
  selectedCell,
  setSelectedCell,
  startEdit,
  onInsert,
  searchQuery,
  currentMatch,
  filteredColumnIds,
  sortedColumnIds,
}: {
  data: TableData | undefined;
  selectedCell: SelectedCell;
  setSelectedCell: (v: SelectedCell) => void;
  startEdit: (
    rowId: string,
    columnId: string,
    mode?: "replace" | "append",
  ) => void;
  onInsert: (
    insert: ColumnInsertPosition,
    position: { top: number; left: number },
  ) => void;
  searchQuery?: string;
  currentMatch?: {
    rowId: string;
    columnId: string;
    rowIndex: number;
    colIndex: number;
  } | null;
  filteredColumnIds?: Set<string>;
  sortedColumnIds?: Set<string>;
}): ColumnDef<TableRow, CellValue>[] {
  if (!data) return [];

  return [
    {
      id: "__index",
      header: "",
      size: 60,
      minSize: 50,
      cell: (info) => {
        const hasMatch =
          searchQuery &&
          data.columns.some((col) => {
            const cellValue = info.row.original[col.id];
            return (
              cellValue &&
              String(cellValue)
                .toLowerCase()
                .includes(searchQuery.toLowerCase())
            );
          });

        return (
          <div
            className={cn(
              "flex items-center justify-center text-sm text-gray-600",
              hasMatch && "bg-amber-100 font-semibold",
            )}
            style={{ height: "35px", width: "100%" }}
          >
            {info.row.index + 1}
          </div>
        );
      },
    },

    ...data.columns.map((c) => {
      const isFilteredColumn = filteredColumnIds?.has(c.id) ?? false;
      const isSortedColumn = sortedColumnIds?.has(c.id) ?? false;

      return {
        id: c.id,
        accessorFn: (row: TableRow) => row[c.id] ?? null,
        size: getColumnWidth(c.name, c.type),
        minSize: 50,
        meta: { id: c.id, name: c.name, type: c.type },
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

          const cellValueStr = value != null ? String(value) : "";
          const searchLower = searchQuery?.toLowerCase() ?? "";
          const cellLower = cellValueStr.toLowerCase();

          const isMatch =
            searchQuery && cellValueStr && cellLower.includes(searchLower);
          const isCurrentMatch =
            isMatch &&
            currentMatch?.rowId === rowId &&
            currentMatch?.columnId === c.id;

          return (
            <EditableCell
              rowId={rowId}
              columnId={c.id}
              value={value}
              rowIndex={rowIndex}
              colIndex={colIndex}
              isSelected={isSelected}
              isNumberCol={c.type === "NUMBER"}
              isFilteredColumn={isFilteredColumn}
              isSortedColumn={isSortedColumn}
              isMatch={!!isMatch}
              isCurrentMatch={!!isCurrentMatch}
              onSelect={() => setSelectedCell({ rowIndex, colIndex })}
              onStartEdit={() => startEdit(rowId, c.id, "append")}
            />
          );
        },
      };
    }),
  ];
}
