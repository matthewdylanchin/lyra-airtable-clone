// table/useTableEditing.ts
import { useState } from "react";
import type { Editing } from "../types";

export function useTableEditing({
  data,
  cellByKey,
  upsert,
}: {
  data: any;
  cellByKey: Map<string, any>;
  upsert: any;
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
    const col = data?.columns.find((c: any) => c.id === columnId);

    const value =
      col?.type === "NUMBER"
        ? (cell?.numberValue ?? "")
        : (cell?.textValue ?? "");

    setDraft(mode === "append" ? String(value) : "");
    setEditing({ rowId, columnId });
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft("");
    setLocalError(null);
  };

  const commitEdit = async () => {
    if (!editing) return;

    try {
      await upsert.mutateAsync({
        rowId: editing.rowId,
        columnId: editing.columnId,
        value: draft,
      });
      setEditing(null);
    } catch (e: unknown) {
      setLocalError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  return {
    editing,
    draft,
    localError,
    setDraft,
    startEdit,
    cancelEdit,
    commitEdit,
  };
}