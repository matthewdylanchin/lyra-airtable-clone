import { useState, useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
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
import { memo } from "react";

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

// ✅ Separate component for the input (manages its own local state)
const EditInput = memo(function EditInput({
  rowIndex,
  columnId,
  isNumberCol,
  draftRef,
  commitEdit,
  cancelEdit,
}: {
  rowIndex: number;
  columnId: string;
  isNumberCol: boolean;
  draftRef: MutableRefObject<string>;
  commitEdit: () => void;
  cancelEdit: () => void;
}) {
  // ✅ Local state for the input - only this component re-renders on typing
  const [localValue, setLocalValue] = useState(draftRef.current);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local value to ref on every change
  useEffect(() => {
    draftRef.current = localValue;
  }, [localValue, draftRef]);

  // Focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <input
      ref={inputRef}
      key={`edit-${rowIndex}-${columnId}`}
      value={localValue}
      onChange={(e) => {
        const val = e.target.value;

        if (isNumberCol) {
          if (/^-?\d*\.?\d*$/.test(val)) {
            setLocalValue(val);
          }
          return;
        }

        setLocalValue(val);
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
      className="absolute inset-0 h-full w-full border-none bg-transparent px-2.5 text-sm outline-none focus:ring-0 focus:outline-none"
      style={{ boxShadow: "none" }}
    />
  );
});

// ✅ OPTIMIZED: Memoized cell component that only re-renders when necessary
const OptimizedTableCell = memo(
  ({
    value,
    rowId,
    columnId,
    rowIndex,
    colIndex,
    isEditing,
    isSelected,
    isPending,
    isNumberCol,
    isFilteredColumn,
    isSortedColumn,
    isCurrentMatch,
    isMatch,
    isBulkLoading,
    hasRowData,
    draftRef,
    setSelectedCell,
    startEdit,
    commitEdit,
    cancelEdit,
  }: {
    value: CellValue;
    rowId: string;
    columnId: string;
    rowIndex: number;
    colIndex: number;
    isEditing: boolean;
    isSelected: boolean;
    isPending: boolean;
    isNumberCol: boolean;
    isFilteredColumn: boolean;
    isSortedColumn: boolean;
    isCurrentMatch: boolean;
    isMatch: boolean;
    isBulkLoading: boolean;
    hasRowData: boolean;
    draftRef: MutableRefObject<string>;
    setSelectedCell: (v: SelectedCell) => void;
    startEdit: (
      rowId: string,
      columnId: string,
      mode?: "replace" | "append",
    ) => void;
    commitEdit: () => void;
    cancelEdit: () => void;
  }) => {
    // Show skeleton for rows without cell data during bulk load
    if (isBulkLoading && !hasRowData) {
      return (
        <div className="flex h-9 items-center px-2.5">
          <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
        </div>
      );
    }

    return (
      <div
        className={cn(
          "relative flex h-9 w-full cursor-default items-center outline-none",
          isSelected && "ring-2 ring-blue-600 ring-inset",
          !isEditing && "hover:bg-zinc-50",
          // Column highlighting priority: filter (green) > sort (orange)
          isFilteredColumn && "bg-emerald-50",
          isSortedColumn && !isFilteredColumn && "bg-orange-50",
          // Search highlighting (highest priority)
          isCurrentMatch && "border-l-2 border-amber-200 bg-amber-200",
          isMatch &&
            !isCurrentMatch &&
            "border-l-2 border-amber-100 bg-amber-100",
        )}
        onClick={() => setSelectedCell({ rowIndex, colIndex })}
        onDoubleClick={() => startEdit(rowId, columnId, "append")}
      >
        {isEditing ? (
          <EditInput
            rowIndex={rowIndex}
            columnId={columnId}
            isNumberCol={isNumberCol}
            draftRef={draftRef}
            commitEdit={commitEdit}
            cancelEdit={cancelEdit}
          />
        ) : (
          <span className="block truncate px-2.5 text-sm text-zinc-600">
            {String(value ?? "")}
          </span>
        )}
      </div>
    );
  },
  // ✅ CRITICAL: Custom comparison to prevent unnecessary re-renders
  (prevProps, nextProps) => {
    // Only re-render if these specific props change
    return (
      prevProps.value === nextProps.value &&
      prevProps.isEditing === nextProps.isEditing &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isPending === nextProps.isPending &&
      prevProps.isCurrentMatch === nextProps.isCurrentMatch &&
      prevProps.isMatch === nextProps.isMatch &&
      prevProps.isBulkLoading === nextProps.isBulkLoading &&
      prevProps.hasRowData === nextProps.hasRowData
      // Note: We intentionally don't compare functions (setSelectedCell, startEdit, etc.)
      // as they should be stable references
    );
  },
);

OptimizedTableCell.displayName = "OptimizedTableCell";

export function createColumns({
  data,
  editing,
  draftRef,
  selectedCell,
  setSelectedCell,
  startEdit,
  commitEdit,
  cancelEdit,
  onInsert,
  upsert,
  searchQuery,
  currentMatch,
  filteredColumnIds,
  sortedColumnIds,
  hiddenColumnIds,
  isBulkLoading,
  rowsWithCellData,
}: {
  data: TableData | undefined;
  editing: Editing;
  draftRef: MutableRefObject<string>;
  selectedCell: SelectedCell;
  setSelectedCell: (v: SelectedCell) => void;
  startEdit: (
    rowId: string,
    columnId: string,
    mode?: "replace" | "append",
  ) => void;
  commitEdit: () => void;
  cancelEdit: () => void;
  onInsert: (
    insert: ColumnInsertPosition,
    position: { top: number; left: number },
  ) => void;
  upsert: CellUpsertMutation;
  searchQuery?: string;
  currentMatch?: {
    rowId: string;
    columnId: string;
    rowIndex: number;
    colIndex: number;
  } | null;
  filteredColumnIds?: Set<string>;
  sortedColumnIds?: Set<string>;
  hiddenColumnIds?: string[];
  isBulkLoading?: boolean;
  rowsWithCellData?: Set<string>;
}): ColumnDef<TableRow, CellValue>[] {
  if (!data) return [];

  return [
    {
      id: "__index",
      header: "",
      size: 60,
      minSize: 50,
      cell: (info) => {
        // Check if this row has any matching cells
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
            style={{
              height: "35px",
              width: "100%",
            }}
          >
            {info.row.index + 1}
          </div>
        );
      },
    },

    ...data.columns
      .filter((c) => !hiddenColumnIds?.includes(c.id))
      .map((c) => {
        // Check if this column is filtered or sorted
        const isFilteredColumn = filteredColumnIds?.has(c.id) ?? false;
        const isSortedColumn = sortedColumnIds?.has(c.id) ?? false;

        return {
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

            // Check if this cell matches the search query
            const cellValueStr = value != null ? String(value) : "";
            const searchLower = searchQuery?.toLowerCase() ?? "";
            const cellLower = cellValueStr.toLowerCase();

            const isMatch =
              searchQuery && cellValueStr && cellLower.includes(searchLower);

            // Check if this is the CURRENT focused match
            const isCurrentMatch =
              isMatch &&
              currentMatch?.rowId === rowId &&
              currentMatch?.columnId === c.id;

            const hasRowData = rowsWithCellData?.has(rowId) ?? true;

            // ✅ Use optimized memoized cell component
            return (
              <OptimizedTableCell
                value={value}
                rowId={rowId}
                columnId={c.id}
                rowIndex={rowIndex}
                colIndex={colIndex}
                isEditing={isEditing}
                isSelected={isSelected}
                isPending={isPending}
                isNumberCol={isNumberCol}
                isFilteredColumn={isFilteredColumn}
                isSortedColumn={isSortedColumn}
                isCurrentMatch={!!isCurrentMatch}
                isMatch={!!isMatch}
                isBulkLoading={isBulkLoading ?? false}
                hasRowData={hasRowData}
                draftRef={draftRef}
                setSelectedCell={setSelectedCell}
                startEdit={startEdit}
                commitEdit={commitEdit}
                cancelEdit={cancelEdit}
              />
            );
          },
        };
      }),
  ];
}
