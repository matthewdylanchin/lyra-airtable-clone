// table/useKeyboardNavigation.ts
import { useEffect } from "react";
import type { Table } from "@tanstack/react-table";
import type { SelectedCell, TableRow, Editing } from "../types";

export function useKeyboardNavigation({
  table,
  selectedCell,
  setSelectedCell,
  editing,
  editingRef,
  startEdit,
  setDraft,
  commitEdit,
}: {
  table: Table<TableRow>;
  selectedCell: SelectedCell;
  setSelectedCell: (v: SelectedCell) => void;
  editing: Editing;
  editingRef: React.MutableRefObject<Editing>; // ✅ Add editingRef
  startEdit: (
    rowId: string,
    columnId: string,
    mode?: "replace" | "append",
    initialChar?: string,
  ) => void;
  setDraft: (v: string) => void;
  commitEdit: () => void; // ✅ Add commitEdit
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // ✅ Handle Tab specially even when editing
      if (e.key === "Tab") {
        e.preventDefault();

        const isEditing = editingRef.current !== null; // ✅ Check ref, not state

        if (isEditing) {
          // ✅ Commit the edit immediately (synchronous)
          commitEdit();
        }

        if (!selectedCell) return;

        const rows = table.getRowModel().rows;
        const cols = table.getAllLeafColumns();
        if (!rows.length || !cols.length) return;

        let { rowIndex, colIndex } = selectedCell;

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

        // ✅ Move focus immediately (synchronous)
        setSelectedCell({ rowIndex, colIndex });
        return;
      }

      // 🚫 Don't handle other keys while editing
      if (editing) return;

      // ✅ Don't capture keys when user is typing in an input, textarea, or contenteditable
      const activeElement = document.activeElement;
      const isTypingInInput =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute("contenteditable") === "true" ||
        activeElement?.closest("[contenteditable='true']") !== null;

      if (isTypingInInput) return;

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

        startEdit(row.original.__rowId, col.id, "replace", e.key);
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
  }, [
    selectedCell,
    editing,
    editingRef,
    table,
    startEdit,
    setDraft,
    commitEdit,
    setSelectedCell,
  ]);
}
