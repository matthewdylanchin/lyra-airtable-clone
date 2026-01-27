import { useState, useCallback, useRef } from "react";
import type { MutableRefObject } from "react";
import type { TableData, Cell, Editing, CellUpsertMutation } from "../types";

export type PendingEdit = {
  columnId: string;
  textValue: string | null;
  numberValue: number | null;
  rowId?: string;
};

export type PendingEditsMap = Map<string, PendingEdit[]>;

export function useTableEditing({
  data,
  cellByKey,
  upsert,
  onCommit,
  pendingEditsRef,
  setPendingCellEdit,
  clearPendingCellEdit,
}: {
  data: TableData | undefined;
  cellByKey: Map<string, Cell>;
  upsert: CellUpsertMutation;
  onCommit?: (rowId: string, columnId: string, value: string) => void;
  pendingEditsRef?: MutableRefObject<PendingEditsMap>;
  setPendingCellEdit?: (
    rowId: string,
    columnId: string,
    textValue: string | null,
    numberValue: number | null,
  ) => void;
  clearPendingCellEdit?: (
    rowId: string,
    columnId: string,
    newValue?: { textValue: string | null; numberValue: number | null },
  ) => void;
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const editingRef = useRef<Editing>(null);
  const draftRef = useRef<string>("");

  const startEdit = (
    rowId: string,
    columnId: string,
    mode: "replace" | "append" = "replace",
    initialChar?: string,
  ) => {
    setLocalError(null);

    const cell = cellByKey.get(`${rowId}:${columnId}`);
    const col = data?.columns.find((c) => c.id === columnId);

    const value =
      col?.type === "NUMBER"
        ? (cell?.numberValue ?? "")
        : (cell?.textValue ?? "");

    const newDraft = initialChar ?? (mode === "append" ? String(value) : "");
    const newEditing = { rowId, columnId, originalValue: String(value) };

    draftRef.current = newDraft;
    editingRef.current = newEditing;

    setDraft(newDraft);
    setEditing(newEditing);
  };

  const cancelEdit = () => {
    editingRef.current = null;
    draftRef.current = "";
    setEditing(null);
    setDraft("");
    setLocalError(null);
  };

  const setDraftWithRef = useCallback((value: string) => {
    draftRef.current = value;
    setDraft(value);
  }, []);

  const updateEditingRowId = useCallback((tempId: string, realId: string) => {
    setEditing((prev) => {
      if (prev?.rowId === tempId) {
        const updated = { ...prev, rowId: realId };
        editingRef.current = updated;
        return updated;
      }
      return prev;
    });
  }, []);

  const updateEditingColumnId = useCallback(
    (tempId: string, realId: string) => {
      setEditing((prev) => {
        if (prev?.columnId === tempId) {
          const updated = { ...prev, columnId: realId };
          editingRef.current = updated;
          return updated;
        }
        return prev;
      });
    },
    [],
  );

  const commitEdit = useCallback(() => {
    const currentEditing = editingRef.current;
    const currentDraft = draftRef.current;

    if (!currentEditing) return;

    const { rowId, columnId, originalValue } = currentEditing;

    if (currentDraft === originalValue) {
      editingRef.current = null;
      draftRef.current = "";
      setEditing(null);
      setDraft("");
      return;
    }

    const column = data?.columns.find((c) => c.id === columnId);
    const isNumber = column?.type === "NUMBER";
    const textValue = isNumber ? null : currentDraft;
    const numberValue = isNumber ? Number(currentDraft) : null;

    // ✅ 1. Update cache immediately (synchronous)
    if (setPendingCellEdit) {
      setPendingCellEdit(rowId, columnId, textValue, numberValue);
    }

    // ✅ 2. Call onCommit
    if (onCommit) {
      onCommit(rowId, columnId, currentDraft);
    }

    // ✅ 3. Clear editing state IMMEDIATELY (no transitions!)
    editingRef.current = null;
    draftRef.current = "";
    setEditing(null);
    setDraft("");
    setLocalError(null);

    const isTempRow = rowId.startsWith("temp-");
    const isTempColumn = columnId.startsWith("temp-");

    if (isTempRow || isTempColumn) {
      const queueKey = isTempRow ? rowId : `col:${columnId}`;

      if (pendingEditsRef) {
        const existing = pendingEditsRef.current.get(queueKey) ?? [];

        const editEntry = {
          columnId,
          textValue,
          numberValue,
          rowId,
        } as PendingEdit;

        const existingIndex = existing.findIndex(
          (e) => e.columnId === columnId && e.rowId === rowId,
        );

        if (existingIndex >= 0) {
          existing[existingIndex] = editEntry;
        } else {
          existing.push(editEntry);
        }

        pendingEditsRef.current.set(queueKey, existing);
      }

      return;
    }

    // ✅ 4. Fire mutation (async, doesn't block)
    upsert.mutate(
      { rowId, columnId, textValue, numberValue },
      {
        onSuccess: () => {
          if (clearPendingCellEdit) {
            clearPendingCellEdit(rowId, columnId, { textValue, numberValue });
          }
        },
        onError: (error) => {
          if (clearPendingCellEdit) {
            clearPendingCellEdit(rowId, columnId);
          }
          setLocalError(
            error instanceof Error ? error.message : "Failed to save",
          );
        },
      },
    );
  }, [
    data?.columns,
    onCommit,
    setPendingCellEdit,
    clearPendingCellEdit,
    upsert,
    pendingEditsRef,
  ]);

  return {
    editing,
    draft,
    localError,
    startEdit,
    cancelEdit,
    commitEdit,
    setDraft: setDraftWithRef,
    updateEditingRowId,
    updateEditingColumnId,
    editingRef,
    draftRef,
  };
}
