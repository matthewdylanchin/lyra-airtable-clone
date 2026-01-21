import { useState } from "react";
import type { TableData, Cell, Editing, CellUpsertMutation } from "../types";

export function useTableEditing({
  data,
  cellByKey,
  upsert,
  onCommit, // ✅ New callback for instant updates
}: {
  data: TableData | undefined;
  cellByKey: Map<string, Cell>;
  upsert: CellUpsertMutation;
  onCommit?: (rowId: string, columnId: string, value: string) => void; // ✅ Add this
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

    console.log(
      "⚡ [commitEdit] INSTANT UPDATE via onCommit",
      performance.now(),
    );

    // ✅ INSTANT: Update local state immediately (< 1ms)
    if (onCommit) {
      onCommit(rowId, columnId, draft);
    }

    console.log("🔵 [commitEdit] Clearing editing state", performance.now());

    // ✅ Clear editing state immediately
    setEditing(null);
    setDraft("");
    setLocalError(null);

    console.log("🟡 [commitEdit] Calling upsert.mutate", performance.now());

    const column = data?.columns.find((c) => c.id === columnId);
    const isNumber = column?.type === "NUMBER";

    upsert.mutate(
      {
        rowId,
        columnId,
        textValue: isNumber ? null : draft,
        numberValue: isNumber ? Number(draft) : null,
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
  };
}
