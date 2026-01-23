"use client";

import { createContext, useContext, useRef, useCallback, useState, useMemo } from "react";
import type { ReactNode, MutableRefObject } from "react";
import type { Cell, Editing, TableData, CellUpsertMutation } from "./types";
import type { PendingEditsMap, PendingEdit } from "./hooks/useTableEditing";

type EditingContextType = {
  // State accessed via refs (no re-renders)
  editingRef: MutableRefObject<Editing>;
  draftRef: MutableRefObject<string>;
  
  // State that triggers re-renders (only for the editing cell)
  editingCell: Editing;
  draft: string;
  
  // Functions
  startEdit: (rowId: string, columnId: string, mode?: "replace" | "append") => void;
  commitEdit: () => void;
  cancelEdit: () => void;
  setDraft: (value: string) => void;
  
  // For temp ID updates
  updateEditingRowId: (tempId: string, realId: string) => void;
  updateEditingColumnId: (tempId: string, realId: string) => void;
  
  // Error state
  localError: string | null;
};

const EditingContext = createContext<EditingContextType | null>(null);

export function useEditingContext() {
  const context = useContext(EditingContext);
  if (!context) {
    throw new Error("useEditingContext must be used within EditingProvider");
  }
  return context;
}

// Hook to check if a specific cell is being edited (only re-renders when this specific cell's edit state changes)
export function useCellEditing(rowId: string, columnId: string) {
  const { editingCell, draft, setDraft, commitEdit, cancelEdit } = useEditingContext();
  
  const isEditing = editingCell?.rowId === rowId && editingCell?.columnId === columnId;
  
  return {
    isEditing,
    draft: isEditing ? draft : "",
    setDraft,
    commitEdit,
    cancelEdit,
  };
}

export function EditingProvider({
  children,
  data,
  cellByKey,
  upsert,
  pendingEditsRef,
  onCommit,
}: {
  children: ReactNode;
  data: TableData | undefined;
  cellByKey: Map<string, Cell>;
  upsert: CellUpsertMutation;
  pendingEditsRef: MutableRefObject<PendingEditsMap>;
  onCommit: (rowId: string, columnId: string, value: string) => void;
}) {
  const [editingCell, setEditingCell] = useState<Editing>(null);
  const [draft, setDraftState] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  
  // Refs for synchronous access (won't cause re-renders)
  const editingRef = useRef<Editing>(null);
  const draftRef = useRef<string>("");
  
  const setDraft = useCallback((value: string) => {
    draftRef.current = value;
    setDraftState(value);
  }, []);

  const startEdit = useCallback((
    rowId: string,
    columnId: string,
    mode: "replace" | "append" = "replace",
  ) => {
    setLocalError(null);

    const cell = cellByKey.get(`${rowId}:${columnId}`);
    const col = data?.columns.find((c) => c.id === columnId);

    const value =
      col?.type === "NUMBER"
        ? (cell?.numberValue ?? "")
        : (cell?.textValue ?? "");

    const newDraft = mode === "append" ? String(value) : "";
    const newEditing = { rowId, columnId, originalValue: String(value) };
    
    draftRef.current = newDraft;
    editingRef.current = newEditing;
    
    setDraftState(newDraft);
    setEditingCell(newEditing);
  }, [cellByKey, data?.columns]);

  const cancelEdit = useCallback(() => {
    editingRef.current = null;
    draftRef.current = "";
    setEditingCell(null);
    setDraftState("");
    setLocalError(null);
  }, []);

  const updateEditingRowId = useCallback((tempId: string, realId: string) => {
    setEditingCell((prev) => {
      if (prev?.rowId === tempId) {
        const updated = { ...prev, rowId: realId };
        editingRef.current = updated;
        return updated;
      }
      return prev;
    });
  }, []);

  const updateEditingColumnId = useCallback((tempId: string, realId: string) => {
    setEditingCell((prev) => {
      if (prev?.columnId === tempId) {
        const updated = { ...prev, columnId: realId };
        editingRef.current = updated;
        return updated;
      }
      return prev;
    });
  }, []);

  const commitEdit = useCallback(() => {
    const editing = editingRef.current;
    const currentDraft = draftRef.current;
    
    if (!editing) return;

    const { rowId, columnId, originalValue } = editing;

    if (currentDraft === originalValue) {
      editingRef.current = null;
      draftRef.current = "";
      setEditingCell(null);
      setDraftState("");
      return;
    }

    const column = data?.columns.find((c) => c.id === columnId);
    const isNumber = column?.type === "NUMBER";

    const textValue = isNumber ? null : currentDraft;
    const numberValue = isNumber ? Number(currentDraft) : null;

    // Update local state immediately
    onCommit(rowId, columnId, currentDraft);

    // Clear editing state
    editingRef.current = null;
    draftRef.current = "";
    setEditingCell(null);
    setDraftState("");
    setLocalError(null);

    // Check if temp row/column
    const isTempRow = rowId.startsWith("temp-");
    const isTempColumn = columnId.startsWith("temp-");

    if (isTempRow || isTempColumn) {
      const queueKey = isTempRow ? rowId : `col:${columnId}`;

      const existing = pendingEditsRef.current.get(queueKey) ?? [];
      const editEntry: PendingEdit = { columnId, textValue, numberValue, rowId };

      const existingIndex = existing.findIndex(
        (e) => e.columnId === columnId && e.rowId === rowId,
      );

      if (existingIndex >= 0) {
        existing[existingIndex] = editEntry;
      } else {
        existing.push(editEntry);
      }

      pendingEditsRef.current.set(queueKey, existing);
      return;
    }

    upsert.mutate(
      { rowId, columnId, textValue, numberValue },
      {
        onError: (error) => {
          setLocalError(error instanceof Error ? error.message : "Failed to save");
        },
      },
    );
  }, [data?.columns, onCommit, pendingEditsRef, upsert]);

  const value = useMemo(() => ({
    editingRef,
    draftRef,
    editingCell,
    draft,
    startEdit,
    commitEdit,
    cancelEdit,
    setDraft,
    updateEditingRowId,
    updateEditingColumnId,
    localError,
  }), [editingCell, draft, startEdit, commitEdit, cancelEdit, setDraft, updateEditingRowId, updateEditingColumnId, localError]);

  return (
    <EditingContext.Provider value={value}>
      {children}
    </EditingContext.Provider>
  );
}