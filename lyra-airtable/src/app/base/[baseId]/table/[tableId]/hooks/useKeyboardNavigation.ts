// table/useKeyboardNavigation.ts
import { useEffect } from "react";
import type { Table } from "@tanstack/react-table";
import type { SelectedCell, TableRow, Editing } from "../types";

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
      // 🚫 Don't handle global keyboard nav while a cell is being edited
      if (editing) return;

      if (!selectedCell) return;

      const rows = table.getRowModel().rows;
      const cols = table.getAllLeafColumns();
      if (!rows.length || !cols.length) return;

      let { rowIndex, colIndex } = selectedCell;

      // Start editing when typing a character
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
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
        case "Tab": {
          e.preventDefault();

          if (e.shiftKey) {
            // ⬅ Shift + Tab
            if (colIndex > 1) {
              colIndex -= 1;
            } else if (rowIndex > 0) {
              rowIndex -= 1;
              colIndex = cols.length - 1;
            }
          } else {
            // ➡ Tab
            if (colIndex < cols.length - 1) {
              colIndex += 1;
            } else if (rowIndex < rows.length - 1) {
              rowIndex += 1;
              colIndex = 1;
            }
          }
          break;
        }
        case "ArrowLeft":
          colIndex = Math.max(colIndex - 1, 1);
          break;
        case "Enter": {
          // ✅ Only handle Enter if NOT editing
          // The input's onKeyDown will handle Enter during edit
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
  }, [selectedCell, editing, table, startEdit, setDraft, setSelectedCell]);
}
