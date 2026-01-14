// table/useKeyboardNavigation.ts
import { useEffect } from "react";
import type { SelectedCell, TableRow, Editing } from "../types";
import type { Table } from "@tanstack/react-table";

export function useKeyboardNavigation({
  table,
  selectedCell,
  setSelectedCell,
  editing,
  startEdit,
  setDraft,
}: {
  table: Table<TableRow>;
  selectedCell: SelectedCell;
  setSelectedCell: (v: SelectedCell) => void;
  editing: Editing;
  startEdit: (
    rowId: string,
    columnId: string,
    mode?: "replace" | "append",
  ) => void;
  setDraft: (v: string) => void;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!selectedCell) return;

      const rows = table.getRowModel().rows;
      const cols = table.getAllLeafColumns();
      if (!rows.length || !cols.length) return;

      let { rowIndex, colIndex } = selectedCell;

      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !editing) {
        const row = rows[rowIndex];
        const col = cols[colIndex];
        if (!row || !col || col.id === "__index") return;

        startEdit(row.original.__rowId, col.id);
        setDraft(e.key);
        e.preventDefault();
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          rowIndex = Math.min(rowIndex + 1, rows.length - 1);
          break;
        case "ArrowUp":
          rowIndex = Math.max(rowIndex - 1, 0);
          break;
        case "ArrowRight":
        case "Tab":
          colIndex = Math.min(colIndex + 1, cols.length - 1);
          break;
        case "ArrowLeft":
          colIndex = Math.max(colIndex - 1, 1);
          break;
        case "Enter": {
          const row = rows[rowIndex];
          const col = cols[colIndex];
          if (!row || !col || col.id === "__index") return;
          startEdit(row.original.__rowId, col.id, "append");
          e.preventDefault();
          return;
        }
        case "Escape":
          setSelectedCell(null);
          return;
        default:
          return;
      }

      e.preventDefault();
      setSelectedCell({ rowIndex, colIndex });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedCell, editing]);
}
