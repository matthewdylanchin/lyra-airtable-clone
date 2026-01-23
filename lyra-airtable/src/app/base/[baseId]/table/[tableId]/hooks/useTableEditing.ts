import { useState, useCallback } from "react";
import type { MutableRefObject } from "react";
import type { TableData, Cell, Editing, CellUpsertMutation } from "../types";

// ✅ NEW: Type for pending edits
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
}: {
  data: TableData | undefined;
  cellByKey: Map<string, Cell>;
  upsert: CellUpsertMutation;
  onCommit?: (rowId: string, columnId: string, value: string) => void;
  pendingEditsRef?: MutableRefObject<PendingEditsMap>;
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const startEdit = (
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

    setDraft(mode === "append" ? String(value) : "");
    setEditing({ rowId, columnId, originalValue: String(value) });
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft("");
    setLocalError(null);
  };

  // ✅ NEW: Function to update the editing rowId when temp ID is replaced
  const updateEditingRowId = useCallback((tempId: string, realId: string) => {
    setEditing((prev) => {
      if (prev && prev.rowId === tempId) {
        console.log(
          `🔄 [updateEditingRowId] Updating editing state: ${tempId} → ${realId}`,
        );
        return { ...prev, rowId: realId };
      }
      return prev;
    });
  }, []);

  // ✅ NEW: Function to update the editing columnId when temp column ID is replaced
  const updateEditingColumnId = useCallback(
    (tempId: string, realId: string) => {
      setEditing((prev) => {
        if (prev && prev.columnId === tempId) {
          console.log(
            `🔄 [updateEditingColumnId] Updating editing state: ${tempId} → ${realId}`,
          );
          return { ...prev, columnId: realId };
        }
        return prev;
      });
    },
    [],
  );

  const commitEdit = () => {
    console.log("🟢 [commitEdit] START", performance.now());

    if (!editing) {
      console.log("⚠️ [commitEdit] No editing state");
      return;
    }

    const { rowId, columnId, originalValue } = editing;

    if (draft === originalValue) {
      console.log("⚠️ [commitEdit] No changes");
      setEditing(null);
      setDraft("");
      return;
    }

    const column = data?.columns.find((c) => c.id === columnId);
    const isNumber = column?.type === "NUMBER";

    const textValue = isNumber ? null : draft;
    const numberValue = isNumber ? Number(draft) : null;

    // ✅ INSTANT: Update local state immediately
    if (onCommit) {
      onCommit(rowId, columnId, draft);
    }

    // ✅ Clear editing state immediately
    setEditing(null);
    setDraft("");
    setLocalError(null);

    // ✅ Check if this is a temporary row
    const isTempRow = rowId.startsWith("temp-");
    const isTempColumn = columnId.startsWith("temp-");

    if (isTempRow || isTempColumn) {
      console.log(
        "⏳ [commitEdit] Temp row/column detected, queueing edit for later",
      );

      // ✅ Queue by BOTH rowId and columnId for temp columns
      // Use a composite key to handle both cases
      const queueKey = isTempRow ? rowId : `col:${columnId}`;

      if (pendingEditsRef) {
        const existing = pendingEditsRef.current.get(queueKey) || [];

        const editEntry = {
          columnId,
          textValue,
          numberValue,
          // ✅ NEW: Also store rowId for column-based queuing
          rowId,
        } as PendingEdit & { rowId?: string };

        // Check if we already have an edit for this cell
        const existingIndex = existing.findIndex(
          (e) =>
            e.columnId === columnId &&
            (e as PendingEdit & { rowId?: string }).rowId === rowId,
        );

        if (existingIndex >= 0) {
          existing[existingIndex] = editEntry;
        } else {
          existing.push(editEntry);
        }

        pendingEditsRef.current.set(queueKey, existing);
        console.log("📝 [commitEdit] Queued edit:", {
          queueKey,
          rowId,
          columnId,
          textValue,
          numberValue,
        });
      }

      return;
    }

    console.log("🟡 [commitEdit] Calling upsert.mutate", performance.now());

    upsert.mutate(
      {
        rowId,
        columnId,
        textValue,
        numberValue,
      },
      {
        onError: (error) => {
          console.log("🔴 [commitEdit] Error:", error);
          setLocalError(
            error instanceof Error ? error.message : "Failed to save",
          );
        },
      },
    );

    console.log("🟢 [commitEdit] END", performance.now());
  };

  return {
    editing,
    draft,
    localError,
    startEdit,
    cancelEdit,
    commitEdit,
    setDraft,
    updateEditingRowId,
    updateEditingColumnId, // ✅ NEW: Export this
  };
}
